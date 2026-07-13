// Design-review contact sheet: every frame of a stage, laid out in labeled
// rows on a light checkerboard, scaled 8x nearest-neighbor so it's readable
// without a pixel-art viewer. Composited at native resolution first
// (checkerboard, labels, frames all just pixels) then scaled as a whole —
// nearest-neighbor scaling a bitmap font is normal pixel-art practice, it
// stays crisp and blocky like everything else here.

import { buildPaletteTable, TRANSPARENT } from './palette.ts';
import { drawText, textWidth, GLYPH_H } from './font.ts';
import type { IndexedImage } from './png.ts';
import type { Frame } from './sheet.ts';

const CHECKER_SIZE = 4;
const ROW_PAD = 4;
const LABEL_MARGIN = 6;
const OUTLINE_CHAR = 'k';

export function buildContactSheet(
  animations: Readonly<Record<string, readonly Frame[]>>,
  animationOrder: readonly string[],
  tile: number,
  scale: number,
): IndexedImage {
  const table = buildPaletteTable({
    chkA: [0xe9, 0xe9, 0xe3],
    chkB: [0xf7, 0xf7, 0xf1],
  });
  const maxFrames = Math.max(...animationOrder.map((name) => animations[name].length));
  const labelW = LABEL_MARGIN * 2 + Math.max(...animationOrder.map((name) => textWidth(name.toUpperCase())));
  const rowH = tile + ROW_PAD;
  const width = labelW + maxFrames * tile;
  const height = animationOrder.length * rowH + ROW_PAD;

  const native = new Uint8Array(width * height);
  const set = (x: number, y: number, idx: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) native[y * width + x] = idx;
  };

  // checkerboard background everywhere
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const square = Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE);
      set(x, y, table.indexOf[square % 2 === 0 ? 'chkA' : 'chkB']);
    }
  }

  animationOrder.forEach((name, rowIndex) => {
    const rowY = ROW_PAD + rowIndex * rowH;
    const label = name.toUpperCase();
    drawText(label, LABEL_MARGIN, rowY + Math.floor((tile - GLYPH_H) / 2), (x, y) =>
      set(x, y, table.indexOf[OUTLINE_CHAR]),
    );

    animations[name].forEach((frame, frameIndex) => {
      const originX = labelW + frameIndex * tile;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const ch = frame[y][x];
          if (ch === TRANSPARENT) continue;
          set(originX + x, rowY + y, table.indexOf[ch]);
        }
      }
    });
  });

  // nearest-neighbor upscale
  const scaledW = width * scale;
  const scaledH = height * scale;
  const scaled = new Uint8Array(scaledW * scaledH);
  for (let y = 0; y < scaledH; y += 1) {
    const srcY = Math.floor(y / scale);
    for (let x = 0; x < scaledW; x += 1) {
      scaled[y * scaledW + x] = native[srcY * width + Math.floor(x / scale)];
    }
  }

  return { width: scaledW, height: scaledH, pixels: scaled, palette: table.colors, transparentIndex: 0 };
}
