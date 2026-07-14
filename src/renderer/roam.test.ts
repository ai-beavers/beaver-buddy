import { describe, expect, it } from 'vitest';
import { createRoamState, createSeededRng, tick, type Bounds, type RoamState } from './roam.js';
import { BEAVER_TILE_PX, CLIMB_SPEED_PX_S, MAX_DT_S, PET_SCALE, WALK_SPEED_PX_S } from './pet-config.js';

const bounds: Bounds = { width: 800, height: 600 };
// roam.ts clamps against the on-screen (scaled) footprint, not the raw art
// tile — tests that hand-compute bounds/ground must use the same size.
const SCALED_TILE_PX = BEAVER_TILE_PX * PET_SCALE;

// Deterministic sequence-based rng for tests that need to force a specific
// branch (e.g. land exactly on the climb decision).
function scriptedRng(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return v;
  };
}

describe('roam: pause freeze', () => {
  it('freezes position and anim while paused, only frameHold flips', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const frozen = tick(state, 1, bounds, true, rng);
    expect(frozen.x).toBe(state.x);
    expect(frozen.y).toBe(state.y);
    expect(frozen.anim).toBe(state.anim);
    expect(frozen.phase).toBe(state.phase);
    expect(frozen.frameHold).toBe(true);

    const stillFrozen = tick(frozen, 5, bounds, true, rng);
    expect(stillFrozen.x).toBe(state.x);
    expect(stillFrozen.y).toBe(state.y);
  });
});

describe('roam: no teleports', () => {
  it('bounds per-tick displacement even for a huge dt (walk)', () => {
    const rng = createSeededRng(2);
    let state: RoamState = { ...createRoamState(bounds, rng), phase: 'walk', anim: 'walk', x: 0, y: bounds.height - SCALED_TILE_PX, targetX: 799 };
    const next = tick(state, 10_000, bounds, false, rng);
    const dx = Math.abs(next.x - state.x);
    expect(dx).toBeLessThanOrEqual(WALK_SPEED_PX_S * MAX_DT_S + 1e-9);
  });

  it('bounds per-tick displacement even for a huge dt (climb)', () => {
    const rng = createSeededRng(3);
    const state: RoamState = {
      ...createRoamState(bounds, rng),
      phase: 'climbUp',
      anim: 'walk',
      x: 0,
      y: bounds.height - SCALED_TILE_PX,
      climbTargetY: 0,
    };
    const next = tick(state, 10_000, bounds, false, rng);
    const dy = Math.abs(next.y - state.y);
    expect(dy).toBeLessThanOrEqual(CLIMB_SPEED_PX_S * MAX_DT_S + 1e-9);
  });
});

describe('roam: stays in bounds', () => {
  it('keeps x within [0, width-tile] and y within [0, height-tile] over many ticks', () => {
    const rng = createSeededRng(42);
    let state = createRoamState(bounds, rng);
    const maxX = bounds.width - SCALED_TILE_PX;
    const maxY = bounds.height - SCALED_TILE_PX;
    for (let i = 0; i < 5000; i += 1) {
      state = tick(state, 0.1, bounds, false, rng);
      expect(state.x).toBeGreaterThanOrEqual(0);
      expect(state.x).toBeLessThanOrEqual(maxX);
      expect(state.y).toBeGreaterThanOrEqual(0);
      expect(state.y).toBeLessThanOrEqual(maxY);
    }
  });
});

describe('roam: climb only at edges', () => {
  it('never enters a climb phase while far from both side edges', () => {
    const rng = scriptedRng([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]); // would trigger climb if at an edge
    let state: RoamState = { ...createRoamState(bounds, rng), phase: 'idle', x: 400, y: bounds.height - SCALED_TILE_PX, timer: 0.01 };
    state = tick(state, 1, bounds, false, rng); // timer expires -> decideNext
    expect(state.phase).not.toBe('climbUp');
  });

  it('does climb when the idle timer expires at a side edge with a climb-range roll', () => {
    // createRoamState consumes 2 rng() calls (initial x, initial idle pause)
    // before decideNext's own first call (the climb roll) — land that 3rd
    // call below CLIMB_PROBABILITY (0.35).
    const rng = scriptedRng([0.9, 0.9, 0.2, 0.5, 0.5, 0.5]);
    let state: RoamState = { ...createRoamState(bounds, rng), phase: 'idle', x: 0, y: bounds.height - SCALED_TILE_PX, timer: 0.01 };
    state = tick(state, 1, bounds, false, rng);
    expect(state.phase).toBe('climbUp');
    expect(state.rotation).not.toBe(0);
  });
});

describe('roam: anim matches motion', () => {
  it('anim always matches the semantic phase (walk anim used for climb legs, idle for climb pause)', () => {
    const rng = createSeededRng(7);
    let state = createRoamState(bounds, rng);
    for (let i = 0; i < 3000; i += 1) {
      state = tick(state, 0.05, bounds, false, rng);
      switch (state.phase) {
        case 'idle':
          expect(state.anim).toBe('idle');
          break;
        case 'walk':
        case 'climbUp':
        case 'climbDown':
          expect(state.anim).toBe('walk');
          break;
        case 'climbPause':
          expect(state.anim).toBe('idle');
          break;
      }
    }
  });
});

describe('roam: deterministic under seeded rng', () => {
  it('produces identical trajectories for two runs with the same seed', () => {
    const dtSequence = Array.from({ length: 500 }, (_, i) => 0.05 + (i % 7) * 0.01);

    function run(seed: number): RoamState[] {
      const rng = createSeededRng(seed);
      let state = createRoamState(bounds, rng);
      const trace: RoamState[] = [state];
      for (const dt of dtSequence) {
        state = tick(state, dt, bounds, false, rng);
        trace.push(state);
      }
      return trace;
    }

    const a = run(1234);
    const b = run(1234);
    expect(a).toEqual(b);

    const c = run(4321);
    expect(a).not.toEqual(c);
  });
});
