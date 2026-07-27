// Turnaround (model-sheet) ingest: slices a generated N-view row into 96px
// tiles and emits a build-time REFERENCE sheet under assets-src/reference/.
//
// This is deliberately NOT a runtime sprite sheet. Nothing in src/ loads it;
// it exists so every later animation generation can be conditioned on one
// consistent view of the character instead of on a single idle tile (the
// failure mode behind BL-7's body drift and BL-6/T3's rejected walk).
//
// Only the right-facing half is generated. The three left-facing views are
// MIRRORED from their right-facing counterparts rather than generated: it is
// free, pixel-exact by construction, matches the renderer's own mirroring
// convention (assets/STYLE.md), and removes the class of bug where a
// generated left view drifts from the right one.
//
// Plain JS (no TS syntax) like its sibling ingest scripts, so it runs under
// plain `node` without a build step.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TILE,
  chromaKeyGreen,
  computeStageScale,
  cropToBbox,
  decodePng,
  extractGridCell,
  placeOnTile,
  resizeAreaAverage,
} from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

// Authored views, left to right, as generated. The mirrored left-facing
// views are derived from these — see MIRROR_SOURCES.
const AUTHORED_VIEWS = ['front', 'front-right', 'right', 'back-right', 'back'];

// Output view order (8 compass directions). Indices 5/6/7 are horizontal
// mirrors of authored indices 3/2/1 — back-left mirrors back-right, left
// mirrors right, front-left mirrors front-right.
const VIEW_ORDER = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
];
const MIRROR_SOURCES = { 5: 3, 6: 2, 7: 1 };

const FIGURES = [
  {
    name: 'beaver-baby',
    // Winning generation (attempt 3, 2026-07-27) — see
    // docs/asset-production-todo.md for the attempt log and why 1 and 2 lost.
    source: 'assets-src/comfyui/baby-turnaround/attempt-03.png',
    // Full-tile content: a reference sheet wants maximum detail, and the
    // measured aspect (810 tall vs 621 widest) means HEIGHT binds well before
    // the width cap — no scale trap here.
    targetContentHeightPx: 96,
  },
];

// Horizontal flip. Tiles are square and already tile-aligned, so this is a
// per-row byte reversal, not a resample — no quality loss, exact by
// construction.
function mirrorTile(img) {
  const { width, height, data } = img;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dst = (y * width + (width - 1 - x)) * 4;
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
      out[dst + 3] = data[src + 3];
    }
  }
  return { width, height, data: out };
}

