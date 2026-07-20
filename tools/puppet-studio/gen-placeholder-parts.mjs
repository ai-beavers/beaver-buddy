// Generates crude placeholder part images so the studio + bake pipeline can
// be exercised end-to-end before real ComfyUI parts exist. Output goes to
// assets-src/parts/ (gitignored — placeholders never ship). Real parts come
// from the ComfyUI `PixelArt Builder` workflow (docs/comfyui-avatar-generation.md).
//
// Usage: npm run studio:parts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeRgbaPng } from '../../scripts/gen-sprites/png.ts';

const studioRoot = fileURLToPath(new URL('.', import.meta.url));
const partsRoot = path.resolve(studioRoot, '..', '..', 'assets-src', 'parts');

const TRANSPARENT = [0, 0, 0, 0];

function makeImage(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set(TRANSPARENT, i * 4);
  }
  return { width, height, data };
}

function setPixel(img, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

function fillEllipse(img, cx, cy, rx, ry, color) {
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(img, x, y, color);
    }
  }
}

function fillRect(img, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      setPixel(img, x, y, color);
    }
  }
}

function fillHalfEllipseTop(img, cx, cy, rx, ry, color) {
  // Dome: upper half of an ellipse centered at (cx, cy).
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (y + 0.5 <= cy && dx * dx + dy * dy <= 1) setPixel(img, x, y, color);
    }
  }
}

function write(dir, name, img) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  fs.writeFileSync(file, encodeRgbaPng(img));
  console.log(`wrote ${file} (${img.width}x${img.height})`);
}

const FUR = [138, 90, 59, 255];
const FUR_LIGHT = [154, 106, 72, 255];
const DARK = [58, 36, 24, 255];
const TAIL = [74, 48, 32, 255];
const CANOPY = [192, 64, 64, 255];
const CANOPY_SHADE = [160, 48, 48, 255];
const LEAF = [63, 122, 63, 255];
const TRUNK = [90, 58, 34, 255];

const beaverDir = path.join(partsRoot, 'beaver-baby');

{
  const body = makeImage(40, 30);
  fillEllipse(body, 20, 15, 19, 14, FUR);
  write(beaverDir, 'body', body);
}
{
  const head = makeImage(28, 24);
  fillEllipse(head, 14, 12, 13, 11, FUR_LIGHT);
  write(beaverDir, 'head', head);
}
{
  const tail = makeImage(32, 16);
  fillEllipse(tail, 16, 8, 15, 7, TAIL);
  write(beaverDir, 'tail', tail);
}
for (const name of ['leg-front', 'leg-back']) {
  const leg = makeImage(10, 16);
  fillRect(leg, 2, 0, 6, 14, DARK);
  fillRect(leg, 1, 12, 8, 4, DARK);
  write(beaverDir, name, leg);
}
{
  const eye = makeImage(6, 6);
  fillRect(eye, 0, 0, 6, 6, [255, 255, 255, 255]);
  fillRect(eye, 2, 2, 3, 3, [20, 16, 12, 255]);
  write(beaverDir, 'eye-open', eye);
}
{
  const eye = makeImage(6, 6);
  fillRect(eye, 0, 2, 6, 2, [20, 16, 12, 255]);
  write(beaverDir, 'eye-closed', eye);
}
{
  const canopy = makeImage(48, 24);
  fillHalfEllipseTop(canopy, 24, 23, 23, 22, CANOPY);
  fillHalfEllipseTop(canopy, 24, 23, 15, 14, CANOPY_SHADE);
  write(beaverDir, 'canopy', canopy);
}

const treeDir = path.join(partsRoot, 'tree');
for (const [stage, w, h, leafR] of [[1, 24, 24, 7], [2, 40, 48, 15], [3, 56, 72, 23]]) {
  const tree = makeImage(w, h);
  fillRect(tree, Math.floor(w / 2) - 2, Math.floor(h * 0.55), 4, h - Math.floor(h * 0.55), TRUNK);
  fillEllipse(tree, w / 2, Math.floor(h * 0.38), leafR, leafR, LEAF);
  write(treeDir, `tree-stage-${stage}`, tree);
}

console.log('placeholder parts ready — start the studio with: npm run studio');
