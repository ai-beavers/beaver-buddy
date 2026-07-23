// Ingests ComfyUI-generated animation sprite sheets (BL Phase-3 / Fallschirm-
// Drop, extended to the adult stage in BL-18) into a stage's sheet as new
// rows, reusing the exact mechanical pipeline the still-frame ingest uses
// (ingest-images.mjs): flood-fill background removal, crop to content bbox,
// premultiplied-alpha area-average downscale to a per-animation locked scale,
// composite bottom-aligned + centered onto a 96x96 tile. No beaver pixels are
// authored or retouched here (CLAUDE.md's "mechanically process, never
// retouch" rule).
//
// Source frames come from one Comfy Cloud run per animation (the "Voll
// ComfyUI" owner decision, 2026-07-20): each run's `PixelArt Builder` output
// is 8 alpha-croppable frames on a white background, downloaded to the
// gitignored assets-src/comfyui/<run>/frame_0{1..8}.png. Those raw dumps stay
// local (asset rule: only committed art ships); this script + the baked sheet
// are the reproducible, committed record.
//
// idle + walk are NOT regenerated — their tiles are copied byte-for-byte out
// of the existing committed sheet (beaver-baby.png / beaver-adult.png) so the
// shipped still art is preserved exactly; only struggle / parachute-wind /
// land are appended. CLI: `node ingest-animation-frames.mjs [baby|adult]`
// (default baby), see BABY / ADULT below.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TILE,
  FPS,
  decodePng,
  removeBackground,
  chromaKeyGreen,
  extractGridCell,
  cropToBbox,
  resizeAreaAverage,
  placeOnTile,
  computeStageScale,
  spliceRow,
} from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';

// Per-animation target content height (px within the 96px tile). struggle and
// land settle to ~idle size (shipped idle content is ~61px tall) on their
// calmer frames while their most-spread pose reaches this height; parachute-
// wind fits the whole canopy+beaver into the tile, so the beaver reads smaller
// during the glide (documented tradeoff — the runtime, WAVE-2, owns world
// placement, not tile scale).
export const BABY = {
  shippedPng: 'beaver-baby.png',
  bakedDirName: 'beaver-baby',
  animations: [
    { name: 'struggle', run: 'struggle-run', targetContentHeightPx: 82 },
    { name: 'parachute-wind', run: 'parachute-wind-run', targetContentHeightPx: 92 },
    { name: 'land', run: 'land-run', targetContentHeightPx: 92 },
  ],
};

// Adult frames are the same 3 poses on a bigger, wider-limbed rig (BL-18).
// idle/walk are now final art (BL-6/T3, replacing the earlier teen-upscale
// placeholder), sized to fill the full 96px tile, so the anim rows are
// targeted taller than baby's own heights to read as the same size beaver —
// computeStageScale's width term remains the clipping guard (see
// ingest-images.mjs) if a height gets bumped further.
//
// parachute-wind carries its own tileHeight (BL-19): sharing the square 96px
// tile forced the beaver's body to shrink so the canopy above it would also
// fit, reading noticeably smaller than idle. A taller tile lets the canopy
// extend upward past the base tile (drawFrame in sprites.ts bottom-anchors
// every row to the same ground line) while the beaver's body renders
// full-size. targetContentHeightPx is raised to match — computeStageScale's
// width term (still keyed off the base 96px tile, see bakeAnimation) is the
// only thing capping content width, so a taller target just fills the taller
// tile instead of clipping.
export const ADULT = {
  shippedPng: 'beaver-adult.png',
  bakedDirName: 'beaver-adult',
  animations: [
    { name: 'struggle', run: 'adult-struggle', targetContentHeightPx: 96 },
    { name: 'parachute-wind', run: 'adult-parachute-wind', targetContentHeightPx: 128, tileHeight: 128, preKeyed: true },
    { name: 'land', run: 'adult-land', targetContentHeightPx: 90 },
  ],
};

const STAGES = { baby: BABY, adult: ADULT };

const FRAME_COUNT = 8;

