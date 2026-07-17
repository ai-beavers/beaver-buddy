// Pure state machine: no DOM/canvas access, so it's fully unit-testable.
// Inputs are bounds + dt + an injected rng; output is the state itself
// (x, y, anim, facing, rotation, frameHold are read directly by callers —
// no separate mapping step for a one-field-per-consumer module like this).
//
// States: idle, walk (bottom-edge behaviors) and climbUp -> climbPause ->
// climbDown (side-edge behavior, entered only when idle ends while standing
// within EDGE_THRESHOLD_PX of a side edge). BL-11 removed run and sleep
// (slimmed animation set — the ingested sheets only ship idle/walk rows) and
// react (it was never a roam state — it was a one-shot overlay the renderer
// applied on top of whatever roam.ts reports; BL-11 dropped it too, see
// renderer.ts's celebrate()).
//
// Transition table:
//   idle        --timer expires, not at edge-->            walk
//   idle        --timer expires, at edge, climb roll-->     climbUp
//   walk        --reaches target-->                          idle
//   climbUp     --reaches climb height-->                     climbPause
//   climbPause  --timer expires-->                            climbDown
//   climbDown   --reaches ground-->                            idle
//   (any, non-paused)  --paused=true on tick-->  frozen (frameHold=true, no
//     other field changes)

import {
  BEAVER_TILE_PX,
  CLIMB_HEIGHT_MAX_PX,
  CLIMB_HEIGHT_MIN_PX,
  CLIMB_PAUSE_MAX_S,
  CLIMB_PAUSE_MIN_S,
  CLIMB_PROBABILITY,
  CLIMB_SPEED_PX_S,
  EDGE_TARGET_PROBABILITY,
  EDGE_THRESHOLD_PX,
  IDLE_PAUSE_MAX_S,
  IDLE_PAUSE_MIN_S,
  MAX_DT_S,
  PET_SCALE,
  ROTATION_LEFT_CLIMB_DEG,
  ROTATION_RIGHT_CLIMB_DEG,
  TARGET_EPSILON_PX,
  WALK_SPEED_PX_S,
} from './pet-config.js';

export interface Bounds {
  readonly width: number;
  readonly height: number;
}

export type AnimName = 'idle' | 'walk';
export type Facing = 'left' | 'right';
type Phase = 'idle' | 'walk' | 'climbUp' | 'climbPause' | 'climbDown';

export type Rng = () => number; // uniform [0, 1)

export interface RoamState {
  readonly phase: Phase;
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly climbTargetY: number;
  readonly timer: number;
  readonly facing: Facing;
  readonly rotation: number;
  readonly anim: AnimName;
  readonly frameHold: boolean;
}

// mulberry32 — tiny deterministic PRNG for seeded tests / reproducible runs.
// Not cryptographic; not needed to be.
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * t;
}

// Clamps use the on-screen footprint (tile * PET_SCALE), not the raw art
// tile, so the pet's drawn edges stay inside bounds/on the ground line at
// the render scale — not just its unscaled logical tile.
function maxX(bounds: Bounds): number {
  return Math.max(0, bounds.width - BEAVER_TILE_PX * PET_SCALE);
}

function groundY(bounds: Bounds): number {
  return Math.max(0, bounds.height - BEAVER_TILE_PX * PET_SCALE);
}

function pickIdlePause(rng: Rng): number {
  return lerp(IDLE_PAUSE_MIN_S, IDLE_PAUSE_MAX_S, rng());
}

function pickClimbHeight(rng: Rng): number {
  return lerp(CLIMB_HEIGHT_MIN_PX, CLIMB_HEIGHT_MAX_PX, rng());
}

function pickClimbPause(rng: Rng): number {
  return lerp(CLIMB_PAUSE_MIN_S, CLIMB_PAUSE_MAX_S, rng());
}

function pickWalkTargetX(bounds: Bounds, rng: Rng): number {
  const max = maxX(bounds);
  if (rng() < EDGE_TARGET_PROBABILITY) {
    return rng() < 0.5 ? 0 : max;
  }
  return rng() * max;
}

function isAtEdge(x: number, bounds: Bounds): boolean {
  return x <= EDGE_THRESHOLD_PX || x >= maxX(bounds) - EDGE_THRESHOLD_PX;
}

