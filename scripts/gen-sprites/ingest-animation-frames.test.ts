import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADULT, ADULT_DRINK, ADULT_SLEEP, ADULT_STRETCH, ADULT_WATERING, BABY, buildAdultDrinkSheet, buildAdultSleepSheet, buildAdultStretchSheet, buildAdultWateringSheet, buildBabySheet, buildStageSheet } from './ingest-animation-frames.mjs';
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
    // `drink`, `sleep`, and `stretch` are appended by buildAdultWateringSheet /
    // buildAdultDrinkSheet / buildAdultSleepSheet / buildAdultStretchSheet
    // (see below).
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
  // STYLE.md provenance). Width stays a flat 8-col grid at the 96px tile —
  // only row height varies, never column width.
  it('is a 768x992 sheet (8 cols at the 96px tile; row heights 96/96/96/128/96/96/96/96/96/96)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { tile: number; sheetWidth: number; sheetHeight: number };
    const decoded = decodePng(fs.readFileSync(pngPath));
    expect(decoded.width).toBe(768);
    expect(decoded.height).toBe(992);
    expect(meta.sheetWidth).toBe(768);
    expect(meta.sheetHeight).toBe(992);
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
// checked as side-by-side diffs (eyeballed, saved under the scratchpad
// contact-sheets dir per the plan), not a pixel-identity assertion, since
// frame 1 is newly generated art conditioned on the sleep pose, not a copy
// of it.
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
