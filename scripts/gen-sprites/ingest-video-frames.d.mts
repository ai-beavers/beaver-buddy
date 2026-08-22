// Hand-written type declarations for ingest-video-frames.mjs (plain JS, no
// TS syntax allowed — see that file's header) so its test gets real types
// instead of implicit any.

import type { DecodedImage, SheetMeta } from './ingest-images.mjs';

export const CANVAS: number;
export const SPRITE_SCALE: number;
export const OFFSET: number;

export function sampleArtGrid(cell: DecodedImage): DecodedImage;
export function paletteOf(img: DecodedImage): [number, number, number][];
export function snapToPalette(tile: DecodedImage, colors: readonly (readonly [number, number, number])[]): DecodedImage;
export function outlineColorOf(sheet: DecodedImage, x0: number, y0: number, w: number, h: number): [number, number, number];
export function normalizeOutline(tile: DecodedImage, color: readonly [number, number, number]): DecodedImage;
export function groundTile(tile: DecodedImage): DecodedImage;
export function dropGreenFringe(tile: DecodedImage): DecodedImage;
export function buildVideoRowSheet(
  repoRoot: string,
  opts: { rowName: string; sourceDir: string },
): { png: Buffer; meta: SheetMeta };
