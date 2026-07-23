import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADULT, ADULT_COLLECT_STICKS, ADULT_DRINK, ADULT_EXERCISE, ADULT_IDLE, ADULT_SLEEP, ADULT_SPEAK, ADULT_STRETCH, ADULT_THROW_STICK, ADULT_WALK, ADULT_WATERING, BABY, buildAdultCollectSticksSheet, buildAdultDrinkSheet, buildAdultExerciseSheet, buildAdultIdleSheet, buildAdultSleepSheet, buildAdultSpeakSheet, buildAdultStretchSheet, buildAdultThrowStickSheet, buildAdultWalkSheet, buildAdultWateringSheet, buildBabySheet, buildStageSheet } from './ingest-animation-frames.mjs';
import { decodePng, ingestStage } from './ingest-images.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
// Gated per-stage (not just "does assets-src/comfyui exist at all"): a
// clone can have one stage's raw ComfyUI dumps without the other's, and
// buildStageSheet throws ENOENT rather than skipping when a run dir is
// missing — checking each stage's first run dir keeps these opt-in
// pipeline tests from false-failing on a partial local checkout.
const hasBabyComfyui = fs.existsSync(new URL(`../../assets-src/comfyui/${BABY.animations[0].run}`, import.meta.url));
const hasAdultComfyui = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT.animations[0].run}`, import.meta.url));
const hasSourceBeaver = fs.existsSync(new URL('../../assets-src/beaver', import.meta.url));
const hasWateringSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_WATERING.sourceDir}/sheet.png`, import.meta.url));
const hasDrinkSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_DRINK.sourceDir}/sheet.png`, import.meta.url));
const hasSleepSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_SLEEP.sourceDir}/sheet.png`, import.meta.url));
const hasStretchSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_STRETCH.sourceDir}/sheet.png`, import.meta.url));
const hasIdleSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_IDLE.sourceDir}/sheet.png`, import.meta.url));
const hasWalkSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_WALK.sourceDir}/sheet.png`, import.meta.url));
const hasThrowStickSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_THROW_STICK.sourceDir}/sheet.png`, import.meta.url));
const hasCollectSticksSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_COLLECT_STICKS.sourceDir}/sheet.png`, import.meta.url));
const hasExerciseSource = fs.existsSync(new URL(`../../assets-src/comfyui/${ADULT_EXERCISE.sourceDir}/sheet.png`, import.meta.url));
// speak (BL-7) has no ComfyUI source dir to gate on — it's mechanically
// composited from the committed idle tile, so its regeneration test runs
// unconditionally (see below).

// Cumulative y-offset of a row found by name, not position — rows keep
// getting appended after each other (watering, then drink, ...), so no test
// may assume a given row is physically last.
function rowOffset(meta: { tile: number; rows: readonly { name: string; frames: number; height?: number }[] }, rowName: string): number {
  const idx = meta.rows.findIndex((row) => row.name === rowName);
  return meta.rows.slice(0, idx).reduce((sum, row) => sum + (row.height ?? meta.tile), 0);
}

function extractTile(sheet: { width: number; height: number; data: Uint8ClampedArray }, col: number, row: number, tile: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile * tile * 4);
  for (let y = 0; y < tile; y += 1) {
    const srcStart = ((row * tile + y) * sheet.width + col * tile) * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + tile * 4), y * tile * 4);
  }
  return out;
}

// These assertions run against the committed sheet, so they validate the
// shipped artifact even on a clone without the ComfyUI source dumps.
describe('ingest-animation-frames committed sheet', () => {
  const pngPath = new URL('../../assets/sprites/beaver-baby.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-baby.json', import.meta.url);

  it('has the expected row names and frame counts', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { rows: readonly { name: string; frames: number }[] };
    expect(meta.rows).toEqual([
      { name: 'idle', frames: 1 },
      { name: 'walk', frames: 2 },
      { name: 'struggle', frames: 8 },
      { name: 'parachute-wind', frames: 8 },
      { name: 'land', frames: 8 },
    ]);
  });

  it('has non-empty frames in every row', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number }[];
    };
    const png = fs.readFileSync(pngPath);
    const decoded = decodePng(png);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);

    meta.rows.forEach((row, rowIndex) => {
      for (let frame = 0; frame < row.frames; frame += 1) {
        let opaqueCount = 0;
        for (let y = 0; y < meta.tile; y += 1) {
          for (let x = 0; x < meta.tile; x += 1) {
            const alpha = decoded.data[((rowIndex * meta.tile + y) * decoded.width + frame * meta.tile + x) * 4 + 3];
            if (alpha > 0) opaqueCount += 1;
          }
        }
        expect(opaqueCount, `${row.name}[${frame}] is empty`).toBeGreaterThan(0);
      }
    });
  });
});

// These assertions need the ComfyUI run dumps that are gitignored (and
// therefore absent on a fresh clone). They skip gracefully rather than fail.
describe.skipIf(!hasBabyComfyui)('ingest-animation-frames pipeline (baby)', () => {
  it('is deterministic: re-running buildBabySheet is byte-identical', () => {
    const a = buildBabySheet(repoRoot);
    const b = buildBabySheet(repoRoot);
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.meta).toEqual(b.meta);
    expect(a.scales).toEqual(b.scales);
  }, 15_000);

  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildBabySheet(repoRoot);
    const committedPng = fs.readFileSync(new URL('../../assets/sprites/beaver-baby.png', import.meta.url));
    const committedMeta = JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-baby.json', import.meta.url), 'utf8'));

    expect(committedPng.equals(png)).toBe(true);
    expect(committedMeta).toEqual(meta);

    const decoded = decodePng(committedPng);
    expect(decoded.width).toBe(meta.sheetWidth);
    expect(decoded.height).toBe(meta.sheetHeight);
    expect(meta.sheetHeight).toBe(meta.rows.length * meta.tile);
    const maxFrames = Math.max(...meta.rows.map((r) => r.frames));
    expect(meta.sheetWidth).toBe(maxFrames * meta.tile);
  }, 15_000);
});

// Committed-sheet assertions for the adult stage (BL-18), mirroring the baby
// block above: these run against the shipped beaver-adult.png/.json, so they
// validate the promoted artifact even without the ComfyUI source dumps.
describe('ingest-animation-frames committed sheet (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has the expected row names, frame counts, and the taller parachute-wind row', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    // idle/walk/struggle/parachute-wind/land are the golden BL-18 sheet; `type`
    // is appended by ingest-typing.mjs (see ingest-typing); `watering`,
    // `drink`, `sleep`, `stretch`, `speak`, `throw-stick`, `collect-sticks`,
    // and `exercise` are appended by buildAdultWateringSheet /
    // buildAdultDrinkSheet / buildAdultSleepSheet / buildAdultStretchSheet /
    // buildAdultSpeakSheet / buildAdultThrowStickSheet /
    // buildAdultCollectSticksSheet / buildAdultExerciseSheet (see below).
    expect(meta.rows).toEqual([
      { name: 'idle', frames: 1 },
      { name: 'walk', frames: 2 },
      { name: 'struggle', frames: 8 },
      { name: 'parachute-wind', frames: 8, height: 128 },
      { name: 'land', frames: 8 },
      { name: 'type', frames: 8 },
      { name: 'watering', frames: 8 },
      { name: 'drink', frames: 8 },
      { name: 'sleep', frames: 8 },
      { name: 'stretch', frames: 8 },
      { name: 'speak', frames: 8 },
      { name: 'throw-stick', frames: 8 },
      { name: 'collect-sticks', frames: 8 },
      { name: 'exercise', frames: 8, height: 128 },
    ]);
  });

  // Golden rows: 96*4 + 128(parachute-wind) = 512; ingest-typing appends a
  // 96px `type` row → 608; buildAdultWateringSheet appends a 96px `watering`
  // row → 704; buildAdultDrinkSheet appends a 96px `drink` row → 800;
  // buildAdultSleepSheet appends a 96px `sleep` row → 896;
  // buildAdultStretchSheet appends a 96px `stretch` row → 992 (the row's
  // tallest raw content is the standing frames' own tail-to-ear span, shared
  // evenly between arms-up and arms-down poses, so it fits the default 96px
  // tile at targetContentHeightPx 96 with no rowHeight override needed — see
  // STYLE.md provenance); buildAdultSpeakSheet appends a 96px `speak` row →
  // 1088 (default 96px tile, targetContentHeightPx 88);
  // buildAdultThrowStickSheet appends a 96px `throw-stick` row → 1184;
  // buildAdultCollectSticksSheet appends a 96px `collect-sticks` row → 1280
  // (BL-9); buildAdultExerciseSheet appends a 128px `exercise` row → 1408
  // (BL-8) — a rowHeight:128 override (parachute-wind precedent) so
  // targetContentHeightPx can go to 112 without the WIDTH term taking over
  // (96/318=0.3019 vs 112/380=0.2947 — HEIGHT still binds, max content width
  // 93.7px across all 8 frames, under the 96px tile) — this scales the
  // standing/chest-height frames to ~96px tall, matching idle's own
  // full-tile content height, instead of the whole row shrinking to fit the
  // overhead-arms-and-log frames inside a plain 96px tile. Width stays a
  // flat 8-col grid at the 96px tile — only row height varies, never column
  // width.
  it('is a 768x1408 sheet (8 cols at the 96px tile; row heights 96/96/96/128/96/96/96/96/96/96/96/96/96/128)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { tile: number; sheetWidth: number; sheetHeight: number };
    const decoded = decodePng(fs.readFileSync(pngPath));
    expect(decoded.width).toBe(768);
    expect(decoded.height).toBe(1408);
    expect(meta.sheetWidth).toBe(768);
    expect(meta.sheetHeight).toBe(1408);
  });

  it('has non-empty frames in every row, at each row cumulative y-offset', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));

    let originY = 0;
    meta.rows.forEach((row) => {
      const rowHeight = row.height ?? meta.tile;
      for (let frame = 0; frame < row.frames; frame += 1) {
        let opaqueCount = 0;
        for (let y = 0; y < rowHeight; y += 1) {
          for (let x = 0; x < meta.tile; x += 1) {
            const alpha = decoded.data[((originY + y) * decoded.width + frame * meta.tile + x) * 4 + 3];
            if (alpha > 0) opaqueCount += 1;
          }
        }
        expect(opaqueCount, `${row.name}[${frame}] is empty`).toBeGreaterThan(0);
      }
      originY += rowHeight;
    });
  });
});

// Same pipeline coverage as baby, gated on the adult run dirs specifically.
describe.skipIf(!hasAdultComfyui)('ingest-animation-frames pipeline (adult)', () => {
  it('is deterministic: re-running buildStageSheet(ADULT) is byte-identical', () => {
    const a = buildStageSheet(repoRoot, ADULT);
    const b = buildStageSheet(repoRoot, ADULT);
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.meta).toEqual(b.meta);
  }, 15_000);

  // The committed sheet is the golden build (this) with a `type` row (by
  // ingest-typing.mjs), a `watering` row (by buildAdultWateringSheet), and a
  // `drink` row (by buildAdultDrinkSheet) appended after it, so the golden
  // block must match byte-for-byte at the top of the committed sheet and its
  // rows must be the committed sheet's leading rows. The appended rows
  // themselves are covered by ingest-typing.test and the watering/drink
  // blocks below.
  it('committed adult sheet (golden block) matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildStageSheet(repoRoot, ADULT);
    const golden = decodePng(png);
    const committed = decodePng(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)));
    const committedMeta = JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8')) as {
      rows: readonly { name: string; frames: number }[];
    };

    // Golden block is the top of the committed sheet (same width).
    expect(committed.width).toBe(golden.width);
    const goldenBytes = Buffer.from(golden.data.buffer, golden.data.byteOffset, golden.data.length);
    const committedBlock = Buffer.from(
      committed.data.buffer,
      committed.data.byteOffset,
      golden.width * golden.height * 4,
    );
    expect(committedBlock.equals(goldenBytes)).toBe(true);
    expect(committedMeta.rows.slice(0, meta.rows.length)).toEqual(meta.rows);
    expect(committedMeta.rows.find((row) => row.name === 'type')).toMatchObject({ name: 'type', frames: 8 });
    expect(committedMeta.rows.find((row) => row.name === 'watering')).toMatchObject({ name: 'watering', frames: 8 });
    expect(committedMeta.rows.find((row) => row.name === 'drink')).toMatchObject({ name: 'drink', frames: 8 });
    expect(committedMeta.rows.find((row) => row.name === 'sleep')).toMatchObject({ name: 'sleep', frames: 8 });
    expect(committedMeta.rows.find((row) => row.name === 'stretch')).toMatchObject({ name: 'stretch', frames: 8 });
    expect(committedMeta.rows.find((row) => row.name === 'speak')).toMatchObject({ name: 'speak', frames: 8 });
  }, 15_000);
});

// Lock: the new parachute sheet preserves idle/walk byte-for-byte from the
// old still-frame pipeline. This only runs when the original source images
// are present, because the comparison is against the old still-frame build.
describe.skipIf(!hasSourceBeaver || !hasBabyComfyui)('ingest-animation-frames idle/walk preservation', () => {
  it('idle and walk tiles are byte-identical to the old beaver-baby build', () => {
    const { png: newPng } = buildBabySheet(repoRoot);
    const newSheet = decodePng(newPng);

    // Old spec mirrors what used to be in STAGE_SPECS before BL-17.
    const oldBabySpec = {
      name: 'beaver-baby',
      tile: 96,
      fps: 8,
      targetContentHeightPx: 72,
      rows: [
        { name: 'idle', files: ['baby-idle-right.png'] },
        { name: 'walk', files: ['baby-to-right-1.png', 'baby-to-right-2.png'] },
      ],
    } as const;

    const { png: oldPng } = ingestStage(oldBabySpec, fileURLToPath(new URL('../../assets-src/beaver', import.meta.url)));
    const oldSheet = decodePng(oldPng);

    const newIdle = extractTile(newSheet, 0, 0, 96);
    const oldIdle = extractTile(oldSheet, 0, 0, 96);
    expect(Buffer.from(newIdle).equals(Buffer.from(oldIdle))).toBe(true);

    const newWalk0 = extractTile(newSheet, 0, 1, 96);
    const oldWalk0 = extractTile(oldSheet, 0, 1, 96);
    expect(Buffer.from(newWalk0).equals(Buffer.from(oldWalk0))).toBe(true);

    const newWalk1 = extractTile(newSheet, 1, 1, 96);
    const oldWalk1 = extractTile(oldSheet, 1, 1, 96);
    expect(Buffer.from(newWalk1).equals(Buffer.from(oldWalk1))).toBe(true);
  }, 15_000);
});

// Watering row: committed-sheet assertions run on every checkout; the
// byte-for-byte regeneration check needs the gitignored raw grid dump and
// skips gracefully without it (same convention as the other pipeline
// blocks above and ingest-typing.test.ts).
describe('ingest-animation-frames watering row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a watering row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'watering');
    expect(row).toEqual({ name: 'watering', frames: 8 });
  });

  it('every watering frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'watering');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at watering[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `watering[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `watering[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasWateringSource)('ingest-animation-frames watering regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultWateringSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultWateringSheet(repoRoot).png.equals(buildAdultWateringSheet(repoRoot).png)).toBe(true);
  });
});

// Drink row (BL-3): same committed-sheet + gated-regeneration convention as
// the watering block above, via the generalized buildAdultRowSheet config.
describe('ingest-animation-frames drink row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a drink row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'drink');
    expect(row).toEqual({ name: 'drink', frames: 8 });
  });

  it('every drink frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'drink');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at drink[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `drink[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `drink[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasDrinkSource)('ingest-animation-frames drink regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultDrinkSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultDrinkSheet(repoRoot).png.equals(buildAdultDrinkSheet(repoRoot).png)).toBe(true);
  });
});

// Sleep row (BL-4): same committed-sheet + gated-regeneration convention as
// the watering/drink blocks above, via the shared buildAdultRowSheet config.
// Sleep is a loop-only row (curled idle + breathing + pulsing zzz), no
// settle/lie-down transition frame.
describe('ingest-animation-frames sleep row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a sleep row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'sleep');
    expect(row).toEqual({ name: 'sleep', frames: 8 });
  });

  it('every sleep frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'sleep');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at sleep[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `sleep[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `sleep[${frame}] not grounded`).toBe(true);
    }
  });

  // BL-5 handoff: assets-src/reference/adult-sleep-pose.png is a curated,
  // committed copy of sleep frame index 7 (frame 8 of 8 — the pose with the
  // fewest/faintest zzz wisps, so BL-5's wake-up generation doesn't condition
  // on particle art) so it must stay pixel-identical to that frame forever,
  // not just at generation time.
  it('the committed BL-5 reference tile is pixel-identical to sleep frame index 7', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'sleep');
    const { tile } = meta;
    const frameIndex = 7;

    const reference = decodePng(fs.readFileSync(new URL('../../assets-src/reference/adult-sleep-pose.png', import.meta.url)));
    expect(reference.width).toBe(tile);
    expect(reference.height).toBe(tile);

    for (let y = 0; y < tile; y += 1) {
      for (let x = 0; x < tile; x += 1) {
        const si = ((originY + y) * decoded.width + frameIndex * tile + x) * 4;
        const di = (y * tile + x) * 4;
        expect(reference.data[di]).toBe(decoded.data[si]);
        expect(reference.data[di + 1]).toBe(decoded.data[si + 1]);
        expect(reference.data[di + 2]).toBe(decoded.data[si + 2]);
        expect(reference.data[di + 3]).toBe(decoded.data[si + 3]);
      }
    }
  });
});