// Called when the idle pause timer expires: decides the next behavior.
function decideNext(state: RoamState, bounds: Bounds, rng: Rng): RoamState {
  const roll = rng();

  if (isAtEdge(state.x, bounds) && roll < CLIMB_PROBABILITY) {
    const onLeftEdge = state.x <= EDGE_THRESHOLD_PX;
    return {
      ...state,
      phase: 'climbUp',
      anim: 'walk',
      facing: onLeftEdge ? 'left' : 'right',
      rotation: onLeftEdge ? ROTATION_LEFT_CLIMB_DEG : ROTATION_RIGHT_CLIMB_DEG,
      climbTargetY: Math.max(0, state.y - pickClimbHeight(rng)),
      frameHold: false,
    };
  }

  const targetX = pickWalkTargetX(bounds, rng);
  return {
    ...state,
    phase: 'walk',
    anim: 'walk',
    facing: targetX >= state.x ? 'right' : 'left',
    rotation: 0,
    targetX,
    frameHold: false,
  };
}

export function clampRoamStateToBounds(state: RoamState, bounds: Bounds): RoamState {
  const max = maxX(bounds);
  const ground = groundY(bounds);
  return {
    ...state,
    x: clamp(state.x, 0, max),
    y: Math.min(state.y, ground),
    targetX: clamp(state.targetX, 0, max),
    climbTargetY: Math.min(state.climbTargetY, ground),
  };
}

export function createRoamState(bounds: Bounds, rng: Rng): RoamState {
  const ground = groundY(bounds);
  const x = clamp(rng() * maxX(bounds), 0, maxX(bounds));
  return {
    phase: 'idle',
    x,
    y: ground,
    targetX: x,
    climbTargetY: ground,
    timer: pickIdlePause(rng),
    facing: 'right',
    rotation: 0,
    anim: 'idle',
    frameHold: false,
  };
}

export function tick(state: RoamState, dtSeconds: number, bounds: Bounds, paused: boolean, rng: Rng): RoamState {
  if (paused) {
    return { ...state, frameHold: true };
  }

  const dt = clamp(dtSeconds, 0, MAX_DT_S);
  const ground = groundY(bounds);

  switch (state.phase) {
    case 'idle': {
      const timer = state.timer - dt;
      if (timer > 0) {
        return { ...state, timer, frameHold: false };
      }
      return decideNext({ ...state, y: ground }, bounds, rng);
    }

    case 'walk': {
      const remaining = state.targetX - state.x;
      const step = Math.min(Math.abs(remaining), WALK_SPEED_PX_S * dt);
      const x = clamp(state.x + Math.sign(remaining) * step, 0, maxX(bounds));
      if (Math.abs(state.targetX - x) <= TARGET_EPSILON_PX) {
        return { ...state, x, y: ground, phase: 'idle', anim: 'idle', timer: pickIdlePause(rng), frameHold: false };
      }
      return { ...state, x, y: ground, frameHold: false };
    }

    case 'climbUp': {
      const remaining = state.y - state.climbTargetY;
      const step = Math.min(Math.max(remaining, 0), CLIMB_SPEED_PX_S * dt);
      const y = state.y - step;
      if (y <= state.climbTargetY + TARGET_EPSILON_PX) {
        return { ...state, y: state.climbTargetY, phase: 'climbPause', anim: 'idle', timer: pickClimbPause(rng), frameHold: false };
      }
      return { ...state, y, frameHold: false };
    }

    case 'climbPause': {
      const timer = state.timer - dt;
      if (timer > 0) {
        return { ...state, timer, frameHold: false };
      }
      return { ...state, phase: 'climbDown', anim: 'walk', frameHold: false };
    }

    case 'climbDown': {
      const remaining = ground - state.y;
      const step = Math.min(Math.max(remaining, 0), CLIMB_SPEED_PX_S * dt);
      const y = state.y + step;
      if (y >= ground - TARGET_EPSILON_PX) {
        return { ...state, y: ground, phase: 'idle', anim: 'idle', rotation: 0, timer: pickIdlePause(rng), frameHold: false };
      }
      return { ...state, y, frameHold: false };
    }
  }
}
