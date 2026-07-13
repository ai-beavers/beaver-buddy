import { describe, expect, it } from 'vitest';
import { encodeIndexedPng } from './png.ts';
import { buildSheet } from './sheet.ts';
import { buildContactSheet } from './contact-sheet.ts';
import { ANIMATIONS, ANIMATION_ORDER } from './pixel-maps/baby.ts';

const TILE = 32;
const FPS = 10;

describe('sprite generator', () => {
  it('is deterministic: two runs produce byte-identical PNGs', () => {
    const a = buildSheet(ANIMATIONS, ANIMATION_ORDER, TILE, FPS);
    const b = buildSheet(ANIMATIONS, ANIMATION_ORDER, TILE, FPS);
    expect(encodeIndexedPng(a.image).equals(encodeIndexedPng(b.image))).toBe(true);
    expect(a.meta).toEqual(b.meta);
  });

  it('every pixel is either the transparent index or a valid palette index', () => {
    const { image } = buildSheet(ANIMATIONS, ANIMATION_ORDER, TILE, FPS);
    const inRange = image.pixels.every((v) => v >= 0 && v < image.palette.length);
    expect(inRange).toBe(true);
    expect(image.transparentIndex).toBe(0);
  });

  it('sheet dimensions match the JSON metadata', () => {
    const { image, meta } = buildSheet(ANIMATIONS, ANIMATION_ORDER, TILE, FPS);
    expect(image.width).toBe(meta.sheetWidth);
    expect(image.height).toBe(meta.sheetHeight);
    expect(meta.sheetHeight).toBe(meta.rows.length * meta.tile);
    const maxFrames = Math.max(...meta.rows.map((r) => r.frames));
    expect(meta.sheetWidth).toBe(maxFrames * meta.tile);
    expect(meta.rows.map((r) => r.name)).toEqual([...ANIMATION_ORDER]);
    meta.rows.forEach((row, i) => {
      expect(row.frames).toBe(ANIMATIONS[ANIMATION_ORDER[i]].length);
    });
  });

  it('rejects a frame with an off-palette character', () => {
    const bad = {
      ...ANIMATIONS,
      idle: [
        [...ANIMATIONS.idle[0]].map((row, i) => (i === 0 ? row.slice(0, -1) + 'Z' : row)),
        ANIMATIONS.idle[1],
      ],
    };
    expect(() => buildSheet(bad, ANIMATION_ORDER, TILE, FPS)).toThrow();
  });

  it('contact sheet renders at the expected nearest-neighbor scale', () => {
    const contact = buildContactSheet(ANIMATIONS, ANIMATION_ORDER, TILE, 8);
    expect(contact.width % 8).toBe(0);
    expect(contact.height % 8).toBe(0);
    const inRange = contact.pixels.every((v) => v < contact.palette.length);
    expect(inRange).toBe(true);
  });
});
