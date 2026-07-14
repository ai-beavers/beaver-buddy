import { describe, expect, it } from 'vitest';
import { frameRect, type SheetMeta } from './sprites.js';

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
    expect(frameRect(meta, 'idle', 0)).toEqual({ sx: 0, sy: 0, size: 32 });
  });

  it('locates a later row at its row offset', () => {
    // 'walk' is row index 1 -> sy = 1 * 32
    expect(frameRect(meta, 'walk', 1)).toEqual({ sx: 32, sy: 32, size: 32 });
  });

  it('wraps the frame index within the row frame count', () => {
    // 'idle' has 2 frames; index 2 should wrap back to column 0.
    expect(frameRect(meta, 'idle', 2)).toEqual({ sx: 0, sy: 0, size: 32 });
    expect(frameRect(meta, 'idle', 3)).toEqual({ sx: 32, sy: 0, size: 32 });
  });

  it('wraps negative frame indices into range', () => {
    expect(frameRect(meta, 'walk', -1)).toEqual({ sx: 96, sy: 32, size: 32 });
  });

  it('throws on an unknown animation name', () => {
    expect(() => frameRect(meta, 'nope', 0)).toThrow(/unknown animation row/);
  });
});
