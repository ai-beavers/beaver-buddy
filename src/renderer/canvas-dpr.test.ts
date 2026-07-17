import { describe, expect, it, vi } from 'vitest';
import { applyDpr, computeCanvasSize } from './canvas-dpr.js';

describe('canvas-dpr', () => {
  it('computes physical canvas size and CSS size from logical bounds and DPR', () => {
    expect(computeCanvasSize(1920, 1080, 1.5)).toEqual({
      canvasWidth: 2880,
      canvasHeight: 1620,
      styleWidth: '1920px',
      styleHeight: '1080px',
    });
  });

  it('rounds physical dimensions to whole pixels', () => {
    const result = computeCanvasSize(1921, 1081, 1.25);
    expect(result.canvasWidth).toBe(Math.round(1921 * 1.25));
    expect(result.canvasHeight).toBe(Math.round(1081 * 1.25));
  });

  it('applies DPR transform and keeps image smoothing disabled', () => {
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
    } as unknown as HTMLCanvasElement;
    const setTransform = vi.fn();
    const ctx = {
      setTransform,
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D;

    applyDpr(canvas, ctx, 800, 600, 2);

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});
