// Ingests a Comfy Cloud video-frame grid (Seedance loop video, re-sampled
// down to 8 frames) into an EXISTING beaver-adult sprite row, recovering the
// original 96px art grid from the video's re-rendered pixels. This is stage
// 6 of the pipeline documented in skills/video-to-sprite/SKILL.md (reference-
// canvas image -> Seedance loop video -> 8-frame grid -> this script); the
// splice-into-the-shipped-sheet shape mirrors ingest-animation-frames.mjs's
// buildAdultRowSheet/spliceRow pattern for the other single-grid adult rows.
//
// Session-proven implementation, promoted from
// tmp/video-gen/bake-video-brainrot.mjs (adult-brainrot-video re-bake).
// Output is always written under assets-src/baked/ for design-gate review —
// this script never writes assets/sprites/ directly; promotion is a
// separate, reviewed step.
//
// Scope: adult stage only, and only existing 96px-tall rows (the 128px rows
// — parachute-wind, exercise, toilet — use a different tile geometry the
// proven math here doesn't cover; they error out clearly below). Adding a
// brand-new row with no committed anchor frame is also out of scope — tile 0
// of the recovered row is always the committed anchor frame, verbatim.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TILE,
  decodePng,
  chromaKeyGreen,
  extractGridCell,
  spliceRow,
} from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';

// Reference-canvas geometry the SKILL.md ffmpeg step must reproduce exactly:
// the committed 96px tile is upscaled SPRITE_SCALE (10x, nearest-neighbor)
// and composited at (OFFSET, OFFSET) on a CANVAS x CANVAS green canvas
// before it's sent to Seedance as the first/last frame. Any mismatch here
// silently misaligns the art grid recovered below.
export const CANVAS = 1080;
export const SPRITE_SCALE = 10;
export const OFFSET = 60;

const GRID_COLS = 4;
const GRID_ROWS = 2;
const FRAME_COUNT = GRID_COLS * GRID_ROWS; // 8 sampled video frames per row

const WINDOW = 2; // sample window half-size (5x5)
const ALPHA_THRESHOLD = 128;

function median(values) {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

// Reads one TILE x TILE art-grid frame out of a decoded video cell by
// sampling the median color of a 5x5 window centered on each art pixel.
// Seedance renders at whatever resolution its output preset uses (e.g.
// 960px square for a 1:1 720p job), not necessarily CANVAS itself, so the
// art-pixel step and grid origin are derived from the cell's own decoded
// size rather than hard-coded: one art pixel is
// SPRITE_SCALE * cell.width / CANVAS wide, and the grid origin sits at
// OFFSET * cell.width / CANVAS. Median (not average) rejects video
// compression artifacts and antialiasing noise at each art pixel's edges,
// where a straight average would blend in neighboring colors and dull the
// recovered palette.
export function sampleArtGrid(cell) {
  // A non-square cell means the video wasn't 1:1 as the pipeline assumes —
  // the geometry derivation above only holds for a square reference canvas.
  if (cell.width !== cell.height) {
    throw new Error(
      `video cell is not square (${cell.width}x${cell.height}) — resolution drift from the expected ${CANVAS}x${CANVAS} 1:1 reference canvas`,
    );
  }
  const step = (SPRITE_SCALE * cell.width) / CANVAS;
  const origin = (OFFSET * cell.width) / CANVAS;
  // step < 1 means the video's resolution collapsed below the art grid's
  // own 96px resolution (each art pixel would sample less than one source
  // pixel) — a clear sign of resolution drift, not a valid grid to sample.
  if (!(step >= 1) || !Number.isFinite(step)) {
    throw new Error(
      `implausible art-pixel step ${step.toFixed(3)}px from cell size ${cell.width}px — resolution drift from the expected ${CANVAS}x${CANVAS} reference canvas`,
    );
  }
  const out = new Uint8ClampedArray(TILE * TILE * 4);
  for (let ay = 0; ay < TILE; ay += 1) {
    const cy = Math.round(origin + (ay + 0.5) * step);
    for (let ax = 0; ax < TILE; ax += 1) {
      const cx = Math.round(origin + (ax + 0.5) * step);
      const rs = [];
      const gs = [];
      const bs = [];
      for (let dy = -WINDOW; dy <= WINDOW; dy += 1) {
        for (let dx = -WINDOW; dx <= WINDOW; dx += 1) {
          const x = Math.min(cell.width - 1, Math.max(0, cx + dx));
          const y = Math.min(cell.height - 1, Math.max(0, cy + dy));
          const i = (y * cell.width + x) * 4;
          rs.push(cell.data[i]);
          gs.push(cell.data[i + 1]);
          bs.push(cell.data[i + 2]);
        }
      }
      const o = (ay * TILE + ax) * 4;
      out[o] = median(rs);
      out[o + 1] = median(gs);
      out[o + 2] = median(bs);
      out[o + 3] = 255;
    }
  }
  return { width: TILE, height: TILE, data: out };
}

// Collects every fully-opaque color in an image (the committed anchor tile,
// in practice) — the exact palette the recovered frames get snapped to.
export function paletteOf(img) {
  const seen = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 255) seen.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
  }
  return [...seen].map((c) => [c >> 16, (c >> 8) & 255, c & 255]);
}

