// App icon helpers for macOS Dock.
//
// Apple HIG / Icon Composer (2025–2026): master artwork is a full-bleed square
// with NO baked rounded-rect mask — the system applies the continuous-corner
// shape when the icon lives in a real .app bundle.
//
// Unpackaged `electron .` uses app.dock.setIcon(), which bypasses that mask
// and draws the bitmap as a sharp square. For that path only, we apply an
// Apple-like squircle alpha mask ourselves so the Dock matches neighbors.

import { app, nativeImage, type NativeImage } from 'electron';

// macOS app-icon continuous-corner ratio (WWDC25 grid is rounder than ~0.2237).
const APP_ICON_CORNER_RATIO = 0.268;

// dock.setIcon() paints the bitmap full-bleed in the Dock slot; real .app
// icons are drawn a notch smaller. Scale the masked tile so it optically
// matches Photos / Preview neighbors under unpackaged Electron.
export const DOCK_OPTICAL_SCALE = 0.8;

/** Soft coverage (0..1) for a continuous rounded-rect / squircle at pixel (x,y). */
export function appIconSquircleCoverage(x: number, y: number, size: number): number {
  const r = size * APP_ICON_CORNER_RATIO;
  // Pixel center in a coordinate system with origin at the icon center.
  const cx = x + 0.5 - size / 2;
  const cy = y + 0.5 - size / 2;
  const half = size / 2;
  // Signed distance to a rounded rectangle of half-extents (half, half).
  const qx = Math.abs(cx) - (half - r);
  const qy = Math.abs(cy) - (half - r);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const dist = Math.hypot(outsideX, outsideY) + Math.min(Math.max(qx, qy), 0) - r;
  // 1px antialias band so the Dock edge isn't stair-stepped.
  if (dist <= -0.5) return 1;
  if (dist >= 0.5) return 0;
  return 0.5 - dist;
}

/** Premultiplied BGRA bitmap in place — transparent outside the squircle. */
export function applyAppIconSquircleMask(bitmap: Buffer, width: number, height: number): void {
  const size = Math.min(width, height);
  const xOffset = Math.floor((width - size) / 2);
  const yOffset = Math.floor((height - size) / 2);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const localX = x - xOffset;
      const localY = y - yOffset;
      const coverage =
        localX < 0 || localY < 0 || localX >= size || localY >= size
          ? 0
          : appIconSquircleCoverage(localX, localY, size);

      if (coverage >= 1) continue;
      if (coverage <= 0) {
        bitmap[i] = 0;
        bitmap[i + 1] = 0;
        bitmap[i + 2] = 0;
        bitmap[i + 3] = 0;
        continue;
      }
      // Premultiplied BGRA — scale all channels by coverage.
      bitmap[i] = Math.round(bitmap[i] * coverage);
      bitmap[i + 1] = Math.round(bitmap[i + 1] * coverage);
      bitmap[i + 2] = Math.round(bitmap[i + 2] * coverage);
      bitmap[i + 3] = Math.round(bitmap[i + 3] * coverage);
    }
  }
}

export function maskWithMacAppIconSquircle(image: NativeImage): NativeImage {
  const { width, height } = image.getSize();
  if (width === 0 || height === 0) return image;
  const bitmap = Buffer.from(image.toBitmap());
  applyAppIconSquircleMask(bitmap, width, height);
  return nativeImage.createFromBitmap(bitmap, { width, height });
}

/** Center `inner` on a transparent canvas of `canvasW`×`canvasH` (premultiplied BGRA). */
export function centerBitmapOnTransparentCanvas(
  inner: Buffer,
  innerW: number,
  innerH: number,
  canvasW: number,
  canvasH: number,
): Buffer {
  const out = Buffer.alloc(canvasW * canvasH * 4, 0);
  const ox = Math.floor((canvasW - innerW) / 2);
  const oy = Math.floor((canvasH - innerH) / 2);
  for (let y = 0; y < innerH; y += 1) {
    for (let x = 0; x < innerW; x += 1) {
      const si = (y * innerW + x) * 4;
      const di = ((y + oy) * canvasW + (x + ox)) * 4;
      out[di] = inner[si];
      out[di + 1] = inner[si + 1];
      out[di + 2] = inner[si + 2];
      out[di + 3] = inner[si + 3];
    }
  }
  return out;
}

/** Shrink a full-bleed Dock bitmap so it matches system app-icon optical size. */
export function fitDockIconOpticalSize(image: NativeImage, scale: number = DOCK_OPTICAL_SCALE): NativeImage {
  const { width, height } = image.getSize();
  if (width === 0 || height === 0 || scale >= 1) return image;
  const innerW = Math.max(1, Math.round(width * scale));
  const innerH = Math.max(1, Math.round(height * scale));
  const resized = image.resize({ width: innerW, height: innerH, quality: 'best' });
  const centered = centerBitmapOnTransparentCanvas(
    Buffer.from(resized.toBitmap()),
    innerW,
    innerH,
    width,
    height,
  );
  return nativeImage.createFromBitmap(centered, { width, height });
}

export function prepareUnpackagedDockIcon(image: NativeImage): NativeImage {
  return fitDockIconOpticalSize(maskWithMacAppIconSquircle(image));
}

/** Dock icon for unpackaged launches only — packaged .app keeps the system mask. */
export function setUnpackagedDockIcon(iconPath: string): void {
  if (process.platform !== 'darwin' || app.isPackaged) return;
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return;
  app.dock?.setIcon(prepareUnpackagedDockIcon(image));
}