// Drops opaque fragments that are not part of the character: a generation can
// leave a stray speck floating in the background (attempt 3 left one 336px
// blob beside the side view, 0.12% of that figure's 275k pixels). Left in, it
// would sit in the reference sheet and risk being reproduced by every
// generation conditioned on it, and it widens the crop bbox for free.
//
// Safe HERE because a turnaround figure is one connected silhouette. Do NOT
// lift this into the animation-row ingest without thought: rows like sleep
// (floating "zzz" wisps) or the lodge sparks have legitimately detached
// elements that this would delete.
function dropStrayFragments(img, minFraction = 0.01) {
  const { width, height, data } = img;
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];

  const isOpaque = (p) => data[p * 4 + 3] > 8;

  for (let start = 0; start < width * height; start += 1) {
    if (label[start] !== -1 || !isOpaque(start)) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    const stack = [start];
    while (stack.length > 0) {
      const p = stack.pop();
      size += 1;
      const x = p % width;
      const y = (p - x) / width;
      const neighbours = [];
      if (x + 1 < width) neighbours.push(p + 1);
      if (x - 1 >= 0) neighbours.push(p - 1);
      if (y + 1 < height) neighbours.push(p + width);
      if (y - 1 >= 0) neighbours.push(p - width);
      for (const q of neighbours) {
        if (label[q] === -1 && isOpaque(q)) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }

  if (sizes.length <= 1) return img;

  const largest = Math.max(...sizes);
  const out = new Uint8ClampedArray(data);
  let dropped = 0;
  for (let p = 0; p < width * height; p += 1) {
    const id = label[p];
    if (id !== -1 && sizes[id] < largest * minFraction) {
      out[p * 4 + 3] = 0;
      dropped += 1;
    }
  }
  if (dropped > 0) console.log(`  dropped ${dropped}px of stray fragments`);
  return { width, height, data: out };
}

function composeRow(tiles) {
  const width = tiles.length * TILE;
  const data = new Uint8ClampedArray(width * TILE * 4);
  tiles.forEach((tile, index) => {
    const xOffset = index * TILE;
    for (let y = 0; y < TILE; y += 1) {
      const src = y * TILE * 4;
      const dst = (y * width + xOffset) * 4;
      data.set(tile.data.subarray(src, src + TILE * 4), dst);
    }
  });
  return { width, height: TILE, data };
}

export function buildTurnaround(figure) {
  const sourcePath = path.join(repoRoot, figure.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`missing turnaround source: ${figure.source}`);
  }
  const sheet = decodePng(fs.readFileSync(sourcePath));

  // Slice the authored views out of a 5x1 grid, key the green, crop each to
  // its own content bbox.
  const cropped = AUTHORED_VIEWS.map((_, col) =>
    cropToBbox(
      dropStrayFragments(chromaKeyGreen(extractGridCell(sheet, col, 0, AUTHORED_VIEWS.length, 1))),
    ),
  );

  // ONE scale for the whole sheet, locked off the widest+tallest view — the
  // views must stay comparable to each other, which is the entire point of a
  // model sheet.
  const scale = computeStageScale(cropped, TILE, figure.targetContentHeightPx);

  const authoredTiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    // Re-key after resampling: area averaging blends transparent green-ish
    // pixels back into the edge, which would otherwise leave a green fringe
    // (the same fringe pass buildAdultRowSheet does).
    return placeOnTile(chromaKeyGreen(resizeAreaAverage(img, destW, destH)), TILE);
  });

  const tiles = VIEW_ORDER.map((_, index) => {
    const mirrorFrom = MIRROR_SOURCES[index];
    return mirrorFrom === undefined ? authoredTiles[index] : mirrorTile(authoredTiles[mirrorFrom]);
  });

  const row = composeRow(tiles);
  const meta = {
    tile: TILE,
    // Not an animation: no frame cadence applies. 0 marks it as a static
    // reference sheet so nothing mistakes it for a playable row.
    fps: 0,
    sheetWidth: row.width,
    sheetHeight: row.height,
    rows: [{ name: 'turnaround', frames: VIEW_ORDER.length }],
    views: VIEW_ORDER,
    mirrored: Object.keys(MIRROR_SOURCES).map(Number),
    source: figure.source,
  };

  return { png: encodeRgbaPng(row), meta, scale };
}

function main() {
  const requested = process.argv[2];
  const figures = requested ? FIGURES.filter((f) => f.name === requested) : FIGURES;
  if (figures.length === 0) {
    throw new Error(`unknown figure "${requested}"; known: ${FIGURES.map((f) => f.name).join(', ')}`);
  }

  const outDir = path.join(repoRoot, 'assets-src', 'reference', 'turnaround');
  fs.mkdirSync(outDir, { recursive: true });

  for (const figure of figures) {
    const { png, meta, scale } = buildTurnaround(figure);
    const base = path.join(outDir, `${figure.name}-turnaround`);
    fs.writeFileSync(`${base}.png`, png);
    fs.writeFileSync(`${base}.json`, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(
      `${figure.name}: ${meta.sheetWidth}x${meta.sheetHeight}, ${meta.rows[0].frames} views ` +
        `(${meta.mirrored.length} mirrored), scale ${scale.toFixed(4)}`,
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main();
}

export {
  AUTHORED_VIEWS,
  FIGURES,
  MIRROR_SOURCES,
  VIEW_ORDER,
  composeRow,
  dropStrayFragments,
  mirrorTile,
};