describe.skipIf(!hasSleepSource)('ingest-animation-frames sleep regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultSleepSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultSleepSheet(repoRoot).png.equals(buildAdultSleepSheet(repoRoot).png)).toBe(true);
  });
});

// Stretch row (BL-5): same committed-sheet + gated-regeneration convention as
// watering/drink/sleep above, via the shared buildAdultRowSheet config.
// Stretch is a ONE-SHOT wake-up transition (like `land`), not a loop — no
// wraparound gate; frame1-vs-sleep-pose and frame8-vs-idle continuity are
// checked as side-by-side diffs (eyeballed, saved under scratch — not
// committed here), not a pixel-identity assertion, since frame 1 is newly
// generated art conditioned on the sleep pose, not a copy of it.
describe('ingest-animation-frames stretch row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a stretch row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'stretch');
    expect(row).toEqual({ name: 'stretch', frames: 8 });
  });

  it('every stretch frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'stretch');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at stretch[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `stretch[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `stretch[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasStretchSource)('ingest-animation-frames stretch regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultStretchSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultStretchSheet(repoRoot).png.equals(buildAdultStretchSheet(repoRoot).png)).toBe(true);
  });
});

// Speak row (BL-7, redone): a first attempt generated a full 8-frame AI
// grid (same convention as watering/drink/sleep/stretch) and FAILED the
// design gate — independent per-frame generations redrew the tail/pose/
// shading, reading as whole-body flicker rather than a talking mouth (see
// git history and the superseded docs/design-reviews/BL-7-speak-verdict.md
// entry). The redo derives every frame MECHANICALLY from the committed idle
// tile, patching only ADULT_SPEAK.mouthBox — so the real invariant to test
// isn't "is the wraparound delta plausible" (that passed the broken art
// too), it's "are the two derived states byte-identical to their source
// outside the patched box", which is now directly provable.
describe('ingest-animation-frames speak row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  function readMeta() {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
  }

  function extractFrame(decoded: ReturnType<typeof decodePng>, originY: number, tile: number, frame: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(tile * tile * 4);
    for (let y = 0; y < tile; y += 1) {
      const srcStart = ((originY + y) * decoded.width + frame * tile) * 4;
      out.set(decoded.data.subarray(srcStart, srcStart + tile * 4), y * tile * 4);
    }
    return out;
  }

  it('has a speak row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const row = readMeta().rows.find((r) => r.name === 'speak');
    expect(row).toEqual({ name: 'speak', frames: 8 });
  });

  it('idle-tile-derived frames (2, 3, 4, 6, 7, 8 — 1-indexed) are byte-identical to the committed idle tile', () => {
    const meta = readMeta();
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'speak');
    const { tile } = meta;
    const idle = extractFrame(decoded, 0, tile, 0); // idle row is always frame 0 at sheet origin

    for (const frame of [1, 2, 3, 5, 6, 7]) {
      const f = extractFrame(decoded, originY, tile, frame);
      expect(Buffer.from(f).equals(Buffer.from(idle)), `speak[${frame}] (closed) should equal the idle tile`).toBe(true);
    }
  });

  // The real jitter invariant (this is what the discarded AI-grid approach
  // could never guarantee): for every adjacent frame pair, including the
  // 8->1 wraparound, every pixel OUTSIDE the mouth patch box must be
  // BYTE-IDENTICAL — not just "similar", zero tolerance. This is only
  // provable because every frame derives from one shared base tile.
  it('every adjacent frame pair (including 8->1) is byte-identical outside the mouth box — zero body jitter', () => {
    const meta = readMeta();
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'speak');
    const { tile } = meta;
    const { x0, y0, x1, y1 } = ADULT_SPEAK.mouthBox;

    function diffOutsideBox(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
      let n = 0;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
          const i = (y * tile + x) * 4;
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n += 1;
        }
      }
      return n;
    }

    const frames = Array.from({ length: 8 }, (_, i) => extractFrame(decoded, originY, tile, i));
    for (let i = 0; i < 8; i += 1) {
      const next = (i + 1) % 8; // wraps 8->1 at i=7
      expect(diffOutsideBox(frames[i], frames[next]), `frame ${i + 1}->${next + 1} differs outside the mouth box`).toBe(0);
    }
  });
});

