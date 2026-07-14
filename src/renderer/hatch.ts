// Pure tick sequencer for the one-time hatch onboarding animation
// (evolution.ts pattern): phases lodge-idle -> shake -> burst -> baby-appear
// -> done. renderer.ts drives it with the same per-frame dt as roam.tick/
// evolution.tickEvolution and owns the actual drawing (shake offset applied
// to draw position, sparks drawn from the lodge sheet's spark row at the
// offsets this module computes).

import {
  HATCH_BABY_APPEAR_DURATION_S,
  HATCH_BURST_DURATION_S,
  HATCH_LODGE_IDLE_DURATION_S,
  HATCH_SHAKE_BURST_ACTIVE_S,
  HATCH_SHAKE_BURST_COUNT,
  HATCH_SHAKE_JITTER_MAX_PX,
  HATCH_SHAKE_JITTER_MIN_PX,
  HATCH_SHAKE_PAUSE_END_S,
  HATCH_SHAKE_PAUSE_START_S,
  HATCH_SPARK_COUNT_MAX,
  HATCH_SPARK_COUNT_MIN,
  HATCH_SPARK_SPEED_PX_S,
} from './pet-config.js';

export type HatchPhase = 'lodge-idle' | 'shake' | 'burst' | 'baby-appear' | 'done';

export interface Spark {
  readonly angleRad: number;
}

export interface HatchState {
  readonly phase: HatchPhase;
  readonly elapsedS: number; // elapsed within the current phase (or sub-phase, for shake)
  readonly burstsDone: number; // completed shake bursts
  readonly inPause: boolean; // shake phase only: true while between bursts
  readonly sparks: readonly Spark[];
}

export function startHatch(): HatchState {
  return { phase: 'lodge-idle', elapsedS: 0, burstsDone: 0, inPause: false, sparks: [] };
}

// Escalating amplitude: ramps HATCH_SHAKE_JITTER_MIN_PX ->
// HATCH_SHAKE_JITTER_MAX_PX across the burst count, monotone non-decreasing
// as burstsDone increases — exported for its own test coverage.
export function shakeJitterPx(burstsDone: number): number {
  const t = HATCH_SHAKE_BURST_COUNT <= 1 ? 1 : burstsDone / (HATCH_SHAKE_BURST_COUNT - 1);
  return HATCH_SHAKE_JITTER_MIN_PX + (HATCH_SHAKE_JITTER_MAX_PX - HATCH_SHAKE_JITTER_MIN_PX) * t;
}

// Pause between bursts shrinks from HATCH_SHAKE_PAUSE_START_S down to
// HATCH_SHAKE_PAUSE_END_S — the Pokemon hatch rhythm.
function pauseDurationS(burstsDone: number): number {
  const t = HATCH_SHAKE_BURST_COUNT <= 1 ? 1 : burstsDone / (HATCH_SHAKE_BURST_COUNT - 1);
  return HATCH_SHAKE_PAUSE_START_S + (HATCH_SHAKE_PAUSE_END_S - HATCH_SHAKE_PAUSE_START_S) * t;
}

function makeSparks(rng: () => number): Spark[] {
  const count = HATCH_SPARK_COUNT_MIN + Math.floor(rng() * (HATCH_SPARK_COUNT_MAX - HATCH_SPARK_COUNT_MIN + 1));
  const sparks: Spark[] = [];
  for (let i = 0; i < count; i++) {
    // Evenly spaced angles plus a per-run random offset, so the burst still
    // reads as a full radiating ring rather than N fixed directions.
    const angleRad = ((2 * Math.PI) / count) * i + rng() * 2 * Math.PI;
    sparks.push({ angleRad });
  }
  return sparks;
}

export function tickHatch(state: HatchState, dtSeconds: number, rng: () => number): HatchState {
  if (state.phase === 'done') {
    return state;
  }

  const elapsedS = state.elapsedS + dtSeconds;

  switch (state.phase) {
    case 'lodge-idle':
      if (elapsedS >= HATCH_LODGE_IDLE_DURATION_S) {
        return { ...state, phase: 'shake', elapsedS: 0 };
      }
      return { ...state, elapsedS };

    case 'shake': {
      if (!state.inPause) {
        if (elapsedS < HATCH_SHAKE_BURST_ACTIVE_S) {
          return { ...state, elapsedS };
        }
        const burstsDone = state.burstsDone + 1;
        if (burstsDone >= HATCH_SHAKE_BURST_COUNT) {
          return { ...state, phase: 'burst', elapsedS: 0, burstsDone, sparks: makeSparks(rng) };
        }
        return { ...state, elapsedS: 0, burstsDone, inPause: true };
      }
      if (elapsedS < pauseDurationS(state.burstsDone)) {
        return { ...state, elapsedS };
      }
      return { ...state, elapsedS: 0, inPause: false };
    }

    case 'burst':
      if (elapsedS >= HATCH_BURST_DURATION_S) {
        return { ...state, phase: 'baby-appear', elapsedS: 0 };
      }
      return { ...state, elapsedS };

    case 'baby-appear':
      if (elapsedS >= HATCH_BABY_APPEAR_DURATION_S) {
        return { ...state, phase: 'done', elapsedS };
      }
      return { ...state, elapsedS };
  }
}

// Deterministic jitter for tests; renderer.ts passes Math.random. Same shape
// as evolution.shakeOffset, with escalating amplitude tied to burstsDone.
export function hatchShakeOffset(state: HatchState, rng: () => number): { readonly dx: number; readonly dy: number } {
  if (state.phase !== 'shake' || state.inPause) {
    return { dx: 0, dy: 0 };
  }
  const amp = shakeJitterPx(state.burstsDone);
  return { dx: (rng() * 2 - 1) * amp, dy: (rng() * 2 - 1) * amp };
}

export interface SparkOffset {
  readonly dx: number;
  readonly dy: number;
}

// Sparks radiate outward from the lodge center at a fixed speed along their
// deterministic angle — constant-velocity radial motion is the whole model,
// no physics/particle system.
export function sparkOffsets(state: HatchState): readonly SparkOffset[] {
  if (state.phase !== 'burst') {
    return [];
  }
  const t = state.elapsedS;
  return state.sparks.map((spark) => ({
    dx: Math.cos(spark.angleRad) * HATCH_SPARK_SPEED_PX_S * t,
    dy: Math.sin(spark.angleRad) * HATCH_SPARK_SPEED_PX_S * t,
  }));
}
