// Hand-written type declarations for ingest-animation-frames.mjs (plain
// JS, no TS syntax allowed — see that file's header) so its test gets real
// types instead of implicit any.

import type { SheetMeta } from './ingest-images.mjs';

export interface StageSheetResult {
  readonly png: Buffer;
  readonly meta: SheetMeta;
  readonly scales: Readonly<Record<string, number>>;
}

export interface StageAnimSpec {
  readonly name: string;
  readonly run: string;
  readonly targetContentHeightPx: number;
  readonly tileHeight?: number;
}

export interface StageAnimConfig {
  readonly shippedPng: string;
  readonly bakedDirName: string;
  readonly animations: readonly StageAnimSpec[];
}

export const BABY: StageAnimConfig;
export const ADULT: StageAnimConfig;

export function buildStageSheet(repoRoot: string, config: StageAnimConfig): StageSheetResult;
export function buildBabySheet(repoRoot: string): StageSheetResult;
