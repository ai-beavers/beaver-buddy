import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeIndexedPng } from './png.ts';
import { buildSheet, type Frame } from './sheet.ts';
import { buildContactSheet } from './contact-sheet.ts';
import { LODGE_ANIMATIONS, LODGE_ANIMATION_ORDER } from './pixel-maps/lodge.ts';

// Beaver stages (baby/teen) are ingested from the user's own images (BL-11,
// see ingest-images.test.ts) — this file now only covers the lodge sheet,
// the one sprite sheet still on the programmatic pixel-map pipeline.

const FPS = 10;

interface SheetCase {
  readonly name: string;
  readonly file: string;
  readonly animations: Readonly<Record<string, readonly Frame[]>>;
  readonly order: readonly string[];
  readonly tile: number;
}

const CASES: readonly SheetCase[] = [
  { name: 'lodge', file: 'lodge', animations: LODGE_ANIMATIONS, order: LODGE_ANIMATION_ORDER, tile: 48 },
];

describe.each(CASES)('sprite generator: $name', ({ file, animations, order, tile }) => {
  it('is deterministic: two runs produce byte-identical PNGs', () => {
    const a = buildSheet(animations, order, tile, FPS);
    const b = buildSheet(animations, order, tile, FPS);
    expect(encodeIndexedPng(a.image).equals(encodeIndexedPng(b.image))).toBe(true);
    expect(a.meta).toEqual(b.meta);
  });

  // Guards against stale or hand-edited committed assets: the in-process
  // determinism test above can't catch a sheet on disk that no longer
  // matches the pixel maps. Fails => run `npm run assets:build` and commit.
  it('committed PNG matches the generator output byte-for-byte', () => {
    const committed = fs.readFileSync(new URL(`../../assets/sprites/${file}.png`, import.meta.url));
    const { image } = buildSheet(animations, order, tile, FPS);
    expect(committed.equals(encodeIndexedPng(image))).toBe(true);
  });

  it('every pixel is either the transparent index or a valid palette index', () => {
    const { image } = buildSheet(animations, order, tile, FPS);
    const inRange = image.pixels.every((v) => v >= 0 && v < image.palette.length);
    expect(inRange).toBe(true);
    expect(image.transparentIndex).toBe(0);
  });

  it('sheet dimensions match the JSON metadata', () => {
    const { image, meta } = buildSheet(animations, order, tile, FPS);
    expect(image.width).toBe(meta.sheetWidth);
    expect(image.height).toBe(meta.sheetHeight);
    expect(meta.sheetHeight).toBe(meta.rows.length * meta.tile);
    const maxFrames = Math.max(...meta.rows.map((r) => r.frames));
    expect(meta.sheetWidth).toBe(maxFrames * meta.tile);
    expect(meta.rows.map((r) => r.name)).toEqual([...order]);
    meta.rows.forEach((row, i) => {
      expect(row.frames).toBe(animations[order[i]].length);
    });
  });

  it('contact sheet renders at the expected nearest-neighbor scale', () => {
    const contact = buildContactSheet(animations, order, tile, 8);
    expect(contact.width % 8).toBe(0);
    expect(contact.height % 8).toBe(0);
    const inRange = contact.pixels.every((v) => v < contact.palette.length);
    expect(inRange).toBe(true);
  });
});

describe('sheet validation', () => {
  it('rejects a frame with an off-palette character', () => {
    const bad = {
      ...LODGE_ANIMATIONS,
      idle: [
        [...LODGE_ANIMATIONS.idle[0]].map((row, i) => (i === 0 ? row.slice(0, -1) + 'Z' : row)),
      ],
    };
    expect(() => buildSheet(bad, LODGE_ANIMATION_ORDER, 48, FPS)).toThrow();
  });
});
