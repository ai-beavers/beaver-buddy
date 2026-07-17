// Placeholder adult-stage sheet generator (flight-plan #7 — provisional:
// final adult art is a designer/owner task). Until that art exists, this
// derives a self-contained beaver-adult sheet from the committed teen sheet
// so the renderer can load beaver-adult like every other stage (replacing
// the old sprites.ts teen fallback). CLI entry for
// `npm run assets:adult-placeholder`; run directly under Node 24
// type-stripping.
//
// Source: the committed beaver-teen sheet (assets/sprites/beaver-teen.png
// + .json). Per tile: extract the tile, crop to the content bbox,
// nearest-neighbor upscale so the content height fills the full 96px tile
// (teen content tops out at 92px), then composite bottom-aligned +
// horizontally centered (placeOnTile's placement rule). The adult reads as
// simply a bigger beaver — same poses, larger silhouette, zero authored
// pixels. Nearest neighbor (not area-average) because this only ever
// upscales: chunky art stays chunky, same rule as the 256px icon entry.
//
// Same discipline as the rest of the sprite pipeline: mechanically process,
// never retouch; no image dependencies (decode via ingest-images.mjs,
// encode via png.ts); byte-deterministic output.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cropToBbox, decodePng, placeOnTile } from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';
import { extractTile, resizeNearest } from './build-icons.ts';

const TEEN_SHEET_URL = new URL('../../assets/sprites/beaver-teen.png', import.meta.url);
const TEEN_META_URL = new URL('../../assets/sprites/beaver-teen.json', import.meta.url);
const ADULT_SHEET_URL = new URL('../../assets/sprites/beaver-adult.png', import.meta.url);
const ADULT_META_URL = new URL('../../assets/sprites/beaver-adult.json', import.meta.url);

export interface SheetMetaJson {
  readonly tile: number;
  readonly fps: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly rows: readonly { readonly name: string; readonly frames: number }[];
}

// Pure entry point (reads the committed teen sheet, writes nothing) — the
// CLI below and the determinism/committed-asset tests both call this.
export function buildAdultPlaceholder(): { png: Buffer; meta: SheetMetaJson } {
  const sheet = decodePng(fs.readFileSync(TEEN_SHEET_URL));
  const teenMeta = JSON.parse(fs.readFileSync(TEEN_META_URL, 'utf8')) as SheetMetaJson;
  const { tile } = teenMeta;

  const maxFrames = Math.max(...teenMeta.rows.map((row) => row.frames));
  const width = maxFrames * tile;
  const height = teenMeta.rows.length * tile;
  const data = new Uint8ClampedArray(width * height * 4);

  teenMeta.rows.forEach((row, rowIndex) => {
    for (let frame = 0; frame < row.frames; frame += 1) {
      const content = cropToBbox(extractTile(sheet, tile, frame, rowIndex));
      // Teen content height ≤ tile (92px tallest), so tile/height ≥ 1: this
      // always upscales. destH lands on `tile` exactly (height * tile/height).
      const scale = tile / content.height;
      const destW = Math.max(1, Math.round(content.width * scale));
      const destH = Math.max(1, Math.round(content.height * scale));
      const tileImg = placeOnTile(resizeNearest(content, destW, destH), tile);

      const originX = frame * tile;
      const originY = rowIndex * tile;
      for (let y = 0; y < tile; y += 1) {
        const srcStart = y * tile * 4;
        const destStart = ((originY + y) * width + originX) * 4;
        data.set(tileImg.data.subarray(srcStart, srcStart + tile * 4), destStart);
      }
    }
  });

  const meta: SheetMetaJson = {
    tile,
    fps: teenMeta.fps,
    sheetWidth: width,
    sheetHeight: height,
    rows: teenMeta.rows,
  };

  return { png: encodeRgbaPng({ width, height, data }), meta };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { png, meta } = buildAdultPlaceholder();
  fs.writeFileSync(fileURLToPath(ADULT_SHEET_URL), png);
  fs.writeFileSync(fileURLToPath(ADULT_META_URL), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${fileURLToPath(ADULT_SHEET_URL)} (${meta.sheetWidth}x${meta.sheetHeight})`);
  console.log(`wrote ${fileURLToPath(ADULT_META_URL)}`);
}
