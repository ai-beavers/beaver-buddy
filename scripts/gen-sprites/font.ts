// Minimal 5-row pixel bitmap font, variable width per glyph — only the
// letters the contact sheet's row labels need (IDLE, WALK, RUN, SLEEP,
// REACT). Not a general-purpose font; add a glyph if a future row label
// needs one, don't pre-draw the alphabet.

export const GLYPH_H = 5;
const FALLBACK_W = 4; // advance for unsupported chars (e.g. space)

const GLYPHS: Record<string, readonly string[]> = {
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  B: ['###.', '#..#', '###.', '#..#', '###.'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  E: ['####', '#...', '###.', '#...', '####'],
  I: ['##', '##', '##', '##', '##'],
  K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
  L: ['#...', '#...', '#...', '#...', '####'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  P: ['###.', '#..#', '###.', '#...', '#...'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  T: ['####', '.#..', '.#..', '.#..', '.#..'],
  U: ['#..#', '#..#', '#..#', '#..#', '.##.'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
};

const glyphWidth = (ch: string): number => GLYPHS[ch]?.[0].length ?? FALLBACK_W;

/** Calls `set(x, y)` for every lit pixel of `text` drawn at (x0, y0); 1px gap between glyphs. */
export function drawText(text: string, x0: number, y0: number, set: (x: number, y: number) => void): void {
  let gx = x0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < glyph[row].length; col += 1) {
          if (glyph[row][col] === '#') set(gx + col, y0 + row);
        }
      }
    }
    gx += glyphWidth(ch) + 1;
  }
}

export function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch) + 1;
  return w - 1;
}
