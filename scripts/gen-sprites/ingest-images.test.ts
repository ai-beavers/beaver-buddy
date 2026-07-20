import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng, ingestStage, STAGE_SPECS } from './ingest-images.mjs';

// assets-src/ is gitignored (CLAUDE.md: no raw image-gen intermediates
// committed) — a fresh clone has no source images to ingest, so these tests
// skip rather than fail when a given stage's source files are absent.
// Gated per-stage-spec (not just "does assets-src/beaver exist at all"): a
// checkout can have one stage's source images without another's (e.g. only
// the adult golden frames staged, no teen source art).
const srcDir = fileURLToPath(new URL('../../assets-src/beaver', import.meta.url));
function hasSpecSources(stageSpec: (typeof STAGE_SPECS)[number]): boolean {
  return stageSpec.rows.every((row) => row.files.every((file) => fs.existsSync(path.join(srcDir, file))));
}

// Compares a stage spec's own idle/walk tiles against the same region of the
// committed sheet — not a full-sheet byte comparison, because beaver-adult's
// committed sheet carries additional rows (struggle/parachute-wind/land)
// appended afterwards by ingest-animation-frames.mjs; the ingest-images.mjs
// output only ever covers the idle/walk rows this spec declares.
function extractTile(sheet: ReturnType<typeof decodePng>, tile: number, col: number, row: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile * tile * 4);
  for (let y = 0; y < tile; y += 1) {
    const srcStart = ((row * tile + y) * sheet.width + col * tile) * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + tile * 4), y * tile * 4);
  }
  return out;
}

describe('ingest-images', () => {
  describe.each(STAGE_SPECS)('$name', (stageSpec) => {
    describe.skipIf(!hasSpecSources(stageSpec))('with source images present', () => {
      it('is deterministic: re-running ingest on the same inputs is byte-identical', () => {
        const a = ingestStage(stageSpec, srcDir);
        const b = ingestStage(stageSpec, srcDir);
        expect(a.png.equals(b.png)).toBe(true);
        expect(a.meta).toEqual(b.meta);
      });

      it('committed sheet matches the ingest output tile-for-tile (idle/walk rows)', () => {
        const { png, meta } = ingestStage(stageSpec, srcDir);
        const pngPath = new URL(`../../assets/sprites/${stageSpec.name}.png`, import.meta.url);
        const metaPath = new URL(`../../assets/sprites/${stageSpec.name}.json`, import.meta.url);
        const committedPng = fs.readFileSync(pngPath);
        const committedMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as typeof meta;

        const decoded = decodePng(png);
        const committedDecoded = decodePng(committedPng);
        expect(committedMeta.tile).toBe(meta.tile);

        meta.rows.forEach((row, rowIndex) => {
          expect(committedMeta.rows[rowIndex]).toEqual(row);
          for (let frame = 0; frame < row.frames; frame += 1) {
            const built = extractTile(decoded, meta.tile, frame, rowIndex);
            const committed = extractTile(committedDecoded, meta.tile, frame, rowIndex);
            expect(Buffer.from(committed).equals(Buffer.from(built)), `${stageSpec.name}.${row.name}[${frame}]`).toBe(true);
          }
        });

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
});

// Regression lock: the walk row must contain step frames only — the idle
// pose in the walk cycle read as a stutter-step while the pet was moving
// (BL-11/BL-12 both shipped a version of that bug via mislabeled source
// files). With the corrected source naming, this reduces to: idle rows use
// only *-idle-* files, walk rows use only *-to-* files. Runs
// unconditionally (no source images needed) so it can't silently regress
// even on a checkout without assets-src/.
describe('STAGE_SPECS row assignment (BL-12)', () => {
  it.each(STAGE_SPECS)('$name: idle row uses idle files, walk row uses step files', (stageSpec) => {
    const idleRow = stageSpec.rows.find((row) => row.name === 'idle');
    const walkRow = stageSpec.rows.find((row) => row.name === 'walk');
    for (const file of idleRow?.files ?? []) expect(file).toMatch(/-idle-right\.png$/);
    for (const file of walkRow?.files ?? []) expect(file).toMatch(/-to-right-\d\.png$/);
  });
});
