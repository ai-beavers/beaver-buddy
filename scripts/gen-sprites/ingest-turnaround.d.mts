// Hand-written type declarations for ingest-turnaround.mjs (plain JS, no TS
// syntax allowed — see that file's header) so its vitest suite gets real
// types instead of `any`.

import type { DecodedImage, SheetMeta } from './ingest-images.d.mts';

export interface TurnaroundMeta extends SheetMeta {
  readonly views: readonly string[];
  readonly mirrored: readonly number[];
  readonly source: string;
}

export interface FigureSpec {
  readonly name: string;
  readonly source: string;
  readonly targetContentHeightPx: number;
}

export interface TurnaroundResult {
  readonly png: Buffer;
  readonly meta: TurnaroundMeta;
  readonly scale: number;
}

export const AUTHORED_VIEWS: readonly string[];
export const VIEW_ORDER: readonly string[];
export const MIRROR_SOURCES: Readonly<Record<number, number>>;
export const FIGURES: readonly FigureSpec[];

export function mirrorTile(img: DecodedImage): DecodedImage;
export function composeRow(tiles: readonly DecodedImage[]): DecodedImage;
export function dropStrayFragments(img: DecodedImage, minFraction?: number): DecodedImage;
export function buildTurnaround(figure: FigureSpec): TurnaroundResult;
