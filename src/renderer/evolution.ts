// Pure-ish evolution sequencer: phase timing only, no DOM/canvas access —
// renderer.ts drives it with the same per-frame dt as roam.tick and owns
// the actual drawing (shake offset applied to draw position, flash drawn
// via a composite-operation fill). Sequence: shake -> flash -> done, at
// which point renderer.ts calls setStage(targetStage) then celebrate().

import {
  EVOLUTION_FLASH_BLINK_COUNT,
  EVOLUTION_FLASH_BLINK_DURATION_S,
  EVOLUTION_SHAKE_DURATION_S,
  EVOLUTION_SHAKE_JITTER_PX,
} from './pet-config.js';
import type { Stage } from './sprites.js';

export type EvolutionPhase = 'shake' | 'flash' | 'done';

export interface EvolutionState {
  readonly phase: EvolutionPhase;
  readonly targetStage: Stage;
  readonly elapsedS: number;
  readonly flashBlinksDone: number;
}

export interface PetChangedPayload {
  readonly level: number;
  readonly stage: Stage;
  readonly evolvingTo?: Stage;
}

export function startEvolution(targetStage: Stage): EvolutionState {
  return { phase: 'shake', targetStage, elapsedS: 0, flashBlinksDone: 0 };
}

export function tickEvolution(state: EvolutionState, dtSeconds: number): EvolutionState {
  if (state.phase === 'done') {
    return state;
  }

  const elapsedS = state.elapsedS + dtSeconds;

  if (state.phase === 'shake') {
    if (elapsedS >= EVOLUTION_SHAKE_DURATION_S) {
      return { ...state, phase: 'flash', elapsedS: 0, flashBlinksDone: 0 };
    }
    return { ...state, elapsedS };
  }

  // flash
  const blinksDone = Math.floor(elapsedS / EVOLUTION_FLASH_BLINK_DURATION_S);
  if (blinksDone >= EVOLUTION_FLASH_BLINK_COUNT) {
    return { ...state, phase: 'done', elapsedS };
  }
  return { ...state, elapsedS, flashBlinksDone: blinksDone };
}

// Deterministic jitter for tests; renderer.ts passes Math.random.
export function shakeOffset(state: EvolutionState, rng: () => number): { readonly dx: number; readonly dy: number } {
  if (state.phase !== 'shake') {
    return { dx: 0, dy: 0 };
  }
  return {
    dx: (rng() * 2 - 1) * EVOLUTION_SHAKE_JITTER_PX,
    dy: (rng() * 2 - 1) * EVOLUTION_SHAKE_JITTER_PX,
  };
}

// True for the first half of each blink cycle (on), false for the second
// (off) — three on/off cycles read as three distinct white blinks.
export function isFlashVisible(state: EvolutionState): boolean {
  if (state.phase !== 'flash') {
    return false;
  }
  const cycleElapsed = state.elapsedS - state.flashBlinksDone * EVOLUTION_FLASH_BLINK_DURATION_S;
  return cycleElapsed < EVOLUTION_FLASH_BLINK_DURATION_S / 2;
}
