import { describe, expect, it } from 'vitest';
import { layoutBubble, wrapText } from './bubble.js';
import { BUBBLE_CHAR_WIDTH_PX, BUBBLE_MAX_CHARS_PER_LINE, BUBBLE_PADDING_PX } from './pet-config.js';

describe('bubble: wrapText', () => {
  it('keeps a short line on one line', () => {
    expect(wrapText('hi there')).toEqual(['hi there']);
  });

  it('wraps at word boundaries once maxCharsPerLine is exceeded', () => {
    const lines = wrapText('one two three four five six seven eight', 12);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(12);
    }
    expect(lines.join(' ')).toBe('one two three four five six seven eight');
  });

  it('uses BUBBLE_MAX_CHARS_PER_LINE by default', () => {
    const long = 'a'.repeat(BUBBLE_MAX_CHARS_PER_LINE + 5);
    const lines = wrapText(long);
    // A single word longer than the limit can't be split without hyphenation
    // (none of our canned quips have one) — it's kept whole on its own line.
    expect(lines).toEqual([long]);
  });
});

describe('bubble: layoutBubble sizing', () => {
  it('sizes the box to the longest wrapped line plus padding', () => {
    const layout = layoutBubble('hi', 100, 100, 32, { width: 2000, height: 2000 });
    expect(layout.lines).toEqual(['hi']);
    expect(layout.width).toBe('hi'.length * BUBBLE_CHAR_WIDTH_PX + 2 * BUBBLE_PADDING_PX);
  });

  it('centers above the pet when there is room', () => {
    const layout = layoutBubble('hi', 500, 500, 32, { width: 2000, height: 2000 });
    const petCenterX = 500 + 32 / 2;
    expect(layout.x + layout.width / 2).toBeCloseTo(petCenterX, 0);
    expect(layout.y).toBeLessThan(500); // above the pet's y
  });
});

describe('bubble: layoutBubble clamping', () => {
  it('clamps x so the bubble never draws left of the workArea', () => {
    const layout = layoutBubble('a long quip line here', 0, 500, 32, { width: 2000, height: 2000 });
    expect(layout.x).toBeGreaterThanOrEqual(0);
  });

  it('clamps x so the bubble never draws past the right edge of the workArea', () => {
    const bounds = { width: 200, height: 2000 };
    const layout = layoutBubble('a long quip line here', 190, 500, 32, bounds);
    expect(layout.x + layout.width).toBeLessThanOrEqual(bounds.width);
  });

  it('clamps y so the bubble never draws above the top of the workArea', () => {
    // Pet right at the top edge: an unclamped bubble would go negative.
    const layout = layoutBubble('hi', 500, 0, 32, { width: 2000, height: 2000 });
    expect(layout.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps the tail tip within the bubble width', () => {
    const layout = layoutBubble('a long quip line here', 190, 500, 32, { width: 200, height: 2000 });
    expect(layout.tailX).toBeGreaterThanOrEqual(0);
    expect(layout.tailX).toBeLessThanOrEqual(layout.width);
  });
});