// Seedance re-renders rather than copies, and video chroma subsampling
// dulls colors, so even grid-aligned samples come back slightly off.
// Snapping every opaque pixel to the committed row's exact palette (nearest
// color, squared-distance) restores the original colors instead of shipping
// a near-miss palette drift.
export function snapToPalette(tile, colors) {
  for (let i = 0; i < tile.data.length; i += 4) {
    if (tile.data[i + 3] < ALPHA_THRESHOLD) {
      tile.data[i] = tile.data[i + 1] = tile.data[i + 2] = tile.data[i + 3] = 0;
      continue;
    }
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < colors.length; c += 1) {
      const d =
        (tile.data[i] - colors[c][0]) ** 2 +
        (tile.data[i + 1] - colors[c][1]) ** 2 +
        (tile.data[i + 2] - colors[c][2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    [tile.data[i], tile.data[i + 1], tile.data[i + 2]] = colors[best];
    tile.data[i + 3] = 255;
  }
  return tile;
}

// True where (x, y) is a silhouette-boundary pixel of an opaque region
// within the w x h rect [x0,y0): opaque with a transparent (or out-of-rect)
// 4-neighbor. The bottom rect edge is exempt — every row is ground-cut
// there by convention (see groundTile below), so an opaque pixel touching
// the bottom is normal content, not a silhouette edge.
function isBoundaryPixel(data, width, x, y, x0, y0, w, h) {
  const i = (y * width + x) * 4;
  if (data[i + 3] < ALPHA_THRESHOLD) return false;
  const alphaAt = (px, py) => data[(py * width + px) * 4 + 3];
  return (
    x === x0 ||
    x === x0 + w - 1 ||
    y === y0 ||
    alphaAt(x - 1, y) < ALPHA_THRESHOLD ||
    alphaAt(x + 1, y) < ALPHA_THRESHOLD ||
    alphaAt(x, y - 1) < ALPHA_THRESHOLD ||
    (y < y0 + h - 1 && alphaAt(x, y + 1) < ALPHA_THRESHOLD)
  );
}

// Finds the most common color among the silhouette-boundary pixels of the
// committed row's own anchor tile, within a w x h rect of `sheet` starting
// at (x0, y0) — generalizes the reference implementation's hard-coded
// outline color (rgb(9,11,5), only ever correct for one specific row) to
// whatever outline color the target row actually ships.
export function outlineColorOf(sheet, x0, y0, w, h) {
  const counts = new Map();
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (!isBoundaryPixel(sheet.data, sheet.width, x, y, x0, y0, w, h)) continue;
      const i = (y * sheet.width + x) * 4;
      const key = (sheet.data[i] << 16) | (sheet.data[i + 1] << 8) | sheet.data[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let best = -1;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) { bestCount = count; best = key; }
  }
  if (best === -1) throw new Error('outlineColorOf: no silhouette-boundary pixels found in the given rect');
  return [best >> 16, (best >> 8) & 255, best & 255];
}

// Forces every silhouette-boundary pixel of `tile` to `color` (bottom tile
// edge exempt, same ground-line convention as isBoundaryPixel above) —
// evens out the ragged/fringed outline snapToPalette leaves behind, since
// palette-snapping picks the nearest committed color per pixel independently
// and boundary pixels are exactly where video re-rendering noise is worst.
export function normalizeOutline(tile, color) {
  const { width, height, data } = tile;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isBoundaryPixel(data, width, x, y, 0, 0, width, height)) continue;
      const i = (y * width + x) * 4;
      [data[i], data[i + 1], data[i + 2]] = color;
      data[i + 3] = 255;
    }
  }
  return tile;
}

// Shifts a tile's content down so its lowest opaque row touches the tile
// bottom — matches ingest-images.mjs's placeOnTile grounding convention, so
// video-recovered frames still satisfy the "every frame grounded" invariant
// the shipped sprite sheets rely on.
export function groundTile(tile) {
  const { width, height, data } = tile;
  let maxY = -1;
  for (let y = height - 1; y >= 0 && maxY === -1; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] >= ALPHA_THRESHOLD) { maxY = y; break; }
    }
  }
  const shift = maxY === -1 ? 0 : height - 1 - maxY;
  if (shift === 0) return tile;
  const out = new Uint8ClampedArray(data.length);
  out.set(data.subarray(0, (height - shift) * width * 4), shift * width * 4);
  return { width, height, data: out };
}

