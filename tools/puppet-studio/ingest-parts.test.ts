import { describe, expect, it } from 'vitest';
import { keyIfNeeded, RIG_PART_SPECS } from './ingest-parts.mjs';

describe('ingest-parts: preKeyed gate', () => {
  it('marks beaver-baby preKeyed and tree not preKeyed', () => {
    expect(RIG_PART_SPECS['beaver-baby'].preKeyed).toBe(true);
    expect(RIG_PART_SPECS.tree.preKeyed).toBeFalsy();
  });

  it('skips removeBackground for a preKeyed rig, preserving a border-connected opaque near-white pixel', () => {
    // 3x3 image with a near-white opaque pixel touching the border (0,0) and
    // an opaque interior pixel (1,1); removeBackground would flood-fill (0,0)
    // to transparent since it's near-white and border-connected.
    const width = 3;
    const height = 3;
    const data = new Uint8Array(width * height * 4);
    const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    };
    set(0, 0, 250, 250, 250, 255); // border, near-white
    set(1, 1, 10, 10, 10, 255); // interior, opaque

    const img = { width, height, data };

    const kept = keyIfNeeded(img, true);
    expect(kept.data[3]).toBe(255); // (0,0) alpha untouched when preKeyed

    const keyedFresh = keyIfNeeded({ width, height, data: Uint8Array.from(data) }, false);
    expect(keyedFresh.data[3]).toBe(0); // (0,0) eaten when not preKeyed
  });
});
