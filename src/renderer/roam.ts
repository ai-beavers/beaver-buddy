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
  CLICKS_TO_GRAB,
  CLICK_WINDOW_S,
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

export type AnimName = 'idle' | 'walk' | 'struggle' | 'parachute-wind' | 'land';
export type Facing = 'left' | 'right';
type Phase = 'idle' | 'walk' | 'climbUp' | 'climbPause' | 'climbDown' | 'grabbed' | 'gliding' | 'landing';

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
  readonly clickCount: number;
  readonly clickWindowRemaining: number;
  // C2 placeholders: parachute glide physics will be driven from these fields.
  readonly glideBaseX: number;
  readonly glideSwayT: number;
  readonly glideSwaySpeed: number;
  readonly glideSwayAmp: number;
  readonly glideRotationAmp: number;
  readonly landingTimer: number;
}

export interface RoamInput {
  readonly cursorX: number;
  readonly cursorY: number;
  readonly clicks: number;
  readonly doubleClick: boolean;
}

export const defaultRoamInput: RoamInput = {
  cursorX: 0,
  cursorY: 0,
  clicks: 0,
  doubleClick: false,
};

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
    clickCount: 0,
    clickWindowRemaining: 0,
    glideBaseX: 0,
    glideSwayT: 0,
    glideSwaySpeed: 0,
    glideSwayAmp: 0,
    glideRotationAmp: 0,
    landingTimer: 0,
  };
}

function enterGrabbed(state: RoamState, bounds: Bounds, input: RoamInput): RoamState {
  return {
    ...state,
    phase: 'grabbed',
    anim: 'struggle',
    x: clamp(input.cursorX, 0, maxX(bounds)),
    y: clamp(input.cursorY, 0, groundY(bounds)),
    clickCount: 0,
    clickWindowRemaining: 0,
    frameHold: false,
  };
}

function releaseToGlide(state: RoamState, bounds: Bounds, input: RoamInput): RoamState {
  const x = clamp(input.cursorX, 0, maxX(bounds));
  const y = clamp(input.cursorY, 0, groundY(bounds));
  return {
    ...state,
    phase: 'gliding',
    anim: 'parachute-wind',
    x,
    y,
    // C2 will seed these from rng; for C1 they are initialized to zero.
    glideBaseX: x,
    glideSwayT: 0,
    glideSwaySpeed: 0,
    glideSwayAmp: 0,
    glideRotationAmp: 0,
    landingTimer: 0,
    frameHold: false,
  };
}

function isRoamingPhase(phase: Phase): boolean {
  return phase === 'idle' || phase === 'walk' || phase === 'climbUp' || phase === 'climbPause' || phase === 'climbDown';
}

function processInput(state: RoamState, dt: number, bounds: Bounds, input: RoamInput): RoamState {
  if (state.phase === 'grabbed') {
    if (input.doubleClick) {
      return releaseToGlide(state, bounds, input);
    }
    return state;
  }

  if (!isRoamingPhase(state.phase)) {
    return state;
  }

  // Decay the click window first, regardless of whether a click happens this
  // tick, so the window is measured in real elapsed time from the first click.
  let clickCount = state.clickCount;
  let clickWindowRemaining = state.clickWindowRemaining - dt;
  if (clickWindowRemaining <= 0) {
    clickCount = 0;
    clickWindowRemaining = 0;
  }

  if (input.clicks > 0) {
    // The window opens on click 1 and lasts 4 seconds total; subsequent clicks
    // inside the window do not extend it.
    if (clickCount === 0) {
      clickWindowRemaining = CLICK_WINDOW_S;
    }
    clickCount += input.clicks;

    const next = { ...state, clickCount, clickWindowRemaining };
    if (clickCount >= CLICKS_TO_GRAB) {
      return enterGrabbed(next, bounds, input);
    }
    return next;
  }

  return { ...state, clickCount, clickWindowRemaining };
}

export function tick(
  state: RoamState,
  dtSeconds: number,
  bounds: Bounds,
  paused: boolean,
  rng: Rng,
  input: RoamInput = defaultRoamInput,
): RoamState {
  if (paused) {
    return { ...state, frameHold: true };
  }

  const dt = clamp(dtSeconds, 0, MAX_DT_S);
  const inputState = processInput(state, dt, bounds, input);
  const ground = groundY(bounds);

  switch (inputState.phase) {
    case 'idle': {
      const timer = inputState.timer - dt;
      if (timer > 0) {
        return { ...inputState, timer, frameHold: false };
      }
      return decideNext({ ...inputState, y: ground }, bounds, rng);
    }

    case 'walk': {
      const remaining = inputState.targetX - inputState.x;
      const step = Math.min(Math.abs(remaining), WALK_SPEED_PX_S * dt);
      const x = clamp(inputState.x + Math.sign(remaining) * step, 0, maxX(bounds));
      if (Math.abs(inputState.targetX - x) <= TARGET_EPSILON_PX) {
        return { ...inputState, x, y: ground, phase: 'idle', anim: 'idle', timer: pickIdlePause(rng), frameHold: false };
      }
      return { ...inputState, x, y: ground, frameHold: false };
    }

    case 'climbUp': {
      const remaining = inputState.y - inputState.climbTargetY;
      const step = Math.min(Math.max(remaining, 0), CLIMB_SPEED_PX_S * dt);
      const y = inputState.y - step;
      if (y <= inputState.climbTargetY + TARGET_EPSILON_PX) {
        return { ...inputState, y: inputState.climbTargetY, phase: 'climbPause', anim: 'idle', timer: pickClimbPause(rng), frameHold: false };
      }
      return { ...inputState, y, frameHold: false };
    }

    case 'climbPause': {
      const timer = inputState.timer - dt;
      if (timer > 0) {
        return { ...inputState, timer, frameHold: false };
      }
      return { ...inputState, phase: 'climbDown', anim: 'walk', frameHold: false };
    }

    case 'climbDown': {
      const remaining = ground - inputState.y;
      const step = Math.min(Math.max(remaining, 0), CLIMB_SPEED_PX_S * dt);
      const y = inputState.y + step;
      if (y >= ground - TARGET_EPSILON_PX) {
        return { ...inputState, y: ground, phase: 'idle', anim: 'idle', rotation: 0, timer: pickIdlePause(rng), frameHold: false };
      }
      return { ...inputState, y, frameHold: false };
    }

    case 'grabbed': {
      return {
        ...inputState,
        x: clamp(input.cursorX, 0, maxX(bounds)),
        y: clamp(input.cursorY, 0, ground),
        anim: 'struggle',
        frameHold: false,
      };
    }

    case 'gliding':
    case 'landing': {
      // C2/C3 physics and landing timeout will be added here.
      return { ...inputState, frameHold: false };
    }
  }
}
