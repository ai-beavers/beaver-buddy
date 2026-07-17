// Canvas DPR helpers. Kept separate from renderer.ts so the pure math is
// unit-testable without spinning up the full DOM/canvas context.

export interface DprConfig {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly styleWidth: string;
  readonly styleHeight: string;
}

/**
 * Compute the physical canvas size and CSS size from logical bounds and the
 * current device pixel ratio. Rounding avoids sub-pixel canvas dimensions.
 */
export function computeCanvasSize(logicalWidth: number, logicalHeight: number, dpr: number): DprConfig {
  return {
    canvasWidth: Math.round(logicalWidth * dpr),
    canvasHeight: Math.round(logicalHeight * dpr),
    styleWidth: `${logicalWidth}px`,
    styleHeight: `${logicalHeight}px`,
  };
}

/**
 * Configure a canvas for HiDPI rendering: physical pixels = logical * dpr,
 * CSS size stays logical, context transform scales by dpr. Uses setTransform
 * so repeated calls (e.g. DPR change) do not accumulate.
 */
export function applyDpr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number,
  dpr: number,
): void {
  const { canvasWidth, canvasHeight, styleWidth, styleHeight } = computeCanvasSize(logicalWidth, logicalHeight, dpr);
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = styleWidth;
  canvas.style.height = styleHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