// Copies a single TILE×TILE tile out of a decoded sheet at (col,row).
function extractTile(sheet, col, row) {
  const out = new Uint8ClampedArray(TILE * TILE * 4);
  for (let y = 0; y < TILE; y += 1) {
    const srcStart = ((row * TILE + y) * sheet.width + col * TILE) * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + TILE * 4), y * TILE * 4);
  }
  return { width: TILE, height: TILE, data: out };
}

// Bakes one animation's 8 frames into 8 tiles at a single locked scale.
// tileHeight (default TILE) sets the composited canvas height only — the
// width cap passed to computeStageScale stays the base TILE (96) so a taller
// row still never clips horizontally into the next sheet column.
// preKeyed frames already ship a transparent background (chroma-keyed at
// authoring time). removeBackground's border flood-fill also treats near-white
// as background, so running it on a pre-keyed frame eats any white detail that
// touches the transparent edge (e.g. the parachute's white canopy stripes) —
// skip it and just crop to the alpha bbox.
function bakeAnimation(runDir, targetContentHeightPx, tileHeight = TILE, preKeyed = false) {
  const cropped = [];
  for (let i = 1; i <= FRAME_COUNT; i += 1) {
    const file = path.join(runDir, `frame_${String(i).padStart(2, '0')}.png`);
    const buf = fs.readFileSync(file);
    const decoded = decodePng(buf);
    cropped.push(cropToBbox(preKeyed ? decoded : removeBackground(decoded)));
  }
  const scale = computeStageScale(cropped, TILE, targetContentHeightPx);
  const tiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    return placeOnTile(resizeAreaAverage(img, destW, destH), TILE, tileHeight);
  });
  return { tiles, scale };
}

// Bakes a stage's animation rows onto its existing idle/walk tiles. `config`
// is one of BABY / ADULT above: the shipped sheet supplies idle/walk
// byte-for-byte, the ComfyUI run dirs supply the new rows.
export function buildStageSheet(repoRoot, config) {
  const shippedPng = path.join(repoRoot, 'assets', 'sprites', config.shippedPng);
  const shipped = decodePng(fs.readFileSync(shippedPng));

  // Preserve idle (row0 col0) + walk (row1 col0/col1) exactly. Both come
  // from extractTile, which is always TILE×TILE — height defaults to TILE.
  const rows = [
    { name: 'idle', tiles: [extractTile(shipped, 0, 0)], height: TILE },
    { name: 'walk', tiles: [extractTile(shipped, 0, 1), extractTile(shipped, 1, 1)], height: TILE },
  ];

  const scales = {};
  for (const anim of config.animations) {
    const runDir = path.join(repoRoot, 'assets-src', 'comfyui', anim.run);
    const tileHeight = anim.tileHeight ?? TILE;
    const { tiles, scale } = bakeAnimation(runDir, anim.targetContentHeightPx, tileHeight, anim.preKeyed ?? false);
    rows.push({ name: anim.name, tiles, height: tileHeight });
    scales[anim.name] = scale;
  }

  // Rows stack at cumulative y-offsets, not rowIndex*TILE — a row can be
  // taller than TILE (BL-19: adult parachute-wind), so every row after it
  // shifts down by the extra height. Width stays a flat maxFrames*TILE grid:
  // only row height varies, never column width.
  const maxFrames = Math.max(...rows.map((r) => r.tiles.length));
  const width = maxFrames * TILE;
  const height = rows.reduce((sum, r) => sum + r.height, 0);
  const data = new Uint8ClampedArray(width * height * 4);

  let originY = 0;
  for (const row of rows) {
    row.tiles.forEach((tile, frameIndex) => {
      const originX = frameIndex * TILE;
      for (let y = 0; y < row.height; y += 1) {
        const srcStart = y * TILE * 4;
        const destStart = ((originY + y) * width + originX) * 4;
        data.set(tile.data.subarray(srcStart, srcStart + TILE * 4), destStart);
      }
    });
    originY += row.height;
  }

  const meta = {
    tile: TILE,
    fps: FPS,
    sheetWidth: width,
    sheetHeight: height,
    rows: rows.map((r) => ({
      name: r.name,
      frames: r.tiles.length,
      ...(r.height !== TILE ? { height: r.height } : {}),
    })),
  };
  return { png: encodeRgbaPng({ width, height, data }), meta, scales };
}

