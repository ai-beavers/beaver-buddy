// Ingests ComfyUI-generated animation sprite sheets (BL Phase-3 / Fallschirm-
// Drop) into the beaver-baby sheet as new rows, reusing the exact mechanical
// pipeline the still-frame ingest uses (ingest-images.mjs): flood-fill
// background removal, crop to content bbox, premultiplied-alpha area-average
// downscale to a per-animation locked scale, composite bottom-aligned +
// centered onto a 96x96 tile. No beaver pixels are authored or retouched here
// (CLAUDE.md's "mechanically process, never retouch" rule).
//
// Source frames come from one Comfy Cloud run per animation (the "Voll
// ComfyUI" owner decision, 2026-07-20): each run's `PixelArt Builder` output
// is 8 alpha-croppable frames on a white background, downloaded to the
// gitignored assets-src/comfyui/<run>/frame_0{1..8}.png. Those raw dumps stay
// local (asset rule: only committed art ships); this script + the baked sheet
// are the reproducible, committed record.
//
// idle + walk are NOT regenerated — their tiles are copied byte-for-byte out
// of the existing committed beaver-baby.png so the shipped still art is
// preserved exactly; only struggle / parachute-wind / land are appended.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TILE,
  FPS,
  decodePng,
  removeBackground,
  cropToBbox,
  resizeAreaAverage,
  placeOnTile,
  computeStageScale,
} from './ingest-images.mjs';
import { encodeRgbaPng } from './png.ts';

// Per-animation target content height (px within the 96px tile). struggle and
// land settle to ~idle size (shipped idle content is ~61px tall) on their
// calmer frames while their most-spread pose reaches this height; parachute-
// wind fits the whole canopy+beaver into the tile, so the beaver reads smaller
// during the glide (documented tradeoff — the runtime, WAVE-2, owns world
// placement, not tile scale).
const NEW_ANIMATIONS = [
  { name: 'struggle', run: 'struggle-run', targetContentHeightPx: 82 },
  { name: 'parachute-wind', run: 'parachute-wind-run', targetContentHeightPx: 92 },
  { name: 'land', run: 'land-run', targetContentHeightPx: 92 },
];

const FRAME_COUNT = 8;

// Copies a single TILE×TILE tile out of a decoded sheet at (col,row).
function extractTile(sheet, col, row) {
  const out = new Uint8ClampedArray(TILE * TILE * 4);
  for (let y = 0; y < TILE; y += 1) {
    const srcStart = ((row * TILE + y) * sheet.width + col * TILE) * 4;
    out.set(sheet.data.subarray(srcStart, srcStart + TILE * 4), y * TILE * 4);
  }
  return { width: TILE, height: TILE, data: out };
}

// Bakes one animation's 8 frames into 8 tiles at a single locked scale.
function bakeAnimation(runDir, targetContentHeightPx) {
  const cropped = [];
  for (let i = 1; i <= FRAME_COUNT; i += 1) {
    const file = path.join(runDir, `frame_${String(i).padStart(2, '0')}.png`);
    const buf = fs.readFileSync(file);
    cropped.push(cropToBbox(removeBackground(decodePng(buf))));
  }
  const scale = computeStageScale(cropped, TILE, targetContentHeightPx);
  const tiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    return placeOnTile(resizeAreaAverage(img, destW, destH), TILE);
  });
  return { tiles, scale };
}

export function buildBabySheet(repoRoot) {
  const shippedPng = path.join(repoRoot, 'assets', 'sprites', 'beaver-baby.png');
  const shipped = decodePng(fs.readFileSync(shippedPng));

  // Preserve idle (row0 col0) + walk (row1 col0/col1) exactly.
  const rows = [
    { name: 'idle', tiles: [extractTile(shipped, 0, 0)] },
    { name: 'walk', tiles: [extractTile(shipped, 0, 1), extractTile(shipped, 1, 1)] },
  ];

  const scales = {};
  for (const anim of NEW_ANIMATIONS) {
    const runDir = path.join(repoRoot, 'assets-src', 'comfyui', anim.run);
    const { tiles, scale } = bakeAnimation(runDir, anim.targetContentHeightPx);
    rows.push({ name: anim.name, tiles });
    scales[anim.name] = scale;
  }

  const maxFrames = Math.max(...rows.map((r) => r.tiles.length));
  const width = maxFrames * TILE;
  const height = rows.length * TILE;
  const data = new Uint8ClampedArray(width * height * 4);

  rows.forEach((row, rowIndex) => {
    row.tiles.forEach((tile, frameIndex) => {
      const originX = frameIndex * TILE;
      const originY = rowIndex * TILE;
      for (let y = 0; y < TILE; y += 1) {
        const srcStart = y * TILE * 4;
        const destStart = ((originY + y) * width + originX) * 4;
        data.set(tile.data.subarray(srcStart, srcStart + TILE * 4), destStart);
      }
    });
  });

  const meta = {
    tile: TILE,
    fps: FPS,
    sheetWidth: width,
    sheetHeight: height,
    rows: rows.map((r) => ({ name: r.name, frames: r.tiles.length })),
  };
  return { png: encodeRgbaPng({ width, height, data }), meta, scales };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const { png, meta, scales } = buildBabySheet(repoRoot);
  const outDir = path.join(repoRoot, 'assets-src', 'baked', 'beaver-baby');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sheet.png'), png);
  fs.writeFileSync(path.join(outDir, 'sheet.json'), `${JSON.stringify(meta, null, 2)}\n`);
  const scaleStr = Object.entries(scales)
    .map(([k, v]) => `${k}=${v.toFixed(4)}`)
    .join(' ');
  console.log(`wrote ${outDir}/sheet.png (${meta.sheetWidth}x${meta.sheetHeight}), scales: ${scaleStr}`);
}
