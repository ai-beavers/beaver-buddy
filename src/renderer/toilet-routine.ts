// Pure tick sequencer for the adult toilet+newspaper+recovery gag
// (hatch.ts / evolution.ts pattern). Steps:
//   toilet-read → flush → wave-away → wave-back → shake-dry → done
//
// Each ONE-SHOT art row plays for TOILET_ROUTINE_STEP_DURATION_S (8 frames at
// SPRITE_FPS). wave-away / wave-back share the `wave` sheet row; wave-back
// plays reverse so the beaver visually returns. LOOP-vs-ONE-SHOT is encoded
// here, not in sheet JSON. See docs/toilet-newspaper-routine.md.

import { TOILET_ROUTINE_STEP_DURATION_S } from './pet-config.js';

export type ToiletRoutineStep =
  | 'toilet-read'
  | 'flush'
  | 'wave-away'
  | 'wave-back'
  | 'shake-dry'
  | 'done';

export interface ToiletRoutineState {
  readonly step: ToiletRoutineStep;
  readonly elapsedS: number;
}

export type ToiletRoutineAnim = 'toilet-read' | 'flush' | 'wave' | 'shake-dry';

const STEP_ORDER: readonly ToiletRoutineStep[] = [
  'toilet-read',
  'flush',
  'wave-away',
  'wave-back',
  'shake-dry',
  'done',
];

export function startToiletRoutine(): ToiletRoutineState {
  return { step: 'toilet-read', elapsedS: 0 };
}

function nextStep(step: ToiletRoutineStep): ToiletRoutineStep {
  const i = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)];
}

export function tickToiletRoutine(state: ToiletRoutineState, dtSeconds: number): ToiletRoutineState {
  if (state.step === 'done') {
    return state;
  }
  const elapsedS = state.elapsedS + dtSeconds;
  // Epsilon: rAF dt slices of 0.1 accumulate as 0.999… after 10 adds, so a
  // strict `>= 1.0` would stall an extra tick per step.
  if (elapsedS + 1e-6 >= TOILET_ROUTINE_STEP_DURATION_S) {
    return { step: nextStep(state.step), elapsedS: 0 };
  }
  return { ...state, elapsedS };
}

export function toiletRoutineAnim(state: ToiletRoutineState): {
  readonly anim: ToiletRoutineAnim;
  readonly reverse: boolean;
} | null {
  switch (state.step) {
    case 'toilet-read':
      return { anim: 'toilet-read', reverse: false };
    case 'flush':
      return { anim: 'flush', reverse: false };
    case 'wave-away':
      return { anim: 'wave', reverse: false };
    case 'wave-back':
      return { anim: 'wave', reverse: true };
    case 'shake-dry':
      return { anim: 'shake-dry', reverse: false };
    case 'done':
      return null;
  }
}

/** Local frame index within the current step (0..frames-1), derived from elapsed. */
export function toiletRoutineFrameIndex(state: ToiletRoutineState, fps: number, frames: number): number {
  if (frames <= 0) return 0;
  const raw = Math.floor(state.elapsedS * fps);
  return Math.min(Math.max(raw, 0), frames - 1);
}
