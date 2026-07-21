// Appends the "typing on a laptop" animation row to the committed beaver-adult
// sheet (the golden BL-18 adult beaver).
//
// Source: one Comfy Cloud run (prompt_id b99d59bf) — the beaver alone, holding
// a small laptop, typing, on a solid #00FF00 chroma-key background. The model
// (Gemini Nano Banana) emits an irregular 6x4 grid of near-identical frames;
// we hand-pick 8 clean typing frames (all holding the laptop, both eyes open,
// calm face) from the top two rows. Raw sheet stays local in the gitignored
// assets-src/comfyui/adult-type/sheet.png (asset rule: only baked art ships).
//
// This ingest runs AFTER the golden adult sheet is built (its own source frames
// are gitignored and can't be regenerated on every machine), so it reads the
// committed beaver-adult.png and appends a new `type` row at the bottom — every
// existing row (idle/walk/struggle/parachute-wind/land, including the taller
// parachute tile) is preserved byte-for-byte. Idempotent: a pre-existing `type`
// row is stripped and rebuilt, so re-running is deterministic.
//
// Same mechanical discipline as the other ingests (never retouch a pixel):
// chroma-key the green out, crop to content, area-average downscale to one
// locked scale, composite bottom-aligned + centered onto a 96px tile.
//
// CLI: `node scripts/gen-sprites/ingest-typing.mjs` (Node 24 type-stripping).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TILE,
  decodePng,
  cropToBbox,
  resizeAreaAverage,
  placeOnTile,
  computeStageScale,
} from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_SHEET = path.join(repoRoot, 'assets-src', 'comfyui', 'adult-type', 'sheet.png');
const ADULT_PNG = path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.png');
const ADULT_JSON = path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.json');

const TYPE_ROW = 'type';

// The generated grid is 6 columns x 4 rows. The 8 loop frames are the top two
// rows in reading order — the most uniform poses (laptop held, typing, eyes
// open). [col, row] in the source grid.
const GRID_COLS = 6;
const GRID_ROWS = 4;
const FRAMES = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [4, 0], [5, 0], [0, 1], [1, 1],
];

// Sitting-and-typing is a wide pose; give it a content-height budget in line
// with the other adult frames. computeStageScale's width term keeps the laptop
// from spilling past the tile.
const TARGET_CONTENT_HEIGHT_PX = 84;

// A pixel belongs to the green screen if green clearly dominates red and blue.
// The beaver (browns/tans), its laptop (blue-grey) and eyes (white/black) have
// no green-dominant pixels, so this keys the background — including the
// anti-aliased fringe — without eating character detail. De-spill isn't needed:
// the area-average downscale blends the few remaining semi-green edge pixels.
function chromaKeyGreen(img) {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(data.length);
  out.set(data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (g > 90 && g > r * 1.3 && g > b * 1.3) {
      out[i + 3] = 0;
    }
  }
  return { width, height, data: out };
}

// Slice cell [col,row] out of the grid. Boundaries are rounded so adjacent
// cells tile the full sheet exactly even though the cell size isn't integral.
function extractCell(sheet, col, row) {
  const x0 = Math.round((col * sheet.width) / GRID_COLS);
  const x1 = Math.round(((col + 1) * sheet.width) / GRID_COLS);
  const y0 = Math.round((row * sheet.height) / GRID_ROWS);
  const y1 = Math.round(((row + 1) * sheet.height) / GRID_ROWS);
  const w = x1 - x0;
  const h = y1 - y0;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const srcStart = ((y0 + y) * sheet.width + x0) * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

function rowHeight(row) {
  return row.height ?? TILE;
}

export function buildAdultTypeSheet() {
  // Bake the 8 typing tiles from the green source.
  const src = decodePng(fs.readFileSync(SRC_SHEET));
  const cropped = FRAMES.map(([c, r]) => cropToBbox(chromaKeyGreen(extractCell(src, c, r))));
  const scale = computeStageScale(cropped, TILE, TARGET_CONTENT_HEIGHT_PX);
  const typeTiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    return placeOnTile(resizeAreaAverage(img, destW, destH), TILE);
  });

  // Read the committed golden sheet and drop any existing type row, so this is
  // idempotent (re-running appends onto the same base, not on top of itself).
  const golden = decodePng(fs.readFileSync(ADULT_PNG));
  const goldenMeta = JSON.parse(fs.readFileSync(ADULT_JSON, 'utf8'));
  const baseRows = goldenMeta.rows.filter((row) => row.name !== TYPE_ROW);
  const baseHeight = baseRows.reduce((sum, row) => sum + rowHeight(row), 0);
  const width = goldenMeta.sheetWidth;
  const newHeight = baseHeight + TILE;

  const data = new Uint8ClampedArray(width * newHeight * 4);
  // Copy the base rows (everything except type) byte-for-byte.
  data.set(golden.data.subarray(0, width * baseHeight * 4), 0);
  // Blit the 8 type tiles into the new bottom row (width is 8 tiles wide).
  typeTiles.forEach((tile, i) => {
    for (let y = 0; y < TILE; y += 1) {
      const dstStart = ((baseHeight + y) * width + i * TILE) * 4;
      data.set(tile.data.subarray(y * TILE * 4, (y + 1) * TILE * 4), dstStart);
    }
  });

  const png = encodeRgbaPng({ width, height: newHeight, data });
  const meta = {
    tile: goldenMeta.tile,
    fps: goldenMeta.fps,
    sheetWidth: width,
    sheetHeight: newHeight,
    rows: [...baseRows, { name: TYPE_ROW, frames: FRAMES.length }],
  };
  return { png, meta, scale };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { png, meta, scale } = buildAdultTypeSheet();
  fs.writeFileSync(ADULT_PNG, png);
  fs.writeFileSync(ADULT_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`appended beaver-adult type row (${meta.sheetWidth}x${meta.sheetHeight}, scale ${scale.toFixed(4)})`);
}