// Baby stays a named entry point: it's the one every existing test/caller
// imports directly.
export function buildBabySheet(repoRoot) {
  return buildStageSheet(repoRoot, BABY);
}

// Adult single-grid rows (watering, drink, ...): each appended directly onto
// the already-committed beaver-adult sheet, NOT folded into ADULT.animations
// above. Rebuilding the whole adult stage from ADULT.animations would
// require struggle/parachute-wind/land's own gitignored Comfy run dirs to
// also exist locally, and Comfy generation isn't deterministic — re-baking
// them on a machine that lacks those dumps would silently replace
// already-shipped pixels. This mirrors ingest-typing.mjs's "append one row
// to the committed sheet, preserving every other row byte-for-byte" pattern
// (all three now share spliceRow, which finds the target row by name rather
// than assuming it's a contiguous prefix or the physical last row — needed
// because rows keep getting appended onto the same sheet over time), reading
// a single gridCols x gridRows grid image (like the type row's source sheet)
// instead of per-file frames. `rowHeight` defaults to TILE; pass it when a
// pose needs a taller tile (BL-19 precedent on the animated rows).
export function buildAdultRowSheet(repoRoot, config) {
  const pngPath = path.join(repoRoot, 'assets', 'sprites', ADULT.shippedPng);
  const jsonPath = pngPath.replace(/\.png$/, '.json');
  const shipped = decodePng(fs.readFileSync(pngPath));
  const shippedMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Invariant: config.frames must match the grid cell count — buildAdultRowSheet
  // reads every cell (gridCols*gridRows), so a stale/typo'd frames field would
  // otherwise silently bake the wrong frame count with no error.
  if (config.gridCols * config.gridRows !== config.frames) {
    throw new Error(`${config.rowName}: frames (${config.frames}) !== gridCols*gridRows (${config.gridCols}x${config.gridRows})`);
  }

  const sheetPath = path.join(repoRoot, 'assets-src', 'comfyui', config.sourceDir, 'sheet.png');
  const grid = decodePng(fs.readFileSync(sheetPath));
  const cropped = [];
  for (let row = 0; row < config.gridRows; row += 1) {
    for (let col = 0; col < config.gridCols; col += 1) {
      const cell = extractGridCell(grid, col, row, config.gridCols, config.gridRows);
      cropped.push(cropToBbox(chromaKeyGreen(cell)));
    }
  }
  const rowHeight = config.rowHeight ?? TILE;
  const scale = computeStageScale(cropped, TILE, config.targetContentHeightPx);
  const tiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    return placeOnTile(resizeAreaAverage(img, destW, destH), TILE, rowHeight);
  });

  const { width, height, data, meta } = spliceRow(shipped, shippedMeta, config.rowName, tiles, rowHeight);
  return { png: encodeRgbaPng({ width, height, data }), meta, scale };
}

export const ADULT_WATERING = {
  rowName: 'watering',
  sourceDir: 'adult-watering',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 88,
};

export function buildAdultWateringSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_WATERING);
}

// Coffee-drink loop (BL-3): beaver lifts a mug, sips, steam wisps —
// reference-conditioned on the committed adult beaver, same green
// chroma-key + 4x2 grid convention as watering.
export const ADULT_DRINK = {
  rowName: 'drink',
  sourceDir: 'adult-drink',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 88,
};

export function buildAdultDrinkSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_DRINK);
}

// Sleep loop (BL-4): curled-up idle loop, gentle breathing rise/fall and
// pulsing "zzz" wisps above the head — same reference-conditioned green
// chroma-key 4x2 grid convention as watering/drink. Unlike drink/watering
// (which settle to a grounded standing pose), sleep is a LOOP with no
// settle/lie-down transition frame: matches every
// other looping row, a one-shot fall-asleep transition can be added as its
// own row later without reworking this one.
export const ADULT_SLEEP = {
  rowName: 'sleep',
  sourceDir: 'adult-sleep',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 88,
};

export function buildAdultSleepSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_SLEEP);
}

