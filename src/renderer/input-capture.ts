import { BEAVER_TILE_PX, PET_SCALE } from './pet-config.js';
import type { RoamInput, RoamState } from './roam.js';
import type { Stage } from './sprites.js';

export type CaptureMode = 'hover-forward' | 'full-capture';

export interface InputQueue {
  cursorX: number;
  cursorY: number;
  clicks: number;
  doubleClick: boolean;
}

export function createInputQueue(): InputQueue {
  // Sentinel coordinates mean "cursor is not known to be over the pet".
  return { cursorX: -1, cursorY: -1, clicks: 0, doubleClick: false };
}

export function updateCursor(queue: InputQueue, x: number, y: number): void {
  queue.cursorX = x;
  queue.cursorY = y;
}

export function recordClickOnPet(queue: InputQueue, x: number, y: number, petX: number, petY: number): void {
  updateCursor(queue, x, y);
  if (isPointOverPet(x, y, petX, petY)) {
    queue.clicks += 1;
  }
}

export function recordDoubleClick(queue: InputQueue): void {
  queue.doubleClick = true;
}

export function consumeInput(queue: InputQueue): RoamInput {
  const input: RoamInput = {
    cursorX: queue.cursorX,
    cursorY: queue.cursorY,
    clicks: queue.clicks,
    doubleClick: queue.doubleClick,
  };
  queue.clicks = 0;
  queue.doubleClick = false;
  return input;
}

export function isPointOverPet(x: number, y: number, petX: number, petY: number): boolean {
  const size = BEAVER_TILE_PX * PET_SCALE;
  return x >= petX && x < petX + size && y >= petY && y < petY + size;
}

// BL-17/BL-18: the parachute interaction needs struggle/parachute-wind/land
// rows, which only baby and adult sheets ship — teen's sheet lacks them
// (sprites.ts frameRect throws on a missing row).
export function stageHasInteraction(stage: Stage): boolean {
  return stage === 'baby' || stage === 'adult';
}

export function determineCaptureMode(
  roamState: RoamState,
  cursorX: number,
  cursorY: number,
  petX: number,
  petY: number,
  interactionEnabled: boolean = true,
): CaptureMode {
  // interactionEnabled gates by stage (see stageHasInteraction) — when
  // disabled, the overlay must stay click-through even while the cursor is
  // over the pet.
  if (!interactionEnabled) return 'hover-forward';
  if (roamState.phase === 'grabbed') return 'full-capture';
  // Spec (docs/interaction-model.md): during gliding/landing the overlay is
  // click-through — hovering the descending beaver must not swallow desktop
  // clicks, so only roaming phases earn hover full-capture.
  if (roamState.phase === 'gliding' || roamState.phase === 'landing') return 'hover-forward';
  if (isPointOverPet(cursorX, cursorY, petX, petY)) return 'full-capture';
  return 'hover-forward';
}
