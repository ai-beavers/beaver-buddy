import { describe, expect, it } from 'vitest';
import { frameRect, type SheetMeta } from '../../src/renderer/sprites.js';
import { frameCell, layoutSheet } from './sheet.js';

describe('sheet: layoutSheet', () => {
  it('sizes the sheet by the widest row and one tile per row', () => {
    const layout = layoutSheet([{ name: 'idle', frames: 2 }, { name: 'walk', frames: 4 }, { name: 'react', frames: 1 }], 96, 8);
    expect(layout.sheetWidth).toBe(4 * 96);
    expect(layout.sheetHeight).toBe(3 * 96);
    expect(layout.rows.map((r) => r.name)).toEqual(['idle', 'walk', 'react']);
  });

  it('rejects empty rows and bad tiles', () => {
    expect(() => layoutSheet([], 96, 8)).toThrow('at least one row');
    expect(() => layoutSheet([{ name: 'x', frames: 0 }], 96, 8)).toThrow('frames must be a positive integer');
    expect(() => layoutSheet([{ name: 'x', frames: 1 }], 0, 8)).toThrow('tile must be a positive integer');
  });
});

describe('sheet: frameCell matches the app renderer addressing', () => {
  it('is identical to sprites.ts frameRect for the same meta', () => {
    const rows = [
      { name: 'idle', frames: 2 },
      { name: 'walk', frames: 4 },
      { name: 'parachute', frames: 8 },
    ];
    const layout = layoutSheet(rows, 96, 8);
    const meta: SheetMeta = { tile: 96, fps: 8, sheetWidth: layout.sheetWidth, sheetHeight: layout.sheetHeight, rows };

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      for (let frame = 0; frame < 10; frame += 1) {
        expect(frameCell(layout, rowIndex, frame)).toEqual(frameRect(meta, rows[rowIndex].name, frame));
      }
    }
  });
});