// speak has no ComfyUI source dir — buildAdultSpeakSheet only reads the
// already-committed idle tile, so its regeneration check has nothing to
// gate on and always runs.
describe('ingest-animation-frames speak regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultSpeakSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultSpeakSheet(repoRoot).png.equals(buildAdultSpeakSheet(repoRoot).png)).toBe(true);
  });
});

// Final idle/walk (BL-6/T3): the teen-upscale placeholder rows are replaced
// with reference-conditioned Comfy art via the same buildAdultRowSheet/
// spliceRow path as watering/drink/sleep/stretch above. This is the
// owner-taste item (BL-18 golden art was rejected as generic/off-model and
// reverted to the placeholder) — the committed idle/walk bytes below are the
// ONLY art this repo's history has ever passed the continuity gate on, so
// they're pinned unconditionally (no gating on assets-src/, unlike the
// regeneration block below): a future `assets:adult-placeholder` re-run
// would silently clobber these rows with the teen upscale again, and this
// hash pin is what turns that accidental commit into a failing test instead
// of a silent regression. See assets/STYLE.md provenance for the generation
// details (single-reference Comfy Cloud Nano Banana Pro run, conditioned on
// the adult reference image every other adult row is already anchored to).
describe('ingest-animation-frames idle/walk (adult, final art — BL-6/T3)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  function sha256(bytes: Uint8ClampedArray): string {
    return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  }

  it('idle/walk frame counts are unchanged by the promotion (still 1/2, no tile-height override)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { rows: readonly { name: string; frames: number; height?: number }[] };
    expect(meta.rows[0]).toEqual({ name: 'idle', frames: 1 });
    expect(meta.rows[1]).toEqual({ name: 'walk', frames: 2 });
  });

  it('pins the committed idle/walk tile bytes so an accidental assets:adult-placeholder re-run fails CI', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { tile: number; rows: readonly { name: string; frames: number; height?: number }[] };
    const decoded = decodePng(fs.readFileSync(pngPath));

    const idle = extractTile(decoded, 0, 0, meta.tile);
    const walk0 = extractTile(decoded, 0, 1, meta.tile);
    const walk1 = extractTile(decoded, 1, 1, meta.tile);

    // Pinned 2026-07-22 at promotion time (BL-6/T3). Bump ONLY on a
    // deliberate, gated regeneration (see the block below) that was itself
    // re-run through the continuity gate — never on an accidental rerun of
    // the retired placeholder script.
    expect(sha256(idle)).toBe('70271fd9ac013c29f70b837369483154ce8fcc65ad3b0d3ac6e5534f0db7ec78');
    expect(sha256(walk0)).toBe('64e359cdfc08a2a303e0eb96aa89a45cc992ccab571573abdc05220dce37487f');
    expect(sha256(walk1)).toBe('3df9c976efd1e14bf72ebb131a58f94f54a5936a0cab765f6f79adeedcee0177');
  });
});