// Copies a TILE x TILE tile out of `sheet` at column `col` (TILE units),
// pixel row offset `rowY` — rows elsewhere in the sheet can be taller than
// TILE (parachute-wind/exercise/toilet), so callers resolve rowY themselves
// rather than assuming rowIndex * TILE.
function extractShippedTile(sheet, col, rowY) {
  const out = new Uint8ClampedArray(TILE * TILE * 4);
  for (let y = 0; y < TILE; y += 1) {
    const src = ((rowY + y) * sheet.width + col * TILE) * 4;
    out.set(sheet.data.subarray(src, src + TILE * 4), y * TILE * 4);
  }
  return { width: TILE, height: TILE, data: out };
}

// Sums the pixel heights of every row before `rowIndex` — rows can be taller
// than meta.tile, so a row's y-offset in the sheet isn't a flat
// rowIndex * tile multiple.
function rowYOffset(meta, rowIndex) {
  let y = 0;
  for (let i = 0; i < rowIndex; i += 1) y += meta.rows[i].height ?? meta.tile;
  return y;
}

// Full chain from a Comfy Cloud video-frame grid to a row-replaced sheet:
// read the grid -> per cell (frames 1..7; frame 0 is the committed anchor,
// verbatim): recover the art grid (sampleArtGrid), key out the green
// background, snap to the committed row's exact palette, force the
// silhouette outline to the committed row's outline color, ground the
// content to the tile bottom -> splice into a copy of the shipped sheet.
// Tile 0 is never re-derived from the video: the video's first frame was
// generated FROM it, so sampling it back out of the video would only add
// noise to a frame that's already exact.
export function buildVideoRowSheet(repoRoot, { rowName, sourceDir }) {
  const pngPath = path.join(repoRoot, 'assets', 'sprites', 'beaver-adult.png');
  const jsonPath = pngPath.replace(/\.png$/, '.json');
  const shipped = decodePng(fs.readFileSync(pngPath));
  const shippedMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const rowIndex = shippedMeta.rows.findIndex((row) => row.name === rowName);
  if (rowIndex === -1) {
    throw new Error(
      `unknown row "${rowName}" (expected one of: ${shippedMeta.rows.map((row) => row.name).join(', ')})`,
    );
  }
  const row = shippedMeta.rows[rowIndex];
  const rowHeight = row.height ?? shippedMeta.tile;
  if (rowHeight !== shippedMeta.tile) {
    throw new Error(`row "${rowName}" is ${rowHeight}px tall — only ${shippedMeta.tile}px-tall rows are supported`);
  }
  if (row.frames !== FRAME_COUNT) {
    throw new Error(`row "${rowName}" has ${row.frames} frame(s) — only ${FRAME_COUNT}-frame rows are supported`);
  }

  const gridPath = path.join(repoRoot, 'assets-src', 'comfyui', sourceDir, 'sheet.png');
  if (!fs.existsSync(gridPath)) {
    throw new Error(`missing ${gridPath} — extract the ${FRAME_COUNT} video frames into a ${GRID_COLS}x${GRID_ROWS} grid there first`);
  }
  const grid = decodePng(fs.readFileSync(gridPath));

  const rowY = rowYOffset(shippedMeta, rowIndex);
  const reference = extractShippedTile(shipped, 0, rowY);
  const palette = paletteOf(reference);
  const outline = outlineColorOf(reference, 0, 0, TILE, TILE);

  const tiles = [reference];
  for (let i = 1; i < FRAME_COUNT; i += 1) {
    const col = i % GRID_COLS;
    const gridRow = Math.floor(i / GRID_COLS);
    const cell = extractGridCell(grid, col, gridRow, GRID_COLS, GRID_ROWS);
    const recovered = snapToPalette(chromaKeyGreen(sampleArtGrid(cell)), palette);
    tiles.push(groundTile(normalizeOutline(recovered, outline)));
  }

  const { width, height, data, meta } = spliceRow(shipped, shippedMeta, rowName, tiles, TILE);
  return { png: encodeRgbaPng({ width, height, data }), meta };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const rowName = process.argv[2];
  if (!rowName) {
    throw new Error('usage: node scripts/gen-sprites/ingest-video-frames.mjs <rowName> [sourceDir]');
  }
  const sourceDir = process.argv[3] ?? `${rowName}-video`;

  const { png, meta } = buildVideoRowSheet(repoRoot, { rowName, sourceDir });

  const outDir = path.join(repoRoot, 'assets-src', 'baked', `${rowName}-video`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sheet.png'), png);
  fs.writeFileSync(path.join(outDir, 'sheet.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${outDir}/sheet.png (${meta.sheetWidth}x${meta.sheetHeight}) — review before promoting to assets/sprites/`);
}
