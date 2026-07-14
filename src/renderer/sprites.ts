// Sheet loader + frame drawing. Sheets are fetched relative to index.html
// (dist/renderer/assets/sprites/, copied there by `npm run build` — see
// package.json). No sprite library (ADR 001 §Animation/roaming): plain
// canvas drawImage with a manual frame-rect lookup.

export type Stage = 'baby' | 'teen' | 'adult';

export interface SheetRow {
  readonly name: string;
  readonly frames: number;
}

export interface SheetMeta {
  readonly tile: number;
  readonly fps: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly rows: readonly SheetRow[];
}

export interface Sheet {
  readonly image: HTMLImageElement;
  readonly meta: SheetMeta;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load sprite image: ${src}`));
    img.src = src;
  });
}

async function loadMeta(src: string): Promise<SheetMeta> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`failed to load sprite meta: ${src}`);
  }
  return (await response.json()) as SheetMeta;
}

export async function loadSheet(stage: Stage): Promise<Sheet> {
  // Adult sprite art doesn't exist yet — BL-11 ingested the user's baby/teen
  // images only (see assets/STYLE.md provenance). Falls back to the teen
  // sheet until a real adult sheet ships; swap this mapping out then.
  const spriteStage: 'baby' | 'teen' = stage === 'adult' ? 'teen' : stage;
  const base = `assets/sprites/beaver-${spriteStage}`;
  const [image, meta] = await Promise.all([loadImage(`${base}.png`), loadMeta(`${base}.json`)]);
  return { image, meta };
}

// The hatch lodge sheet (assets/sprites/lodge.png/.json): 48px tiles, rows
// idle/shake/burst/spark — same loader shape as loadSheet, not stage-keyed
// since there's exactly one lodge sheet.
export async function loadLodgeSheet(): Promise<Sheet> {
  const base = 'assets/sprites/lodge';
  const [image, meta] = await Promise.all([loadImage(`${base}.png`), loadMeta(`${base}.json`)]);
  return { image, meta };
}

export interface FrameRect {
  readonly sx: number;
  readonly sy: number;
  readonly size: number;
}

// Pure geometry: row lookup by animation name + column wrap by frame index.
// Non-trivial enough (per the plan) to carry its own vitest coverage.
export function frameRect(meta: SheetMeta, anim: string, frameIndex: number): FrameRect {
  const rowIndex = meta.rows.findIndex((row) => row.name === anim);
  if (rowIndex === -1) {
    throw new Error(`unknown animation row: ${anim}`);
  }
  const row = meta.rows[rowIndex];
  const frame = ((frameIndex % row.frames) + row.frames) % row.frames;
  return { sx: frame * meta.tile, sy: rowIndex * meta.tile, size: meta.tile };
}

export interface DrawOptions {
  readonly mirror: boolean;
  readonly rotationDeg: number;
  // Integer nearest-neighbor blit scale for this draw call. A parameter
  // rather than a hardcoded PET_SCALE import: the lodge sheet kept its
  // original 48px native tile while the beaver sheets moved to 96px
  // (BL-11), so different sheets need different scale factors to land at
  // the same on-screen size — callers pass pet-config's PET_SCALE or
  // LODGE_SCALE accordingly (see renderer.ts).
  readonly scale: number;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  anim: string,
  frameIndex: number,
  x: number,
  y: number,
  opts: DrawOptions,
): void {
  const { sx, sy, size } = frameRect(sheet.meta, anim, frameIndex);
  // Destination is blown up by opts.scale; source sampling stays at the
  // native tile size — that's what keeps nearest-neighbor scaling crisp.
  const destSize = size * opts.scale;
  const cx = x + destSize / 2;
  const cy = y + destSize / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.rotationDeg !== 0) {
    ctx.rotate((opts.rotationDeg * Math.PI) / 180);
  } else if (opts.mirror) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sheet.image, sx, sy, size, size, -destSize / 2, -destSize / 2, destSize, destSize);
  ctx.restore();
}