describe.skipIf(!hasIdleSource)('ingest-animation-frames idle regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultIdleSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultIdleSheet(repoRoot).png.equals(buildAdultIdleSheet(repoRoot).png)).toBe(true);
  });
});

describe.skipIf(!hasWalkSource)('ingest-animation-frames walk regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultWalkSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultWalkSheet(repoRoot).png.equals(buildAdultWalkSheet(repoRoot).png)).toBe(true);
  });
});

// Throw-stick row (BL-9): a ONE-SHOT (not a loop) reference-conditioned
// generation, same green-chroma-key 4x2 grid convention as
// watering/drink/sleep/stretch. Unlike speak (a still body with a patched
// mouth box), this is a dynamic full-body action row — BODY MOTION BETWEEN
// FRAMES IS EXPECTED here (winding up, throwing, following through), so the
// gate is pose COHERENCE (same character, same tail side, no palette
// drift/redraw-flicker in static parts like head shape/fur color), not
// frame-to-frame pixel identity like ADULT_SPEAK's mouth-patch invariant.
// Checked by eyeball against the committed contact sheet + 8fps GIF
// (docs/design-reviews/BL-9-throw-stick-contact.png /
// BL-9-throw-stick.gif) per the BL-7 lesson (independent-cell generations
// can silently flip tail side / drift shading) — no automated per-pixel
// assertion can substitute for that eyeball check on a dynamic-motion row.
describe('ingest-animation-frames throw-stick row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a throw-stick row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'throw-stick');
    expect(row).toEqual({ name: 'throw-stick', frames: 8 });
  });

  it('every throw-stick frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'throw-stick');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at throw-stick[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `throw-stick[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `throw-stick[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasThrowStickSource)('ingest-animation-frames throw-stick regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultThrowStickSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultThrowStickSheet(repoRoot).png.equals(buildAdultThrowStickSheet(repoRoot).png)).toBe(true);
  });
});

