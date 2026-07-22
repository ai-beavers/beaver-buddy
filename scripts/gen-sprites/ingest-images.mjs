// Ingests the user's own generated beaver images (BL-11) into the
// beaver-{baby,teen} sprite sheets — replaces the earlier programmatic
// pixel-map pipeline (deleted: pixel-maps/{baby,teen,adult}.ts,
// import-codex.mjs). No PIL/image deps available, so PNG decoding is
// hand-rolled here (node:zlib inflate + PNG scanline unfiltering) — the
// source files this repo actually ships are all 8-bit RGBA, non-interlaced
// (color type 6); anything else throws rather than silently mis-decoding.
//
// Plain .mjs (no TS syntax): the sibling helper it imports (./png.ts) is a
// .ts file, resolved fine under Node 24's native type-stripping (which
// keys off the *target* file's extension, not the importer's) — but this
// file has no build step of its own, so it has to be executable as-is.
//
// Pipeline per frame (CLAUDE.md's "mechanically process, never retouch"
// rule — no beaver pixels are authored or hand-edited here):
//   1. Background removal: flood-fill transparency from the four borders
//      over near-white/near-black/already-transparent pixels, then a hard
//      alpha threshold over the whole frame (no feathering — antialiased
//      edges become fully opaque or fully transparent).
//   2. Crop to the opaque content bbox.
//   3. Downscale with a premultiplied-alpha area-average filter (avoids
//      black fringing from the now-transparent background) to a scale
//      factor locked per stage (see computeStageScale below).
//   4. Composite onto a TILE×TILE canvas, bottom-aligned + horizontally
//      centered.
//
// Colors ship exactly as the source art provides them — no palette
// quantization (assets/STYLE.md's 16-color rule is waived for imported
// sheets, see its Provenance section) — so sheets are RGBA truecolor PNGs
// (encodeRgbaPng), not indexed like the lodge sheet.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodeRgbaPng } from './png.ts';

export const TILE = 96;
export const FPS = 8;

// A pixel counts as background if it's already substantially transparent,
// or near-white, or near-black — covers both "already-transparent PNG" and
// "opaque white/black backdrop" source files without per-file branching.
const ALPHA_THRESHOLD = 128;
const WHITE_MIN = 235;
const BLACK_MAX = 25;

