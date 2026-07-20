// Sheet layout math for baked output. Produces exactly the meta shape the
// app's renderer consumes (src/renderer/sprites.ts: SheetMeta) and the same
// frame-cell addressing (sx = frame * tile, sy = rowIndex * tile), so a baked
// sheet is a drop-in replacement for an ingested one.
//
// Pure module — no DOM/PixiJS access, so vitest can cross-check against
// sprites.ts's frameRect.

export interface BakedRow {
  readonly name: string;
  readonly frames: number;
}

export interface SheetLayout {
  readonly tile: number;
  readonly fps: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly rows: readonly BakedRow[];
}

// Width follows the widest row; every row gets one tile-high strip. This is
// the same convention frameRect() in the app uses (column = frame index,
// row = animation index), so empty cells in shorter rows stay transparent.
export function layoutSheet(rows: readonly BakedRow[], tile: number, fps: number): SheetLayout {
  if (rows.length === 0) {
    throw new Error('layoutSheet needs at least one row');
  }
  const maxFrames = Math.max(...rows.map((row) => row.frames));
  if (!Number.isInteger(tile) || tile <= 0) {
    throw new Error(`tile must be a positive integer, got: ${tile}`);
  }
  for (const row of rows) {
    if (!Number.isInteger(row.frames) || row.frames <= 0) {
      throw new Error(`row "${row.name}": frames must be a positive integer`);
    }
  }
  return {
    tile,
    fps,
    sheetWidth: maxFrames * tile,
    sheetHeight: rows.length * tile,
    rows,
  };
}

export interface FrameCell {
  readonly sx: number;
  readonly sy: number;
  readonly size: number;
}

// Mirrors sprites.ts's frameRect exactly (column wrap included), so baked
// sheets and app-loaded sheets can never drift apart in addressing.
export function frameCell(layout: SheetLayout, rowIndex: number, frameIndex: number): FrameCell {
  const row = layout.rows[rowIndex];
  if (!row) {
    throw new Error(`unknown row index: ${rowIndex}`);
  }
  const frame = ((frameIndex % row.frames) + row.frames) % row.frames;
  return { sx: frame * layout.tile, sy: rowIndex * layout.tile, size: layout.tile };
}
