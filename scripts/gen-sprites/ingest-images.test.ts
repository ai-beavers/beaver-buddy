import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng, ingestStage, STAGE_SPECS } from './ingest-images.mjs';

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

// BL-12 regression lock: teen-to-right-1-4 is a feet-together, arms-out
// standing pose (confirmed by pixel-diffing it against the other two
// right-facing candidates — it's the outlier, farthest from both), not a
// walk-cycle frame. It previously sat in the walk row, so every other frame
// of the walk cycle read as "stand -> step" while the pet was actively
// moving. Runs unconditionally (no source images needed) so it can't
// silently regress even on a checkout without assets-src/.
describe('teen STAGE_SPECS row assignment (BL-12)', () => {
  const teenSpec = STAGE_SPECS.find((spec) => spec.name === 'beaver-teen');

  it('keeps the standing pose out of the walk row', () => {
    const walkRow = teenSpec?.rows.find((row) => row.name === 'walk');
    expect(walkRow?.files).not.toContain('teen-to-right-1-4.png');
  });

  it('uses the standing pose as idle', () => {
    const idleRow = teenSpec?.rows.find((row) => row.name === 'idle');
    expect(idleRow?.files).toEqual(['teen-to-right-1-4.png']);
  });
});
