import { describe, expect, it } from 'vitest';
import {
  DOCK_OPTICAL_SCALE,
  appIconSquircleCoverage,
  applyAppIconSquircleMask,
  centerBitmapOnTransparentCanvas,
} from './app-icon';

describe('appIconSquircleCoverage', () => {
  const size = 100;

  it('is fully opaque at the center', () => {
    expect(appIconSquircleCoverage(50, 50, size)).toBe(1);
  });

  it('is fully transparent at the sharp corner (outside the squircle)', () => {
    expect(appIconSquircleCoverage(0, 0, size)).toBe(0);
    expect(appIconSquircleCoverage(size - 1, 0, size)).toBe(0);
  });

  it('is opaque mid-edge where the flat side lives', () => {
    expect(appIconSquircleCoverage(50, 0, size)).toBe(1);
    expect(appIconSquircleCoverage(0, 50, size)).toBe(1);
  });
});

describe('applyAppIconSquircleMask', () => {
  it('clears the corner pixel and leaves the center opaque', () => {
    const width = 32;
    const height = 32;
    const bitmap = Buffer.alloc(width * height * 4, 255);

    applyAppIconSquircleMask(bitmap, width, height);

    const corner = 0;
    expect(bitmap[corner]).toBe(0);
    expect(bitmap[corner + 3]).toBe(0);

    const center = ((16 * width + 16) * 4);
    expect(bitmap[center + 3]).toBe(255);
  });
});

describe('centerBitmapOnTransparentCanvas', () => {
  it('centers a solid tile and leaves outer pixels transparent', () => {
    const innerW = 2;
    const innerH = 2;
    const inner = Buffer.alloc(innerW * innerH * 4, 255);
    const canvasW = 4;
    const canvasH = 4;
    const out = centerBitmapOnTransparentCanvas(inner, innerW, innerH, canvasW, canvasH);

    expect(out[0 + 3]).toBe(0); // top-left corner transparent
    const mid = ((1 * canvasW + 1) * 4);
    expect(out[mid + 3]).toBe(255);
  });

  it('keeps dock optical scale below 1 so setIcon is inset vs system icons', () => {
    expect(DOCK_OPTICAL_SCALE).toBeLessThan(1);
    expect(DOCK_OPTICAL_SCALE).toBeGreaterThan(0.5);
  });
});
