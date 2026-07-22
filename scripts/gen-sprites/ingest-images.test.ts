import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chromaKeyGreen, decodePng, extractGridCell, ingestStage, STAGE_SPECS } from './ingest-images.mjs';

// assets-src/ is gitignored (CLAUDE.md: no raw image-gen intermediates
// committed) — a fresh clone has no source images to ingest, so this whole
// suite skips rather than fails when the directory is absent.
const srcDir = fileURLToPath(new URL('../../assets-src/beaver', import.meta.url));
const hasSources = fs.existsSync(srcDir);

describe.skipIf(!hasSources)('ingest-images', () => {
  describe.each(STAGE_SPECS)('$name', (stageSpec) => {
    it('is deterministic: re-running ingest on the same inputs is byte-identical', () => {
      const a = ingestStage(stageSpec, srcDir);
      const b = ingestStage(stageSpec, srcDir);
      expect(a.png.equals(b.png)).toBe(true);
      expect(a.meta).toEqual(b.meta);
    });

    it('committed sheet matches the ingest output byte-for-byte, and its dimensions match the committed JSON', () => {
      const { png, meta } = ingestStage(stageSpec, srcDir);
      const pngPath = new URL(`../../assets/sprites/${stageSpec.name}.png`, import.meta.url);
      const metaPath = new URL(`../../assets/sprites/${stageSpec.name}.json`, import.meta.url);
      const committedPng = fs.readFileSync(pngPath);
      const committedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as typeof meta;

      expect(committedPng.equals(png)).toBe(true);
      expect(committedMeta).toEqual(meta);

      const decoded = decodePng(committedPng);
      expect(decoded.width).toBe(committedMeta.sheetWidth);
      expect(decoded.height).toBe(committedMeta.sheetHeight);
      expect(committedMeta.sheetHeight).toBe(committedMeta.rows.length * committedMeta.tile);
      const maxFrames = Math.max(...committedMeta.rows.map((r) => r.frames));
      expect(committedMeta.sheetWidth).toBe(maxFrames * committedMeta.tile);
    });

    it('every frame has opaque content, and each row is grounded (some frame touches the tile bottom)', () => {
      const { png, meta } = ingestStage(stageSpec, srcDir);
      const decoded = decodePng(png);
      const { tile } = meta;

      meta.rows.forEach((row, rowIndex) => {
        let anyBottomRowOpaque = false;
        for (let frame = 0; frame < row.frames; frame += 1) {
          const originX = frame * tile;
          const originY = rowIndex * tile;
          let opaqueCount = 0;
          for (let y = 0; y < tile; y += 1) {
            for (let x = 0; x < tile; x += 1) {
              const alpha = decoded.data[((originY + y) * decoded.width + originX + x) * 4 + 3];
              if (alpha > 0) {
                opaqueCount += 1;
                if (y === tile - 1) anyBottomRowOpaque = true;
              }
            }
          }
          expect(opaqueCount, `${stageSpec.name}.${row.name}[${frame}] is empty`).toBeGreaterThan(0);
        }
        // "Feet grounded" is a per-row property (every frame shares the same
        // bottom-alignment rule from placeOnTile), checked as "at least one
        // frame's bottom pixel row is opaque" rather than every frame — a
        // walk-cycle frame's silhouette can legitimately lift a paw/tail off
        // the tile's very last pixel row without the placement being wrong.
        expect(anyBottomRowOpaque, `${stageSpec.name}.${row.name}: no frame touches the tile bottom`).toBe(true);
      });
    });
  });
});

// Regression lock: the walk row must contain step frames only — the idle
// pose in the walk cycle read as a stutter-step while the pet was moving
// (BL-11/BL-12 both shipped a version of that bug via mislabeled source
// files). With the corrected source naming, this reduces to: idle rows use
// only *-idle-* files, walk rows use only *-to-* files. Runs
// unconditionally (no source images needed) so it can't silently regress
// even on a checkout without assets-src/.
// Synthetic, in-memory RGBA fixtures — no gitignored source images needed,
// so these run unconditionally on every checkout/CI.
describe('chromaKeyGreen', () => {
  it('keys a pure #00FF00 pixel to transparent, and leaves near-green white detail opaque', () => {
    // 3 pixels: pure green, white (eye-shine style detail), brown fur.
    const data = Uint8ClampedArray.from([
      0, 255, 0, 255,
      255, 255, 255, 255,
      120, 80, 40, 255,
    ]);
    const out = chromaKeyGreen({ width: 3, height: 1, data });
    expect(out.data[3]).toBe(0); // green pixel keyed out
    expect(out.data[7]).toBe(255); // white detail untouched
    expect(out.data[11]).toBe(255); // brown fur untouched
    // Non-alpha channels of the keyed pixel are left as-is (only alpha changes).
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([0, 255, 0]);
  });

  it('leaves a pixel where green does not clearly dominate red/blue opaque', () => {
    // Grey-green, g not > r*1.3 and not > b*1.3 — should survive.
    const data = Uint8ClampedArray.from([100, 110, 100, 255]);
    const out = chromaKeyGreen({ width: 1, height: 1, data });
    expect(out.data[3]).toBe(255);
  });
});

describe('extractGridCell', () => {
  it('slices a cell whose content matches the source region', () => {
    // 2x2 grid over a 4x4 image; each pixel's R/G channel encodes its
    // column/row so a sliced cell's content can be checked directly.
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = x;
        data[i + 1] = y;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    const cell = extractGridCell({ width, height, data }, 1, 1, 2, 2);
    expect(cell.width).toBe(2);
    expect(cell.height).toBe(2);
    // Cell (1,1) of a 2x2 grid over a 4x4 image covers source x=2..3, y=2..3.
    expect(cell.data[0]).toBe(2); // top-left of cell -> source (2,2)
    expect(cell.data[1]).toBe(2);
    const bottomRight = ((cell.height - 1) * cell.width + (cell.width - 1)) * 4;
    expect(cell.data[bottomRight]).toBe(3); // bottom-right of cell -> source (3,3)
    expect(cell.data[bottomRight + 1]).toBe(3);
  });

  it('non-integral cell boundaries still tile the full sheet with no gap or overlap', () => {
    // 10px wide, 3 columns: cell widths round to 3/3/4, summing back to 10.
    const width = 10;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const img = { width, height, data };
    const widths = [0, 1, 2].map((col) => extractGridCell(img, col, 0, 3, 1).width);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(width);
    expect(widths.every((w) => w > 0)).toBe(true);
  });
});

describe('STAGE_SPECS row assignment (BL-12)', () => {
  it.each(STAGE_SPECS)('$name: idle row uses idle files, walk row uses step files', (stageSpec) => {
    const idleRow = stageSpec.rows.find((row) => row.name === 'idle');
    const walkRow = stageSpec.rows.find((row) => row.name === 'walk');
    for (const file of idleRow?.files ?? []) expect(file).toMatch(/-idle-right\.png$/);
    for (const file of walkRow?.files ?? []) expect(file).toMatch(/-to-right-\d\.png$/);
  });
});
