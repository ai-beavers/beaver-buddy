// Intake for ComfyUI parts runs: trims each part crop to its alpha bounding
// box and downscales it to the rig's part size (premultiplied-alpha
// area-average — avoids black fringing, same technique as
// scripts/gen-sprites/ingest-images.mjs). Output lands in
// assets-src/parts/<rig>/ (committed source assets), overwriting the
// placeholders.
//
// Usage: node tools/puppet-studio/ingest-parts.mjs <runDir> <rigName>
//   e.g. node tools/puppet-studio/ingest-parts.mjs assets-src/comfyui/parts-run-1 beaver-baby
//
// The per-part target heights below encode the rig's proportions; after
// running, update rigs/<rig>.json pivots/positions to the printed dimensions.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../scripts/gen-sprites/ingest-images.mjs';
import { encodeRgbaPng } from '../../scripts/gen-sprites/png.ts';

const [runDir, rigName] = process.argv.slice(2);
if (!runDir || !rigName) {
  console.error('usage: node tools/puppet-studio/ingest-parts.mjs <runDir> <rigName>');
  process.exit(1);
}

const studioRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = path.resolve(studioRoot, '..', '..', 'assets-src', 'parts', rigName);

// source file (in runDir) -> output file + target height in px (rig scale).
const PART_SPECS = [
  { src: 'torso.png', out: 'body.png', targetH: 30 },
  { src: 'head.png', out: 'head.png', targetH: 24 },
  { src: 'tail.png', out: 'tail.png', targetH: 16 },
  { src: 'leg-front.png', out: 'leg-front.png', targetH: 16 },
  { src: 'leg-back.png', out: 'leg-back.png', targetH: 16 },
  { src: 'eye-open.png', out: 'eye-open.png', targetH: 6 },
  { src: 'eye-closed.png', out: 'eye-closed.png', targetH: 6 },
  { src: 'canopy.png', out: 'canopy.png', targetH: 24 },
];

const ALPHA_THRESHOLD = 16;

function contentBBox(img) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('no opaque pixels found');
  return { minX, minY, maxX, maxY };
}

function crop(img, box) {
  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcStart = ((box.minY + y) * img.width + box.minX) * 4;
    data.set(img.data.subarray(srcStart, srcStart + width * 4), y * width * 4);
  }
  return { width, height, data };
}

// Area-average downscale to targetH with premultiplied alpha, preserving
// aspect ratio. Each output pixel averages the source rect it covers.
function downscale(img, targetH) {
  const scale = targetH / img.height;
  const outW = Math.max(1, Math.round(img.width * scale));
  const outH = Math.max(1, Math.round(img.height * scale));
  const data = new Uint8Array(outW * outH * 4);

  for (let oy = 0; oy < outH; oy += 1) {
    for (let ox = 0; ox < outW; ox += 1) {
      const sx0 = Math.floor(ox / scale);
      const sy0 = Math.floor(oy / scale);
      const sx1 = Math.max(sx0 + 1, Math.ceil((ox + 1) / scale));
      const sy1 = Math.max(sy0 + 1, Math.ceil((oy + 1) / scale));
      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let n = 0;
      for (let sy = sy0; sy < Math.min(sy1, img.height); sy += 1) {
        for (let sx = sx0; sx < Math.min(sx1, img.width); sx += 1) {
          const i = (sy * img.width + sx) * 4;
          const a = img.data[i + 3];
          sumR += img.data[i] * a;
          sumG += img.data[i + 1] * a;
          sumB += img.data[i + 2] * a;
          sumA += a;
          n += 1;
        }
      }
      const o = (oy * outW + ox) * 4;
      const outA = Math.round(sumA / n);
      data[o] = sumA > 0 ? Math.round(sumR / sumA) : 0;
      data[o + 1] = sumA > 0 ? Math.round(sumG / sumA) : 0;
      data[o + 2] = sumA > 0 ? Math.round(sumB / sumA) : 0;
      data[o + 3] = outA;
    }
  }
  return { width: outW, height: outH, data };
}

fs.mkdirSync(outDir, { recursive: true });
const summary = {};
for (const spec of PART_SPECS) {
  const srcPath = path.join(runDir, spec.src);
  if (!fs.existsSync(srcPath)) {
    console.error(`missing source: ${srcPath}`);
    process.exit(1);
  }
  const decoded = decodePng(fs.readFileSync(srcPath));
  const trimmed = crop(decoded, contentBBox(decoded));
  const scaled = downscale(trimmed, spec.targetH);
  const outPath = path.join(outDir, spec.out);
  fs.writeFileSync(outPath, encodeRgbaPng(scaled));
  summary[spec.out] = { width: scaled.width, height: scaled.height };
  console.log(`${spec.src} -> ${spec.out}: ${decoded.width}x${decoded.height} -> ${scaled.width}x${scaled.height}`);
}
console.log(`\nwrote ${PART_SPECS.length} parts to ${outDir}`);
console.log(`dims: ${JSON.stringify(summary)}`);