// Wake-up/stretch (BL-5): ONE-SHOT transition (like `land`, not a loop) —
// wakes from the committed sleep pose, sits up, big arms-up stretch + yawn,
// settles to the idle stance. Reference-conditioned on BOTH the committed
// adult idle tile AND the committed sleep-pose tile (dual medias[] chaining)
// so frame 1 genuinely continues the sleep row's final pose. Scale-trap
// check (BL-19 parachute-wind precedent considered, not needed here): the
// row's tallest raw content is the standing frames' own tail-to-ear span
// (~762px pre-scale, shared evenly by the arms-up AND arms-down standing
// frames — the raised arms never reach above ear height), not a taller
// arms-up-only silhouette, so targetContentHeightPx=96 (default 96px
// rowHeight) reproduces the committed idle tile's own full-tile content
// height (measured 96/96, edge-to-edge, no padding) with no shrink — see
// STYLE.md provenance for the measured comparison.
export const ADULT_STRETCH = {
  rowName: 'stretch',
  sourceDir: 'adult-stretch',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 96,
};

export function buildAdultStretchSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_STRETCH);
}

// Speak LOOP (BL-7, redone after design-gate FAIL): a first attempt
// generated a full 8-frame AI grid the same way as watering/drink/sleep/
// stretch — but each cell is an INDEPENDENT generation, and nothing forces
// independent generations to agree on body/tail/shading, so the row read as
// whole-body flicker at playback speed, not a talking mouth (see git history
// on this constant for the discarded grid approach and
// docs/design-reviews/BL-7-speak-verdict.md for the FAIL writeup).
//
// Fix: derive every frame MECHANICALLY from the single already-accepted
// idle tile, patching ONLY a small mouth-region bounding box (an open-mouth
// cavity + outline + teeth, colors resampled from the idle tile's own nose/
// outline/tooth pixels — no new art, no palette drift). Every pixel outside
// `mouthBox` is byte-identical across every frame BY CONSTRUCTION (both
// states start from a clone of the same idle tile), so body jitter is
// structurally impossible, not just visually absent — verified by a
// dedicated test in ingest-animation-frames.test.ts. No ComfyUI run/raw
// dump is involved at all.
export const ADULT_SPEAK = {
  rowName: 'speak',
  mouthBox: { x0: 54, y0: 34, x1: 86, y1: 52 },
};

// Draws a small open-mouth cavity (ellipse fill + outline ring) plus a
// short row of teeth into a clone of `tile`, entirely within
// ADULT_SPEAK.mouthBox. Colors are sampled from the idle tile itself: the
// nose's own dark-maroon fill for the cavity, the art's pure-black outline,
// and the existing visible tooth's white — so the patch matches the
// existing rendering style with zero new palette entries.
function drawOpenMouth(tile) {
  const data = new Uint8ClampedArray(tile.data);
  const { x0, y0, x1, y1 } = ADULT_SPEAK.mouthBox;
  const cx = 69;
  const cy = 43;
  const rx = 10;
  const ry = 7;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const i = (y * TILE + x) * 4;
      if (dist <= 0.78) {
        data[i] = 15; data[i + 1] = 9; data[i + 2] = 9; data[i + 3] = 255;
      } else if (dist <= 1.0) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
      }
    }
  }
  for (const [x, y] of [[63, 39], [66, 38], [69, 38], [72, 39]]) {
    const i = (y * TILE + x) * 4;
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
  }
  return { width: TILE, height: TILE, data };
}

// Two-pulse talking cadence (open/closed/closed/closed twice), built from
// exactly two derived states — no per-frame generation to drift.
export function buildAdultSpeakSheet(repoRoot) {
  const pngPath = path.join(repoRoot, 'assets', 'sprites', ADULT.shippedPng);
  const jsonPath = pngPath.replace(/\.png$/, '.json');
  const shipped = decodePng(fs.readFileSync(pngPath));
  const shippedMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const idle = extractTile(shipped, 0, 0); // idle is always the sheet's first row, first (only) frame
  const closed = { width: TILE, height: TILE, data: new Uint8ClampedArray(idle.data) };
  const open = drawOpenMouth(idle);
  const tiles = [open, closed, closed, closed, open, closed, closed, closed];

  const { width, height, data, meta } = spliceRow(shipped, shippedMeta, ADULT_SPEAK.rowName, tiles, TILE);
  return { png: encodeRgbaPng({ width, height, data }), meta, scale: 1 };
}

