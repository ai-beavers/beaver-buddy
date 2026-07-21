// Icon generator for the provisional Windows icon pass (flight-plan #3 —
// still provisional: final art is a designer task, this replaces the
// placeholder with assets derived from the shipped sprite). CLI entry for
// `npm run assets:icons`; run directly under Node 24 type-stripping.
//
// Source: the committed beaver-teen idle frame (row 0, frame 0 of the
// sheet) — the pose the app shows most. Same discipline as the sprite
// pipeline: mechanically process, never retouch; no image dependencies
// (decode via ingest-images.mjs, encode via png.ts, container via ico.ts).
//
// Per size: crop the idle tile to its content bbox, scale to fit the
// square, composite onto a transparent square canvas bottom-aligned +
// horizontally centered (placeOnTile's placement rule). Downscales use the
// premultiplied-alpha area-average filter (no black fringing on the alpha
// edge); upscales use nearest neighbor so the chunky pixel-art edges
// survive instead of blurring.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cropToBbox, decodePng, resizeAreaAverage, type DecodedImage } from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';
import { encodeIco, type IcoImage } from './ico.ts';

export const ICON_SIZES: readonly number[] = [16, 24, 32, 48, 64, 128, 256];
export const TRAY_SIZE = 32;

const SHEET_URL = new URL('../../assets/sprites/beaver-teen.png', import.meta.url);
const META_URL = new URL('../../assets/sprites/beaver-teen.json', import.meta.url);
const ICO_URL = new URL('../../assets/icon.ico', import.meta.url);
const TRAY_URL = new URL('../../assets/tray-icon.png', import.meta.url);

interface SheetMetaJson {
  readonly tile: number;
  readonly rows: readonly { readonly name: string; readonly frames: number }[];
}

export function extractTile(sheet: DecodedImage, tile: number, frame: number, row: number): DecodedImage {
  if ((frame + 1) * tile > sheet.width || (row + 1) * tile > sheet.height) {
    throw new Error(`tile (frame=${frame}, row=${row}) outside ${sheet.width}x${sheet.height} sheet`);
  }
  const data = new Uint8ClampedArray(tile * tile * 4);
  for (let y = 0; y < tile; y += 1) {
    const srcStart = ((row * tile + y) * sheet.width + frame * tile) * 4;
    data.set(sheet.data.subarray(srcStart, srcStart + tile * 4), y * tile * 4);
  }
  return { width: tile, height: tile, data };
}

// Nearest-neighbor scale for upscaling (the 256px entry comes from ~92px
// content): chunky art stays chunky. Lives here, not in ingest-images.mjs,
// because that pipeline only ever downscales.
export function resizeNearest(img: DecodedImage, destW: number, destH: number): DecodedImage {
  const out = new Uint8ClampedArray(destW * destH * 4);
  for (let dy = 0; dy < destH; dy += 1) {
    const sy = Math.min(img.height - 1, Math.floor((dy * img.height) / destH));
    for (let dx = 0; dx < destW; dx += 1) {
      const sx = Math.min(img.width - 1, Math.floor((dx * img.width) / destW));
      const si = (sy * img.width + sx) * 4;
      const di = (dy * destW + dx) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { width: destW, height: destH, data: out };
}

// Fit content into a size×size canvas: scale so the longer side hits `size`
// (aspect preserved), place bottom-aligned + horizontally centered.
function renderIconSize(content: DecodedImage, size: number): DecodedImage {
  const scale = size / Math.max(content.width, content.height);
  const destW = Math.max(1, Math.round(content.width * scale));
  const destH = Math.max(1, Math.round(content.height * scale));
  const scaled = scale >= 1 ? resizeNearest(content, destW, destH) : resizeAreaAverage(content, destW, destH);

  const data = new Uint8ClampedArray(size * size * 4);
  const originX = Math.floor((size - destW) / 2);
  const originY = size - destH;
  for (let y = 0; y < destH; y += 1) {
    const srcStart = y * destW * 4;
    const destStart = ((originY + y) * size + originX) * 4;
    data.set(scaled.data.subarray(srcStart, srcStart + destW * 4), destStart);
  }
  return { width: size, height: size, data };
}

// Pure entry point (reads the committed sheet, writes nothing) — the CLI
// below and the determinism/committed-asset tests both call this.
export function buildIcons(): { ico: Buffer; trayPng: Buffer } {
  const sheet = decodePng(fs.readFileSync(SHEET_URL));
  const meta = JSON.parse(fs.readFileSync(META_URL, 'utf8')) as SheetMetaJson;
  const idleRow = meta.rows.findIndex((row) => row.name === 'idle');
  if (idleRow < 0) throw new Error('beaver-teen.json has no idle row');

  const content = cropToBbox(extractTile(sheet, meta.tile, 0, idleRow));
  const images: IcoImage[] = ICON_SIZES.map((size) => ({
    size,
    png: encodeRgbaPng(renderIconSize(content, size)),
  }));
  return {
    ico: encodeIco(images),
    trayPng: encodeRgbaPng(renderIconSize(content, TRAY_SIZE)),
  };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { ico, trayPng } = buildIcons();
  fs.writeFileSync(fileURLToPath(ICO_URL), ico);
  fs.writeFileSync(fileURLToPath(TRAY_URL), trayPng);
  console.log(`wrote ${fileURLToPath(ICO_URL)} (${ICON_SIZES.length} sizes: ${ICON_SIZES.join(', ')})`);
  console.log(`wrote ${fileURLToPath(TRAY_URL)} (${TRAY_SIZE}x${TRAY_SIZE})`);
}
