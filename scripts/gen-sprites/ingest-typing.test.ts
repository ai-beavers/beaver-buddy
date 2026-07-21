import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from './ingest-images.mjs';
import { buildAdultTypeSheet } from './ingest-typing.mjs';

// The green source sheet is a gitignored raw ComfyUI dump; the byte-for-byte
// regeneration checks only run where it's present (same convention as
// ingest-animation-frames.test.ts). The committed-artifact checks below have no
// source dependency and run on every checkout.
const hasSource = fs.existsSync(new URL('../../assets-src/comfyui/adult-type/sheet.png', import.meta.url));

const pngPath = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
const metaPath = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

interface Meta {
  tile: number;
  fps: number;
  sheetWidth: number;
  sheetHeight: number;
  rows: readonly { name: string; frames: number; height?: number }[];
}

describe('ingest-typing committed sheet', () => {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Meta;
  // The type row is the last row and is one TILE tall, so it sits at the very
  // bottom of the sheet — that top edge is correct even though earlier rows
  // (parachute-wind) are taller than the base tile.
  const typeTopY = meta.sheetHeight - meta.tile;

  it('appends a type row of 8 frames to the golden adult sheet', () => {
    expect(meta.rows.map((row) => row.name)).toEqual(['idle', 'walk', 'struggle', 'parachute-wind', 'land', 'type']);
    expect(meta.rows[meta.rows.length - 1]).toMatchObject({ name: 'type', frames: 8 });
  });

  it('sheet dimensions match the meta', () => {
    const decoded = decodePng(fs.readFileSync(pngPath));
    expect(decoded.width).toBe(meta.sheetWidth);
    expect(decoded.height).toBe(meta.sheetHeight);
  });

  it('every type frame has content and is grounded (touches the tile bottom)', () => {
    const decoded = decodePng(fs.readFileSync(pngPath));
    const { tile } = meta;
    for (let frame = 0; frame < 8; frame += 1) {
      const originX = frame * tile;
      let opaque = 0;
      let bottomOpaque = false;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const alpha = decoded.data[((typeTopY + y) * decoded.width + originX + x) * 4 + 3];
          if (alpha > 0) {
            opaque += 1;
            if (y === tile - 1) bottomOpaque = true;
          }
        }
      }
      expect(opaque, `type[${frame}] is empty`).toBeGreaterThan(0);
      expect(bottomOpaque, `type[${frame}] not grounded`).toBe(true);
    }
  });

  it('keys out the green screen: no pure-green pixels survive in the type row', () => {
    const decoded = decodePng(fs.readFileSync(pngPath));
    const { tile } = meta;
    for (let frame = 0; frame < 8; frame += 1) {
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const i = ((typeTopY + y) * decoded.width + frame * tile + x) * 4;
          if (decoded.data[i + 3] === 0) continue;
          const r = decoded.data[i];
          const g = decoded.data[i + 1];
          const b = decoded.data[i + 2];
          expect(g > 90 && g > r * 1.3 && g > b * 1.3, `green survived at type[${frame}] ${x},${y}`).toBe(false);
        }
      }
    }
  });
});

describe.skipIf(!hasSource)('ingest-typing regeneration', () => {
  it('committed sheet matches the build output byte-for-byte and matches its JSON', () => {
    const { png, meta } = buildAdultTypeSheet();
    expect(fs.readFileSync(pngPath).equals(png)).toBe(true);
    expect(JSON.parse(fs.readFileSync(metaPath, 'utf8'))).toEqual(meta);
  });

  it('is deterministic: re-running the bake is byte-identical', () => {
    expect(buildAdultTypeSheet().png.equals(buildAdultTypeSheet().png)).toBe(true);
  });
});
