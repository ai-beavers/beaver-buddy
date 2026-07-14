// Hand-written type declarations for ingest-images.mjs (plain JS, no TS
// syntax allowed — see that file's header) so ingest-images.test.ts gets
// real types instead of `any`.

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface StageRowSpec {
  readonly name: string;
  readonly files: readonly string[];
}

export interface StageSpec {
  readonly name: string;
  readonly tile: number;
  readonly fps: number;
  readonly targetContentHeightPx: number;
  readonly rows: readonly StageRowSpec[];
}

export interface SheetMeta {
  readonly tile: number;
  readonly fps: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly rows: readonly { readonly name: string; readonly frames: number }[];
}

export interface IngestResult {
  readonly png: Buffer;
  readonly meta: SheetMeta;
  readonly scale: number;
}

export const TILE: number;
export const FPS: number;
export const STAGE_SPECS: readonly StageSpec[];

export function decodePng(buf: Buffer): DecodedImage;
export function removeBackground(img: DecodedImage): DecodedImage;
export function cropToBbox(img: DecodedImage): DecodedImage;
export function resizeAreaAverage(img: DecodedImage, destW: number, destH: number): DecodedImage;
export function placeOnTile(img: DecodedImage, tile: number): DecodedImage;
export function computeStageScale(
  bboxes: readonly { width: number; height: number }[],
  tile: number,
  targetContentHeightPx: number,
): number;
export function ingestStage(stageSpec: StageSpec, srcDir: string): IngestResult;
