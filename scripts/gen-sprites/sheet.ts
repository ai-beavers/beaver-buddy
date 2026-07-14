// Pure sheet-composition logic: turn { animationName: Frame[] } pixel maps
// into one indexed-PNG-ready image plus the JSON metadata the renderer
// needs. No filesystem access here — build.ts does the writing — so this
// (and the things it calls) is what the vitest determinism/compliance test
// exercises directly.

import { buildPaletteTable, TRANSPARENT, type PaletteTable } from './palette.ts';
import type { IndexedImage } from './png.ts';

/** One tile: `tile` strings of length `tile`, one palette char (or '.') per pixel. */
export type Frame = readonly string[];

export interface SheetMeta {
  readonly tile: number;
  readonly fps: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly rows: readonly { readonly name: string; readonly frames: number }[];
  /** Free-form encoding notes (e.g. how particle tiles are laid out). */
  readonly note?: string;
}

export function validateFrame(frame: Frame, tile: number, table: PaletteTable, context: string): void {
  if (frame.length !== tile) {
    throw new Error(`${context}: expected ${tile} rows, got ${frame.length}`);
  }
  frame.forEach((row, y) => {
    if (row.length !== tile) {
      throw new Error(`${context} row ${y}: expected ${tile} cols, got ${row.length}`);
    }
    for (const ch of row) {
      if (ch !== TRANSPARENT && !(ch in table.indexOf)) {
        throw new Error(`${context} row ${y}: '${ch}' is not in the palette or '${TRANSPARENT}'`);
      }
    }
  });
}

export function buildSheet(
  animations: Readonly<Record<string, readonly Frame[]>>,
  animationOrder: readonly string[],
  tile: number,
  fps: number,
  note?: string,
): { image: IndexedImage; meta: SheetMeta } {
  const table = buildPaletteTable();
  const maxFrames = Math.max(...animationOrder.map((name) => animations[name].length));
  const width = maxFrames * tile;
  const height = animationOrder.length * tile;
  const pixels = new Uint8Array(width * height); // 0 = transparent

  animationOrder.forEach((name, rowIndex) => {
    const frames = animations[name];
    frames.forEach((frame, frameIndex) => {
      validateFrame(frame, tile, table, `${name}[${frameIndex}]`);
      const originX = frameIndex * tile;
      const originY = rowIndex * tile;
      for (let y = 0; y < tile; y += 1) {
        for (let x = 0; x < tile; x += 1) {
          const ch = frame[y][x];
          if (ch === TRANSPARENT) continue;
          pixels[(originY + y) * width + (originX + x)] = table.indexOf[ch];
        }
      }
    });
  });

  const meta: SheetMeta = {
    tile,
    fps,
    sheetWidth: width,
    sheetHeight: height,
    rows: animationOrder.map((name) => ({ name, frames: animations[name].length })),
    ...(note === undefined ? {} : { note }),
  };

  return {
    image: { width, height, pixels, palette: table.colors, transparentIndex: 0 },
    meta,
  };
}
