// Minimal 4x5 pixel bitmap font — only the letters the contact sheet's row
// labels need (IDLE, WALK, RUN, SLEEP, REACT). Not a general-purpose font;
// add a glyph if a future row label needs one, don't pre-draw the alphabet.

export const GLYPH_W = 4;
export const GLYPH_H = 5;

const GLYPHS: Record<string, readonly string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  E: ['####', '#...', '###.', '#...', '####'],
  I: ['.##.', '.##.', '.##.', '.##.', '.##.'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  L: ['#...', '#...', '#...', '#...', '####'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['####', '.#..', '.#..', '.#..', '.#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  W: ['#..#', '#..#', '#.##', '##.#', '#..#'],
};

/** Calls `set(x, y)` for every lit pixel of `text` drawn at (x0, y0), one char per GLYPH_W+1 px. */
export function drawText(text: string, x0: number, y0: number, set: (x: number, y: number) => void): void {
  for (let i = 0; i < text.length; i += 1) {
    const glyph = GLYPHS[text[i]];
    if (!glyph) continue; // unsupported char (e.g. space): skip, still advances cursor
    const gx = x0 + i * (GLYPH_W + 1);
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === '#') set(gx + col, y0 + row);
      }
    }
  }
}

export function textWidth(text: string): number {
  return text.length * (GLYPH_W + 1) - 1;
}
