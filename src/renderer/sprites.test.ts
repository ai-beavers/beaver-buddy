import { describe, expect, it, vi } from 'vitest';
import { drawFrame, frameRect, type Sheet, type SheetMeta } from './sprites.js';

// Row names/counts match the app's actual (BL-11-slimmed) sheets — see
// assets/STYLE.md — but frameRect's row-lookup/wrap math is generic over
// any row list, so this fixture is just realistic, not load-bearing.
const meta: SheetMeta = {
  tile: 32,
  fps: 8,
  sheetWidth: 128,
  sheetHeight: 64,
  rows: [
    { name: 'idle', frames: 2 },
    { name: 'walk', frames: 4 },
  ],
};

describe('sprites: frameRect', () => {
  it('locates the first frame of the first row at the origin', () => {
    expect(frameRect(meta, 'idle', 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
  });

  it('locates a later row at its row offset', () => {
    // 'walk' is row index 1 -> sy = 1 * 32
    expect(frameRect(meta, 'walk', 1)).toEqual({ sx: 32, sy: 32, sw: 32, sh: 32 });
  });

  it('wraps the frame index within the row frame count', () => {
    // 'idle' has 2 frames; index 2 should wrap back to column 0.
    expect(frameRect(meta, 'idle', 2)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
    expect(frameRect(meta, 'idle', 3)).toEqual({ sx: 32, sy: 0, sw: 32, sh: 32 });
  });

  it('wraps negative frame indices into range', () => {
    expect(frameRect(meta, 'walk', -1)).toEqual({ sx: 96, sy: 32, sw: 32, sh: 32 });
  });

  it('throws on an unknown animation name', () => {
    expect(() => frameRect(meta, 'nope', 0)).toThrow(/unknown animation row/);
  });

  // Backward compat: no row in this fixture sets `height`, so every sy/sw/sh
  // must equal the old rowIndex*tile / tile / tile math exactly (BL-19).
  it('a uniform sheet with no height field renders identically to the pre-BL-19 shape', () => {
    expect(frameRect(meta, 'idle', 0)).toEqual({ sx: 0, sy: 0, sw: meta.tile, sh: meta.tile });
    expect(frameRect(meta, 'walk', 0)).toEqual({ sx: 0, sy: meta.tile, sw: meta.tile, sh: meta.tile });
  });

  it('cumulative sy accounts for a variable-height row before the target row', () => {
    const tallMeta: SheetMeta = {
      tile: 32,
      fps: 8,
      sheetWidth: 128,
      sheetHeight: 96,
      rows: [
        { name: 'idle', frames: 2 }, // height defaults to tile (32)
        { name: 'parachute-wind', frames: 4, height: 48 }, // taller row
        { name: 'land', frames: 2 }, // back to base tile height
      ],
    };
    // idle: unaffected, sits at y=0.
    expect(frameRect(tallMeta, 'idle', 0)).toEqual({ sx: 0, sy: 0, sw: 32, sh: 32 });
    // parachute-wind: starts right after idle's 32px, and is 48px tall.
    expect(frameRect(tallMeta, 'parachute-wind', 0)).toEqual({ sx: 0, sy: 32, sw: 32, sh: 48 });
    // land: starts after idle (32) + parachute-wind (48) = 80, back to 32px tall.
    expect(frameRect(tallMeta, 'land', 1)).toEqual({ sx: 32, sy: 80, sw: 32, sh: 32 });
  });
});

// No canvas/jsdom in this project's vitest env — drawFrame only touches ctx
// through the CanvasRenderingContext2D methods it calls, so a plain object
// of vi.fn() spies stands in for the real context.
function fakeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('sprites: drawFrame anchoring', () => {
  const tallMeta: SheetMeta = {
    tile: 32,
    fps: 8,
    sheetWidth: 32,
    sheetHeight: 80,
    rows: [
      { name: 'idle', frames: 1 },
      { name: 'tall', frames: 1, height: 48 },
    ],
  };
  const sheet: Sheet = { image: {} as HTMLImageElement, meta: tallMeta };

  it('keeps the feet baseline (bottom of the drawn frame) fixed regardless of row height', () => {
    const x = 100;
    const y = 100;
    const scale = 2;
    const groundY = y + tallMeta.tile * scale; // 164 — same ground line every draw call.

    const idleCtx = fakeCtx();
    drawFrame(idleCtx, sheet, 'idle', 0, x, y, { mirror: false, rotationDeg: 0, scale });
    const idleTranslateArgs = (idleCtx.translate as ReturnType<typeof vi.fn>).mock.calls[0] as number[];
    const idleDrawArgs = (idleCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0] as number[];
    // drawImage(image, sx, sy, sw, sh, dx, dy, destW, destH) — destH is the last arg.
    const idleDestH = idleDrawArgs[idleDrawArgs.length - 1];
    expect(idleTranslateArgs[1] + idleDestH / 2).toBe(groundY);

    const tallCtx = fakeCtx();
    drawFrame(tallCtx, sheet, 'tall', 0, x, y, { mirror: false, rotationDeg: 0, scale });
    const tallTranslateArgs = (tallCtx.translate as ReturnType<typeof vi.fn>).mock.calls[0] as number[];
    const tallDrawArgs = (tallCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0] as number[];
    const tallDestH = tallDrawArgs[tallDrawArgs.length - 1];
    expect(tallTranslateArgs[1] + tallDestH / 2).toBe(groundY);
  });
});
