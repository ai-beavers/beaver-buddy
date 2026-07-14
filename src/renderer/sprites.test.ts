import { describe, expect, it } from 'vitest';
import { frameRect, type SheetMeta } from './sprites.js';

const meta: SheetMeta = {
  tile: 32,
  fps: 10,
  sheetWidth: 128,
  sheetHeight: 160,
  rows: [
    { name: 'idle', frames: 2 },
    { name: 'walk', frames: 4 },
    { name: 'run', frames: 4 },
    { name: 'sleep', frames: 2 },
    { name: 'react', frames: 4 },
  ],
};

describe('sprites: frameRect', () => {
  it('locates the first frame of the first row at the origin', () => {
    expect(frameRect(meta, 'idle', 0)).toEqual({ sx: 0, sy: 0, size: 32 });
  });

  it('locates a later row at its row offset', () => {
    // 'run' is row index 2 -> sy = 2 * 32
    expect(frameRect(meta, 'run', 1)).toEqual({ sx: 32, sy: 64, size: 32 });
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
