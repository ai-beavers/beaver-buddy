import { describe, expect, it } from 'vitest';
import { dropGreenFringe, groundTile, normalizeOutline, paletteOf, snapToPalette } from './ingest-video-frames.mjs';

// Tiny synthetic tiles — no gitignored assets-src sources needed, so this
// suite always runs (unlike the ingest suites keyed off local source dumps).
const img = (width: number, height: number, pixels: [number, number, number, number][]) => ({
  width,
  height,
  data: new Uint8ClampedArray(pixels.flat()),
});

const px = (tile: { data: Uint8ClampedArray }, i: number) => [...tile.data.subarray(i * 4, i * 4 + 4)];

describe('dropGreenFringe', () => {
  it('zeroes green-dominant pixels at any alpha, keeps everything else', () => {
    const out = dropGreenFringe(
      img(2, 2, [
        [0, 60, 0, 180], // dark chroma spill, semi-transparent
        [1, 40, 0, 255], // dark chroma spill, fully opaque
        [140, 90, 40, 255], // beaver brown
        [50, 60, 45, 255], // green-ish but within the 20-dominance margin
      ]),
    );
    expect(px(out, 0)).toEqual([0, 0, 0, 0]);
    expect(px(out, 1)).toEqual([0, 0, 0, 0]);
    expect(px(out, 2)).toEqual([140, 90, 40, 255]);
    expect(px(out, 3)).toEqual([50, 60, 45, 255]);
  });
});

describe('paletteOf', () => {
  it('collects only fully-opaque colors, deduplicated', () => {
    const colors = paletteOf(
      img(2, 2, [
        [10, 20, 30, 255],
        [10, 20, 30, 255],
        [200, 100, 50, 254], // semi-transparent — excluded
        [0, 0, 0, 0],
      ]),
    );
    expect(colors).toEqual([[10, 20, 30]]);
  });
});

describe('snapToPalette', () => {
  it('snaps opaque-enough pixels to the nearest palette color and hard-zeroes the rest', () => {
    const out = snapToPalette(
      img(2, 1, [
        [100, 60, 20, 200], // above threshold — snaps
        [100, 60, 20, 100], // below threshold — dropped
      ]),
      [
        [120, 80, 40],
        [0, 0, 0],
      ],
    );
    expect(px(out, 0)).toEqual([120, 80, 40, 255]);
    expect(px(out, 1)).toEqual([0, 0, 0, 0]);
  });
});

describe('normalizeOutline', () => {
  it('forces silhouette-boundary pixels to the outline color', () => {
    const out = normalizeOutline(
      img(3, 3, [
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
        [0, 0, 0, 0], [140, 90, 40, 255], [0, 0, 0, 0],
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      ]),
      [30, 20, 10],
    );
    expect(px(out, 4)).toEqual([30, 20, 10, 255]);
  });
});

describe('groundTile', () => {
  it('shifts content down so the lowest opaque row touches the tile bottom', () => {
    const out = groundTile(
      img(1, 4, [
        [0, 0, 0, 0],
        [140, 90, 40, 255],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    );
    expect(px(out, 3)).toEqual([140, 90, 40, 255]);
    expect(px(out, 1)).toEqual([0, 0, 0, 0]);
  });
});