// Final idle/walk (BL-6/T3): replaces the teen-upscale placeholder rows
// with authored-pixel art, via the SAME buildAdultRowSheet/spliceRow path as
// watering/drink/sleep/stretch above (idle is a 1x1 "grid", walk a 2x1
// grid) rather than a bespoke builder — spliceRow finds each row by name and
// preserves the other 8 rows' bytes exactly, same as every prior append/
// replace here. Continuity is the acceptance bar (BL-18 was rejected as
// generic/off-model): both rows are reference-conditioned on the single
// image every other adult row is already anchored to (the committed adult
// reference re-used by filename, per docs/dev-guardrails.md — fresh uploads
// are blocked in this environment), a Comfy Cloud Nano Banana Pro
// (GeminiImage2Node) run per row, on a green (#00FF00) chroma-key
// background. targetContentHeightPx: 96 matches the committed idle tile's
// own measured full-tile content height (edge-to-edge, no padding — same
// value ADULT_STRETCH's standing frames were measured against).
export const ADULT_IDLE = {
  rowName: 'idle',
  sourceDir: 'adult-idle',
  frames: 1,
  gridCols: 1,
  gridRows: 1,
  targetContentHeightPx: 96,
};

export function buildAdultIdleSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_IDLE);
}

export const ADULT_WALK = {
  rowName: 'walk',
  sourceDir: 'adult-walk',
  frames: 2,
  gridCols: 2,
  gridRows: 1,
  targetContentHeightPx: 96,
};

export function buildAdultWalkSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_WALK);
}

// throw-stick (BL-9, ONE-SHOT): beaver picks up a stick, winds up, throws
// toward screen-right. Contract: the stick remains fully within the tile in
// every frame (including the release frames, where it's correctly drawn
// mid-air just past the paw, not still gripped) — runtime (#21) must not
// spawn an additional projectile while this row plays. Frame 1 ≈ the idle
// stance; frame 8 settles back toward idle (post-throw follow-through
// acceptable, not a byte match). Reference-conditioned Comfy Cloud Nano
// Banana Pro generation on a green (#00FF00) chroma-key background, same
// 4x2 grid convention as watering/drink/sleep/stretch.
// targetContentHeightPx: 96 matches the committed idle tile's own measured
// full-tile content height — the height term binds here (tallest raw crop
// 344x357 pre-scale), landing at 96x92.5, comfortably under the 96px width
// cap.
export const ADULT_THROW_STICK = {
  rowName: 'throw-stick',
  sourceDir: 'adult-throw-stick',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 96,
};

export function buildAdultThrowStickSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_THROW_STICK);
}

// collect-sticks (BL-9, ONE-SHOT): beaver bends, gathers 2-3 sticks into its
// arms, straightens up holding the bundle. Frame 1 ≈ the idle stance; frame
// 8 is an intentionally NON-idle end pose (standing, holding the bundle
// against its chest) — documented here and in STYLE.md, not a continuity
// bug. Same generation method/gates as throw-stick above.
// Scale-trap check (BL-19/BL-5 precedent): the row's widest raw crop
// (328x292, the two-armed hugging pose) binds the WIDTH term of
// computeStageScale before targetContentHeightPx=96 can be reached — actual
// content height lands at ~85.5px (96/328 width-capped scale), not 96;
// left at 96 to document intent (match idle) rather than hand-tuning to the
// capped value, same convention as ADULT_STRETCH's own scale-trap note.
export const ADULT_COLLECT_STICKS = {
  rowName: 'collect-sticks',
  sourceDir: 'adult-collect-sticks',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 96,
};

export function buildAdultCollectSticksSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_COLLECT_STICKS);
}

