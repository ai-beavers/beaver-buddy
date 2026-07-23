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

export interface AdultRowConfig {
  readonly rowName: string;
  readonly sourceDir: string;
  readonly frames: number;
  readonly gridCols: number;
  readonly gridRows: number;
  readonly targetContentHeightPx: number;
  readonly rowHeight?: number;
  /** Optional reorder/subset of grid cells into the baked row (indices into
   *  grid-order cells). Used when a raw generation's cell sequence isn't a
   *  clean loop but a body-consistent subset is. */
  readonly frameOrder?: readonly number[];
}

export interface AdultRowResult {
  readonly png: Buffer;
  readonly meta: SheetMeta;
  readonly scale: number;
}

export const ADULT_WATERING: AdultRowConfig;
export const ADULT_DRINK: AdultRowConfig;
export const ADULT_SLEEP: AdultRowConfig;
export const ADULT_STRETCH: AdultRowConfig;
export const ADULT_IDLE: AdultRowConfig;
export const ADULT_WALK: AdultRowConfig;
export const ADULT_THROW_STICK: AdultRowConfig;
export const ADULT_COLLECT_STICKS: AdultRowConfig;
export const ADULT_EXERCISE: AdultRowConfig;
export const ADULT_BRAINROT: AdultRowConfig;
export const ADULT_WAVE: AdultRowConfig;
export const ADULT_FLUSH: AdultRowConfig;

export function buildAdultRowSheet(repoRoot: string, config: AdultRowConfig): AdultRowResult;
export function buildAdultWateringSheet(repoRoot: string): AdultRowResult;
export function buildAdultDrinkSheet(repoRoot: string): AdultRowResult;
export function buildAdultSleepSheet(repoRoot: string): AdultRowResult;
export function buildAdultStretchSheet(repoRoot: string): AdultRowResult;
export function buildAdultIdleSheet(repoRoot: string): AdultRowResult;
export function buildAdultWalkSheet(repoRoot: string): AdultRowResult;
export function buildAdultThrowStickSheet(repoRoot: string): AdultRowResult;
export function buildAdultCollectSticksSheet(repoRoot: string): AdultRowResult;
export function buildAdultExerciseSheet(repoRoot: string): AdultRowResult;
export function buildAdultBrainrotSheet(repoRoot: string): AdultRowResult;
export function buildAdultWaveSheet(repoRoot: string): AdultRowResult;
export function buildAdultFlushSheet(repoRoot: string): AdultRowResult;

// speak (BL-7) is mechanically composited from the committed idle tile, not
// a ComfyUI grid — its config shape is just the row name and the mouth
// patch's pixel bounding box, not an AdultRowConfig.
export interface AdultSpeakConfig {
  readonly rowName: string;
  readonly mouthBox: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
}
export const ADULT_SPEAK: AdultSpeakConfig;
export function buildAdultSpeakSheet(repoRoot: string): AdultRowResult;
