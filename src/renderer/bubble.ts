// Pixel speech bubble: pure layout math (wrap + clamp, unit-tested) plus a
// thin canvas draw function (untested glue, same split as sprites.ts's
// frameRect/drawFrame). No sprite library — plain canvas paths, matching
// ADR 001 §Animation/roaming.

import {
  BUBBLE_CHAR_WIDTH_PX,
  BUBBLE_FONT_PX,
  BUBBLE_LINE_HEIGHT_PX,
  BUBBLE_MAX_CHARS_PER_LINE,
  BUBBLE_OFFSET_ABOVE_PET_PX,
  BUBBLE_PADDING_PX,
  BUBBLE_TAIL_SIZE_PX,
} from './pet-config.js';

// STYLE.md palette: `8` cool off-white (fill), `k` cool slate darkest
// (outline + text) — the same 1px-outline slate used for every sprite.
const BUBBLE_FILL_COLOR = '#eef2ee';
const BUBBLE_OUTLINE_COLOR = '#2c3138';
const BUBBLE_TEXT_COLOR = '#2c3138';

export interface BubbleBounds {
  readonly width: number;
  readonly height: number;
}

export interface BubbleLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lines: readonly string[];
  readonly tailX: number; // relative to x, kept inside the rounded corners
}

// Greedy word-wrap by character count. Exported for its own test coverage.
export function wrapText(text: string, maxCharsPerLine: number = BUBBLE_MAX_CHARS_PER_LINE): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Pure geometry: wraps the text, sizes the box to it, and clamps the box
// inside bounds (the workArea) so the bubble never draws off-screen when
// the pet is near an edge. petX/petY are the pet's current top-left draw
// position — the bubble re-anchors to this every call, which is how it
// "follows" the pet while roaming (renderer.ts recomputes it every draw).
export function layoutBubble(
  text: string,
  petX: number,
  petY: number,
  petTilePx: number,
  bounds: BubbleBounds,
): BubbleLayout {
  const lines = wrapText(text);
  const longestLine = Math.max(...lines.map((line) => line.length), 1);
  const width = longestLine * BUBBLE_CHAR_WIDTH_PX + 2 * BUBBLE_PADDING_PX;
  const height = lines.length * BUBBLE_LINE_HEIGHT_PX + 2 * BUBBLE_PADDING_PX;

  const petCenterX = petX + petTilePx / 2;
  const idealX = petCenterX - width / 2;
  const idealY = petY - height - BUBBLE_OFFSET_ABOVE_PET_PX - BUBBLE_TAIL_SIZE_PX;

  const x = Math.round(Math.min(Math.max(idealX, 0), Math.max(0, bounds.width - width)));
  const y = Math.round(Math.min(Math.max(idealY, 0), Math.max(0, bounds.height - height)));

  // Tail points at the pet's horizontal center, clamped so its tip stays
  // clear of the rounded-ish corners even when the box itself got clamped
  // away from directly above the pet (pet near a screen edge).
  const tailMargin = 2 * BUBBLE_TAIL_SIZE_PX + BUBBLE_PADDING_PX;
  const tailX = Math.round(Math.min(Math.max(petCenterX - x, tailMargin), width - tailMargin));

  return { x, y, width, height, lines, tailX };
}

export function drawBubble(ctx: CanvasRenderingContext2D, layout: BubbleLayout): void {
  const { x, y, width, height, lines, tailX } = layout;

  ctx.save();
  ctx.fillStyle = BUBBLE_FILL_COLOR;
  ctx.fillRect(x, y, width, height);

  // Tail: a small triangle from the bubble's bottom edge, filled the same
  // as the body so it reads as one shape before the outline pass.
  ctx.beginPath();
  ctx.moveTo(x + tailX - BUBBLE_TAIL_SIZE_PX, y + height);
  ctx.lineTo(x + tailX + BUBBLE_TAIL_SIZE_PX, y + height);
  ctx.lineTo(x + tailX, y + height + BUBBLE_TAIL_SIZE_PX);
  ctx.closePath();
  ctx.fill();

  // Crisp 1px outline: the +0.5 offset lands the stroke on a pixel center
  // instead of a pixel boundary (this is a vector path, not a sprite blit,
  // so it needs the standard canvas crisp-line trick that drawFrame's
  // integer-position drawImage calls don't).
  ctx.strokeStyle = BUBBLE_OUTLINE_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.beginPath();
  ctx.moveTo(x + tailX - BUBBLE_TAIL_SIZE_PX + 0.5, y + height + 0.5);
  ctx.lineTo(x + tailX + 0.5, y + height + BUBBLE_TAIL_SIZE_PX + 0.5);
  ctx.lineTo(x + tailX + BUBBLE_TAIL_SIZE_PX + 0.5, y + height + 0.5);
  ctx.stroke();

  ctx.fillStyle = BUBBLE_TEXT_COLOR;
  // Integer glyph origin keeps strokes on the CSS-pixel grid; HiDPI sharpness
  // comes from renderer.ts's devicePixelRatio backing store, not from font hacks.
  ctx.font = `bold ${BUBBLE_FONT_PX}px monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    const textX = Math.round(x + BUBBLE_PADDING_PX);
    const textY = Math.round(y + BUBBLE_PADDING_PX + i * BUBBLE_LINE_HEIGHT_PX);
    ctx.fillText(line, textX, textY);
  });
  ctx.restore();
}
