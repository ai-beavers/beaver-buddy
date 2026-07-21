import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADULT, BABY, buildBabySheet, buildStageSheet } from './ingest-animation-frames.mjs';
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
    // idle/walk/struggle/parachute-wind/land are the golden BL-18 sheet; the
    // trailing `type` row is appended by ingest-typing.mjs (see ingest-typing).
    expect(meta.rows).toEqual([
      { name: 'idle', frames: 1 },
      { name: 'walk', frames: 2 },
      { name: 'struggle', frames: 8 },
      { name: 'parachute-wind', frames: 8, height: 128 },
      { name: 'land', frames: 8 },
      { name: 'type', frames: 8 },
    ]);
  });

  // Golden rows: 96*4 + 128(parachute-wind) = 512; ingest-typing appends a
  // 96px `type` row → 608. Width stays a flat 8-col grid at the 96px tile —
  // only row height varies, never column width.
  it('is a 768x608 sheet (8 cols at the 96px tile; row heights 96/96/96/128/96/96)', () => {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { tile: number; sheetWidth: number; sheetHeight: number };
    const decoded = decodePng(fs.readFileSync(pngPath));
    expect(decoded.width).toBe(768);
    expect(decoded.height).toBe(608);
    expect(meta.sheetWidth).toBe(768);
    expect(meta.sheetHeight).toBe(608);
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

  // The committed sheet is the golden build (this) with a `type` row appended
  // by ingest-typing.mjs, so the golden block must match byte-for-byte at the
  // top of the committed sheet and its rows must be the committed sheet's
  // leading rows. The appended type row itself is covered by ingest-typing.test.
  it('committed adult sheet (golden block) matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildStageSheet(repoRoot, ADULT);
    const golden = decodePng(png);
    const committed = decodePng(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.png', import.meta.url)));
    const committedMeta = JSON.parse(fs.readFileSync(new URL('../../assets/sprites/beaver-adult.json', import.meta.url), 'utf8')) as {
      rows: readonly unknown[];
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
    expect(committedMeta.rows[committedMeta.rows.length - 1]).toMatchObject({ name: 'type', frames: 8 });
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
