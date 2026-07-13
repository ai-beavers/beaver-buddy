import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeIndexedPng } from './png.ts';
import { buildSheet, BEAVER_ANIMATION_ORDER, type Frame } from './sheet.ts';
import { buildContactSheet } from './contact-sheet.ts';
import { ANIMATIONS as BABY } from './pixel-maps/baby.ts';
import { ANIMATIONS as TEEN } from './pixel-maps/teen.ts';
import { ANIMATIONS as ADULT } from './pixel-maps/adult.ts';
import { LODGE_ANIMATIONS, LODGE_ANIMATION_ORDER } from './pixel-maps/lodge.ts';

const FPS = 10;

interface SheetCase {
  readonly name: string;
  /** Committed sheet basename under assets/sprites/. */
  readonly file: string;
  readonly animations: Readonly<Record<string, readonly Frame[]>>;
  readonly order: readonly string[];
  readonly tile: number;
  /** Beaver stages only: enforce the flat tail-paddle silhouette per frame. */
  readonly tailGuard: boolean;
}

const CASES: readonly SheetCase[] = [
  { name: 'baby', file: 'beaver-baby', animations: BABY, order: BEAVER_ANIMATION_ORDER, tile: 32, tailGuard: true },
  { name: 'teen', file: 'beaver-teen', animations: TEEN, order: BEAVER_ANIMATION_ORDER, tile: 32, tailGuard: true },
  { name: 'adult', file: 'beaver-adult', animations: ADULT, order: BEAVER_ANIMATION_ORDER, tile: 32, tailGuard: true },
  { name: 'lodge', file: 'lodge', animations: LODGE_ANIMATIONS, order: LODGE_ANIMATION_ORDER, tile: 48, tailGuard: false },
];

describe.each(CASES)('sprite generator: $name', ({ name, file, animations, order, tile, tailGuard }) => {
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

  // The flat paddle tail is the beaver's signature silhouette — it must
  // never degrade into a ball or vanish in any frame: a horizontal run of
  // >=8 filled pixels starting at x<=6, and the far-tail zone (x<=7) no
  // taller than 5 rows. Holds for every stage — the geometry was designed
  // so only the tail ever enters the far-left zone.
  it.skipIf(!tailGuard)('every frame keeps the flat tail-paddle silhouette', () => {
    for (const [anim, frames] of Object.entries(animations)) {
      frames.forEach((frame, i) => {
        let hasRun = false;
        for (const row of frame) {
          let run = 0;
          let start = -1;
          for (let x = 0; x < row.length; x += 1) {
            if (row[x] !== '.') {
              if (run === 0) start = x;
              run += 1;
              if (run >= 8 && start <= 6) hasRun = true;
            } else {
              run = 0;
            }
          }
        }
        expect(hasRun, `${name}.${anim}[${i}] lost the tail paddle`).toBe(true);

        const tailRows = frame
          .map((row, y) => ({ y, filled: [...row.slice(0, 8)].some((ch) => ch !== '.') }))
          .filter((r) => r.filled)
          .map((r) => r.y);
        const span = Math.max(...tailRows) - Math.min(...tailRows) + 1;
        expect(span, `${name}.${anim}[${i}] tail zone too tall (${span} rows)`).toBeLessThanOrEqual(5);
      });
    }
  });
});

describe('sheet validation', () => {
  it('rejects a frame with an off-palette character', () => {
    const bad = {
      ...BABY,
      idle: [
        [...BABY.idle[0]].map((row, i) => (i === 0 ? row.slice(0, -1) + 'Z' : row)),
        BABY.idle[1],
      ],
    };
    expect(() => buildSheet(bad, BEAVER_ANIMATION_ORDER, 32, FPS)).toThrow();
  });
});
