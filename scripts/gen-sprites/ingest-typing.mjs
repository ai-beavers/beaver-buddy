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
// committed beaver-adult.png and inserts/replaces the `type` row by NAME (via
// ingest-images.mjs's spliceRow) — every other row is preserved byte-for-byte,
// including any rows appended after `type` by a later script (e.g. a
// `watering` row). Idempotent: a pre-existing `type` row is stripped and
// rebuilt in place, so re-running is deterministic.
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
  chromaKeyGreen,
  extractGridCell,
  cropToBbox,
  resizeAreaAverage,
  placeOnTile,
  computeStageScale,
  spliceRow,
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

export function buildAdultTypeSheet() {
  // Bake the 8 typing tiles from the green source. chromaKeyGreen/
  // extractGridCell are the shared ingest-images.mjs helpers (also used by
  // ingest-animation-frames.mjs's watering row).
  const src = decodePng(fs.readFileSync(SRC_SHEET));
  const cropped = FRAMES.map(([c, r]) => cropToBbox(chromaKeyGreen(extractGridCell(src, c, r, GRID_COLS, GRID_ROWS))));
  const scale = computeStageScale(cropped, TILE, TARGET_CONTENT_HEIGHT_PX);
  const typeTiles = cropped.map((img) => {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    return placeOnTile(resizeAreaAverage(img, destW, destH), TILE);
  });

  // Insert/replace the type row by name (idempotent + order-safe — see
  // spliceRow), preserving every other row's bytes exactly.
  const golden = decodePng(fs.readFileSync(ADULT_PNG));
  const goldenMeta = JSON.parse(fs.readFileSync(ADULT_JSON, 'utf8'));
  const { width, height, data, meta } = spliceRow(golden, goldenMeta, TYPE_ROW, typeTiles);

  const png = encodeRgbaPng({ width, height, data });
  return { png, meta, scale };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { png, meta, scale } = buildAdultTypeSheet();
  fs.writeFileSync(ADULT_PNG, png);
  fs.writeFileSync(ADULT_JSON, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`appended beaver-adult type row (${meta.sheetWidth}x${meta.sheetHeight}, scale ${scale.toFixed(4)})`);
}