function readChunks(buf) {
  let offset = 8; // skip the 8-byte PNG signature
  const chunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    chunks.push({ type, data });
    offset += 12 + len; // length + type + data + crc
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// Decodes an 8-bit, non-interlaced, truecolor+alpha (color type 6) PNG:
// the format every file under assets-src/beaver/ actually uses (checked
// directly — see BL-11 verdict doc). Any other bit depth/color type/
// interlacing throws instead of guessing at a decode.
export function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('not a PNG: missing IHDR');
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}); ` +
        'ingest-images.mjs only decodes 8-bit RGBA, non-interlaced PNGs',
    );
  }

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);

  const bpp = 4; // bytes per pixel at 8-bit RGBA
  const stride = width * bpp;
  const data = new Uint8ClampedArray(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    for (let x = 0; x < stride; x += 1) {
      const rawByte = raw[pos + x];
      const a = x >= bpp ? data[y * stride + x - bpp] : 0;
      const b = y > 0 ? data[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= bpp ? data[(y - 1) * stride + x - bpp] : 0;
      let value;
      switch (filter) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4:
          value = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`unsupported PNG scanline filter type ${filter}`);
      }
      data[y * stride + x] = value & 0xff;
    }
    pos += stride;
  }

  return { width, height, data };
}

function isBackgroundPixel(r, g, b, a) {
  if (a < ALPHA_THRESHOLD) return true;
  if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) return true;
  if (r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX) return true;
  return false;
}

// Step 1: flood-fill transparency from the borders over background-colored
// pixels (4-connected), then hard-threshold every pixel's alpha to fully
// opaque or fully transparent — "feather nothing" (assets-src teeth/eye
// shine whites and eye/nose blacks are interior, never border-connected, so
// they survive the flood fill untouched).
export function removeBackground(img) {
  const { width, height } = img;
  const data = Uint8ClampedArray.from(img.data);

  const stackX = [];
  const stackY = [];
  for (let x = 0; x < width; x += 1) {
    stackX.push(x, x);
    stackY.push(0, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    stackX.push(0, width - 1);
    stackY.push(y, y);
  }

  const visited = new Uint8Array(width * height);
  while (stackX.length > 0) {
    const x = stackX.pop();
    const y = stackY.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    const i = idx * 4;
    if (!isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
    visited[idx] = 1;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    stackX.push(x + 1, x - 1, x, x);
    stackY.push(y, y, y + 1, y - 1);
  }

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_THRESHOLD) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
    }
  }

  return { width, height, data };
}

// Alternate to removeBackground for frames generated on a solid green
// (#00FF00) chroma-key background: removeBackground's border flood-fill
// only catches near-white/near-black, so it leaves green pixels behind (and,
// used on a green source, would incorrectly key nothing). A pixel belongs to
// the green screen if green clearly dominates red and blue — no antialiased
// fringe survives, and bright/white character detail (teeth, eye shine) has
// no green-dominant pixels so it's untouched. No border flood-fill needed:
// green is uniform across the whole frame, not just the border.
export function chromaKeyGreen(img) {
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

// Slices cell [col,row] out of a colGrid x rowGrid grid image. Boundaries are
// rounded so adjacent cells tile the full sheet exactly even when the cell
// size isn't integral (a Gemini-generated grid's pixel dimensions aren't
// always evenly divisible).
export function extractGridCell(img, col, row, gridCols, gridRows) {
  const x0 = Math.round((col * img.width) / gridCols);
  const x1 = Math.round(((col + 1) * img.width) / gridCols);
  const y0 = Math.round((row * img.height) / gridRows);
  const y1 = Math.round(((row + 1) * img.height) / gridRows);
  const w = x1 - x0;
  const h = y1 - y0;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const srcStart = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(srcStart, srcStart + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

// Step 2: crop to the bounding box of opaque pixels.
export function cropToBbox(img) {
  const { width, height, data } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('image has no opaque content after background removal');

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const srcStart = ((minY + y) * width + minX) * 4;
    out.set(data.subarray(srcStart, srcStart + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

// Step 3: premultiplied-alpha area-average downscale (box filter with exact
// fractional pixel-overlap weights) — high-quality shrink for chunky
// source art without reintroducing anti-aliased fringing. Premultiplying
// by alpha before averaging keeps the (zeroed, from step 1) transparent
// background from darkening opaque edge pixels.
export function resizeAreaAverage(img, destW, destH) {
  const { width: srcW, height: srcH, data: src } = img;
  const out = new Uint8ClampedArray(destW * destH * 4);
  const scaleX = srcW / destW;
  const scaleY = srcH / destH;

  for (let dy = 0; dy < destH; dy += 1) {
    const sy0 = dy * scaleY;
    const sy1 = (dy + 1) * scaleY;
    const iy0 = Math.floor(sy0);
    const iy1 = Math.min(srcH, Math.ceil(sy1));
    for (let dx = 0; dx < destW; dx += 1) {
      const sx0 = dx * scaleX;
      const sx1 = (dx + 1) * scaleX;
      const ix0 = Math.floor(sx0);
      const ix1 = Math.min(srcW, Math.ceil(sx1));

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let coverage = 0;
      for (let sy = iy0; sy < iy1; sy += 1) {
        const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
        for (let sx = ix0; sx < ix1; sx += 1) {
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
          const weight = wx * wy;
          const i = (sy * srcW + sx) * 4;
          const alpha = src[i + 3] / 255;
          rSum += src[i] * alpha * weight;
          gSum += src[i + 1] * alpha * weight;
          bSum += src[i + 2] * alpha * weight;
          aSum += alpha * weight;
          coverage += weight;
        }
      }

      const di = (dy * destW + dx) * 4;
      if (aSum > 1e-6) {
        out[di] = rSum / aSum;
        out[di + 1] = gSum / aSum;
        out[di + 2] = bSum / aSum;
      }
      out[di + 3] = coverage > 0 ? Math.round((aSum / coverage) * 255) : 0;
    }
  }

  return { width: destW, height: destH, data: out };
}

// Step 4: composite onto a tileW×tileH canvas, feet on the canvas bottom,
// horizontally centered. Defensively clips to the canvas (never spills into
// a neighboring sheet column/row) — computeStageScale's width term keeps
// this a no-op for every frame we actually ship. tileH defaults to tileW so
// every square-tile caller (baby/teen still frames) is unaffected; a taller
// canvas (BL-19: adult parachute-wind) lets one animation row render taller
// than the base tile instead of shrinking its content to fit a square.
export function placeOnTile(img, tileW, tileH = tileW) {
  const out = new Uint8ClampedArray(tileW * tileH * 4);
  const w = Math.min(img.width, tileW);
  const h = Math.min(img.height, tileH);
  const destX = Math.floor((tileW - w) / 2);
  const destY = tileH - h;
  for (let y = 0; y < h; y += 1) {
    const srcStart = y * img.width * 4;
    const destStart = ((destY + y) * tileW + destX) * 4;
    out.set(img.data.subarray(srcStart, srcStart + w * 4), destStart);
  }
  return { width: tileW, height: tileH, data: out };
}

// One scale factor per stage, applied to every frame (spec: "lock from the
// tallest frame so animation doesn't wobble"). The height term hits the
// stage's target content height on its tallest frame; the width term is a
// floor under that so no frame's content (e.g. a wide crouched walk pose)
// overflows the tile and clips or bleeds into the neighboring sheet column.
// For beaver-teen the height term binds (all frames comfortably narrower
// than TILE already); for beaver-baby the width term binds — see BL-11
// verdict doc for the measured numbers and the resulting content height.
export function computeStageScale(bboxes, tile, targetContentHeightPx) {
  const maxH = Math.max(...bboxes.map((b) => b.height));
  const maxW = Math.max(...bboxes.map((b) => b.width));
  return Math.min(targetContentHeightPx / maxH, tile / maxW);
}

// Replaces (or appends) one named row in an already-baked sheet, keyed by
// NAME not position. Two separate scripts append rows onto the same
// committed sheet over time (e.g. a `type` row, then later a `watering`
// row) — a re-run of the earlier script can no longer assume its row is a
// contiguous prefix or the physical last row, so finding it by name and
// preserving every other row's bytes around it (shifting whatever comes
// after when the row's height changes) is the only order-safe way to
// rebuild in place. Rows before the target keep their exact bytes; rows
// after it are copied unchanged, just shifted if tileHeight differs from
// the row being replaced.
export function spliceRow(sheet, meta, rowName, tiles, tileHeight = meta.tile) {
  const width = meta.sheetWidth;
  const heightOf = (row) => row.height ?? meta.tile;
  const idx = meta.rows.findIndex((row) => row.name === rowName);
  const before = idx === -1 ? meta.rows : meta.rows.slice(0, idx);
  const after = idx === -1 ? [] : meta.rows.slice(idx + 1);
  const beforeHeight = before.reduce((sum, row) => sum + heightOf(row), 0);
  const afterHeight = after.reduce((sum, row) => sum + heightOf(row), 0);
  const oldRowHeight = idx === -1 ? 0 : heightOf(meta.rows[idx]);

  const height = beforeHeight + tileHeight + afterHeight;
  const data = new Uint8ClampedArray(width * height * 4);
  data.set(sheet.data.subarray(0, width * beforeHeight * 4), 0);
  tiles.forEach((tile, i) => {
    for (let y = 0; y < tileHeight; y += 1) {
      const destStart = ((beforeHeight + y) * width + i * meta.tile) * 4;
      data.set(tile.data.subarray(y * meta.tile * 4, (y + 1) * meta.tile * 4), destStart);
    }
  });
  if (after.length > 0) {
    const oldAfterStart = width * (beforeHeight + oldRowHeight) * 4;
    const newAfterStart = width * (beforeHeight + tileHeight) * 4;
    data.set(sheet.data.subarray(oldAfterStart, oldAfterStart + width * afterHeight * 4), newAfterStart);
  }

  const rowMeta = { name: rowName, frames: tiles.length, ...(tileHeight !== meta.tile ? { height: tileHeight } : {}) };
  return {
    width,
    height,
    data,
    meta: { tile: meta.tile, fps: meta.fps, sheetWidth: width, sheetHeight: height, rows: [...before, rowMeta, ...after] },
  };
}

// Row/frame order is CLAUDE.md-binding (see assets/STYLE.md): right-facing
// only, idle then walk, no run/sleep/react. The user's left-facing images
// ({stage}-idle-left.png, {stage}-to-left-{1,2}.png) are unused — the
// renderer mirrors right-facing frames instead (see BL-11 verdict doc).
//
// Baby is built by ingest-animation-frames.mjs (parachute drop / BL-17);
// it is intentionally absent from this list so the still-frame ingest only
// rebuilds teen/young-baby/older-teen.
//
// beaver-young-baby (BL-6/T1) and beaver-older-teen (BL-6/T2) are new
// in-between figures, not yet wired into Stage/stageForLevel (WAVE-2) — an
// unwired sheet is inert, so committing them is safe ahead of that wiring.
// Both are full-frame Comfy Cloud generations, dual-reference-conditioned
// (young-baby: committed baby idle tile + teen idle tile; older-teen:
// committed teen idle tile + adult idle tile) so each reads BETWEEN its two
// neighbors rather than as a new character — see assets/STYLE.md Provenance.
export const STAGE_SPECS = [
  {
    name: 'beaver-teen',
    tile: TILE,
    fps: FPS,
    targetContentHeightPx: 92,
    rows: [
      { name: 'idle', files: ['teen-idle-right.png'] },
      { name: 'walk', files: ['teen-to-right-1.png', 'teen-to-right-2.png'] },
    ],
  },
  {
    name: 'beaver-young-baby',
    tile: TILE,
    fps: FPS,
    targetContentHeightPx: 76,
    rows: [
      { name: 'idle', files: ['young-baby-idle-right.png'] },
      { name: 'walk', files: ['young-baby-to-right-1.png', 'young-baby-to-right-2.png'] },
    ],
  },
  {
    name: 'beaver-older-teen',
    tile: TILE,
    fps: FPS,
    targetContentHeightPx: 94,
    rows: [
      { name: 'idle', files: ['older-teen-idle-right.png'] },
      { name: 'walk', files: ['older-teen-to-right-1.png', 'older-teen-to-right-2.png'] },
    ],
  },
];

// Pure pipeline entry point (no filesystem writes beyond the source reads)
// — reads only the files this stage's rows reference, so it's what both the
// CLI below and the vitest determinism check call.
export function ingestStage(stageSpec, srcDir) {
  const uniqueFiles = [...new Set(stageSpec.rows.flatMap((row) => row.files))];

  const cropped = new Map();
  for (const file of uniqueFiles) {
    const buf = fs.readFileSync(path.join(srcDir, file));
    cropped.set(file, cropToBbox(removeBackground(decodePng(buf))));
  }

  const scale = computeStageScale([...cropped.values()], stageSpec.tile, stageSpec.targetContentHeightPx);

  const tiles = new Map();
  for (const [file, img] of cropped) {
    const destW = Math.max(1, Math.round(img.width * scale));
    const destH = Math.max(1, Math.round(img.height * scale));
    tiles.set(file, placeOnTile(resizeAreaAverage(img, destW, destH), stageSpec.tile));
  }

  const maxFrames = Math.max(...stageSpec.rows.map((row) => row.files.length));
  const width = maxFrames * stageSpec.tile;
  const height = stageSpec.rows.length * stageSpec.tile;
  const data = new Uint8ClampedArray(width * height * 4);

  stageSpec.rows.forEach((row, rowIndex) => {
    row.files.forEach((file, frameIndex) => {
      const tileImg = tiles.get(file);
      const originX = frameIndex * stageSpec.tile;
      const originY = rowIndex * stageSpec.tile;
      for (let y = 0; y < stageSpec.tile; y += 1) {
        const srcStart = y * stageSpec.tile * 4;
        const destStart = ((originY + y) * width + originX) * 4;
        data.set(tileImg.data.subarray(srcStart, srcStart + stageSpec.tile * 4), destStart);
      }
    });
  });

  const meta = {
    tile: stageSpec.tile,
    fps: stageSpec.fps,
    sheetWidth: width,
    sheetHeight: height,
    rows: stageSpec.rows.map((row) => ({ name: row.name, frames: row.files.length })),
  };

  const png = encodeRgbaPng({ width, height, data });
  return { png, meta, scale };
}

// Optional CLI arg picks one stage by name (e.g. `assets:young-baby` ==
// `ingest-images.mjs beaver-young-baby`) so a new figure's script doesn't
// require every OTHER stage's source frames to also exist locally; omitting
// the arg (`assets:ingest`) keeps the original "rebuild everything" behavior.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.join(import.meta.dirname, '..', '..');
  const srcDir = path.join(repoRoot, 'assets-src', 'beaver');
  if (!fs.existsSync(srcDir)) {
    throw new Error(`missing ${srcDir} — copy the source images there first (gitignored, not part of the repo)`);
  }

  const stageArg = process.argv[2];
  const stageSpecs = stageArg ? STAGE_SPECS.filter((spec) => spec.name === stageArg) : STAGE_SPECS;
  if (stageArg && stageSpecs.length === 0) {
    throw new Error(`unknown stage "${stageArg}" (expected one of: ${STAGE_SPECS.map((s) => s.name).join(', ')})`);
  }

  for (const stageSpec of stageSpecs) {
    const { png, meta, scale } = ingestStage(stageSpec, srcDir);
    const pngPath = path.join(repoRoot, 'assets', 'sprites', `${stageSpec.name}.png`);
    const metaPath = path.join(repoRoot, 'assets', 'sprites', `${stageSpec.name}.json`);
    fs.mkdirSync(path.dirname(pngPath), { recursive: true });
    fs.writeFileSync(pngPath, png);
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`wrote ${pngPath} (${meta.sheetWidth}x${meta.sheetHeight}, scale=${scale.toFixed(4)})`);
  }
}