// exercise (BL-8, LOOP): beaver lifts a SHORT log overhead like a dumbbell,
// two full reps across 8 frames (chest -> overhead -> chest, twice), settles
// back near frame 1 so it loops seamlessly. Scale-trap check (the reason
// this row's plan called it out explicitly): a wide log would bind
// computeStageScale's WIDTH term and shrink the whole character — the
// accepted generation's widest raw crop is 318x380 (the overhead-lift
// frames, arms+log reaching above the head). At targetContentHeightPx=96
// (the default tile) the HEIGHT term binds fine (no width clipping), but
// the tallest raw content is the ARMS-UP-AND-LOG silhouette, not the
// standing body itself (same shape of trap ADULT_STRETCH's comment
// describes and rejects) — locking the scale off it at 96 undersizes the
// standing body to ~82px, visibly smaller than idle. Fix (parachute-wind
// precedent, BL-19): rowHeight: 128 lets targetContentHeightPx go to 112
// without the width term taking over (96/318=0.3019 vs 112/380=0.2947 —
// HEIGHT still binds, width lands at a max of 93.7px across all 8 frames,
// under the 96px tile) — this scales the standing/chest-height frame (raw
// 318×380 widest crop) to ~96px tall, matching idle's
// own measured full-tile content height, while the overhead frames extend
// up into the taller tile instead of shrinking everything to fit.
export const ADULT_EXERCISE = {
  rowName: 'exercise',
  sourceDir: 'adult-exercise',
  frames: 8,
  gridCols: 4,
  gridRows: 2,
  targetContentHeightPx: 112,
  rowHeight: 128,
};

export function buildAdultExerciseSheet(repoRoot) {
  return buildAdultRowSheet(repoRoot, ADULT_EXERCISE);
}

// CLI names for the single-grid adult rows, keyed the same way STAGES keys
// the multi-animation stages — one ADULT_ROWS entry per row appended this
// way (watering, drink, sleep, stretch, idle, walk, throw-stick,
// collect-sticks, exercise, future items just add a config here).
// adult-speak is deliberately NOT in this map: it has no ComfyUI grid/config
// (buildAdultRowSheet doesn't apply), it's dispatched as its own CLI branch
// below.
const ADULT_ROWS = {
  'adult-watering': ADULT_WATERING,
  'adult-drink': ADULT_DRINK,
  'adult-sleep': ADULT_SLEEP,
  'adult-stretch': ADULT_STRETCH,
  'adult-idle': ADULT_IDLE,
  'adult-throw-stick': ADULT_THROW_STICK,
  'adult-collect-sticks': ADULT_COLLECT_STICKS,
  'adult-exercise': ADULT_EXERCISE,
  'adult-walk': ADULT_WALK,
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const stageArg = process.argv[2] ?? 'baby';
  if (stageArg === 'adult-speak') {
    const { png, meta } = buildAdultSpeakSheet(repoRoot);
    fs.writeFileSync(path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.png'), png);
    fs.writeFileSync(path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.json'), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`appended beaver-adult speak row (${meta.sheetWidth}x${meta.sheetHeight}, mechanical mouth-patch)`);
  } else if (ADULT_ROWS[stageArg]) {
    const rowConfig = ADULT_ROWS[stageArg];
    const { png, meta, scale } = buildAdultRowSheet(repoRoot, rowConfig);
    fs.writeFileSync(path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.png'), png);
    fs.writeFileSync(path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.json'), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`appended beaver-adult ${rowConfig.rowName} row (${meta.sheetWidth}x${meta.sheetHeight}, scale ${scale.toFixed(4)})`);
  } else {
    const config = STAGES[stageArg];
    if (!config) {
      throw new Error(`unknown stage "${stageArg}" (expected one of: ${[...Object.keys(STAGES), ...Object.keys(ADULT_ROWS), 'adult-speak'].join(', ')})`);
    }
    const { png, meta, scales } = buildStageSheet(repoRoot, config);
    const outDir = path.join(repoRoot, 'assets-src', 'baked', config.bakedDirName);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'sheet.png'), png);
    fs.writeFileSync(path.join(outDir, 'sheet.json'), `${JSON.stringify(meta, null, 2)}\n`);
    const scaleStr = Object.entries(scales)
      .map(([k, v]) => `${k}=${v.toFixed(4)}`)
      .join(' ');
    console.log(`wrote ${outDir}/sheet.png (${meta.sheetWidth}x${meta.sheetHeight}), scales: ${scaleStr}`);
  }
}