// Collect-sticks row (BL-9): same one-shot/dynamic-motion convention as
// throw-stick above. Frame 8 is an intentionally NON-idle end pose (beaver
// standing, holding the gathered stick bundle against its chest) — this is
// documented intent (STYLE.md), not a continuity bug, so no test asserts a
// return-to-idle on the final frame.
describe('ingest-animation-frames collect-sticks row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has a collect-sticks row, found by name, 8 frames, 96px tall (no over-tile pose)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'collect-sticks');
    expect(row).toEqual({ name: 'collect-sticks', frames: 8 });
  });

  it('every collect-sticks frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'collect-sticks');
    const { tile } = meta;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at collect-sticks[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `collect-sticks[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `collect-sticks[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasCollectSticksSource)('ingest-animation-frames collect-sticks regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultCollectSticksSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultCollectSticksSheet(repoRoot).png.equals(buildAdultCollectSticksSheet(repoRoot).png)).toBe(true);
  });
});

// exercise (BL-8): a LOOP (unlike throw-stick/collect-sticks, which are
// ONE-SHOT) — two full log-lift reps across 8 frames, frame 8 settling back
// near frame 1 so it loops seamlessly. Same pose-COHERENCE gate as
// throw-stick/collect-sticks (dynamic full-body motion is expected; the
// BL-7 lesson is about independent-cell body/tail/palette drift, not
// frame-to-frame pixel identity) plus a prop-coherence check specific to
// this row: the log's length/diameter must read as constant and the beaver
// must keep two-paw contact with it in every frame, with no paw/log/body
// intersections — checked by eyeball against the committed contact sheet +
// 8fps GIF + a dedicated wraparound (frame 8 vs frame 1) comparison, per
// docs/design-reviews/BL-8-exercise-verdict.md.
describe('ingest-animation-frames exercise row (adult)', () => {
  const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
  const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

  it('has an exercise row, found by name, 8 frames, 128px tall (rowHeight override, parachute-wind precedent)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const row = meta.rows.find((r) => r.name === 'exercise');
    expect(row).toEqual({ name: 'exercise', frames: 8, height: 128 });
  });

  it('every exercise frame has content, is grounded, and has no surviving green', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as {
      tile: number;
      rows: readonly { name: string; frames: number; height?: number }[];
    };
    const decoded = decodePng(fs.readFileSync(pngPath));
    const originY = rowOffset(meta, 'exercise');
    const { tile } = meta;
    const rowHeight = meta.rows.find((r) => r.name === 'exercise')?.height ?? tile;

    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < rowHeight; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((originY + y) * decoded.width + originX + x) * 4;
          const alpha = decoded.data[i + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === rowHeight - 1) bottomOpaque = true;
            const r = decoded.data[i];
            const g = decoded.data[i + 1];
            const b = decoded.data[i + 2];
            expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at exercise[${frame}] ${x},${y}`).toBe(false);
          }
        }
      }
      expect(opaque, `exercise[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `exercise[${frame}] not grounded`).toBe(true);
    }
  });
});

describe.skipIf(!hasExerciseSource)('ingest-animation-frames exercise regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultExerciseSheet(repoRoot);
    expect(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultExerciseSheet(repoRoot).png.equals(buildAdultExerciseSheet(repoRoot).png)).toBe(true);
  });
});
