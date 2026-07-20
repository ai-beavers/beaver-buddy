import { describe, expect, it } from 'vitest';
import { createRoamState, createSeededRng, defaultRoamInput, tick, type Bounds, type RoamInput, type RoamState } from './roam.js';
import { BEAVER_TILE_PX, CLICKS_TO_GRAB, CLICK_WINDOW_S, CLIMB_SPEED_PX_S, MAX_DT_S, PET_SCALE, WALK_SPEED_PX_S } from './pet-config.js';

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
        case 'climbPause':
          expect(state.anim).toBe('idle');
          break;
        case 'walk':
        case 'climbUp':
        case 'climbDown':
          expect(state.anim).toBe('walk');
          break;
        case 'grabbed':
          expect(state.anim).toBe('struggle');
          break;
        case 'gliding':
          expect(state.anim).toBe('parachute-wind');
          break;
        case 'landing':
          expect(state.anim).toBe('land');
          break;
      }
    }
  });
});

describe('roam: parachute C1 grab interaction', () => {
  it('starts with zero click count and window', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    expect(state.clickCount).toBe(0);
    expect(state.clickWindowRemaining).toBe(0);
  });

  it('opens a 4-second click window on the first click', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const next = tick(state, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(next.clickCount).toBe(1);
    expect(next.clickWindowRemaining).toBe(CLICK_WINDOW_S);
  });

  it('counts the click window down with dt', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    let next = tick(state, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    next = tick(next, 0.25, bounds, false, rng);
    expect(next.clickWindowRemaining).toBe(CLICK_WINDOW_S - 0.25);
  });

  it('enters grabbed after three clicks within the window', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const input: RoamInput = { ...defaultRoamInput, clicks: 1 };
    let next = tick(state, 0.5, bounds, false, rng, input);
    next = tick(next, 0.5, bounds, false, rng, input);
    next = tick(next, 0.5, bounds, false, rng, input);
    expect(next.phase).toBe('grabbed');
    expect(next.anim).toBe('struggle');
  });

  it('resets the click counter when the window expires before the third click', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    let next = tick(state, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    next = tick(next, 0.25, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    // Decay the full window without another click.
    for (let i = 0; i < 16; i += 1) {
      next = tick(next, 0.25, bounds, false, rng);
    }
    expect(next.clickCount).toBe(0);
    expect(next.clickWindowRemaining).toBe(0);
  });

  it('counts clicks in both idle and walk phases', () => {
    const rng = createSeededRng(1);
    let state = createRoamState(bounds, rng);
    state = tick(state, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(state.clickCount).toBe(1);

    const walkState: RoamState = { ...state, phase: 'walk', anim: 'walk' };
    const next = tick(walkState, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(next.clickCount).toBe(2);
  });

  it('makes the beaver follow the cursor while grabbed', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const grabbed = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: 123,
      cursorY: 234,
    });
    expect(grabbed.x).toBe(123);
    expect(grabbed.y).toBe(234);
    expect(grabbed.phase).toBe('grabbed');
    expect(grabbed.anim).toBe('struggle');

    const moved = tick(grabbed, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      cursorX: 500,
      cursorY: 400,
    });
    expect(moved.x).toBe(500);
    expect(moved.y).toBe(400);
  });

  it('clamps the grabbed position to bounds on both sides', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const maxX = bounds.width - SCALED_TILE_PX;
    const ground = bounds.height - SCALED_TILE_PX;

    const leftBottom = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: -50,
      cursorY: 9999,
    });
    expect(leftBottom.x).toBe(0);
    expect(leftBottom.y).toBe(ground);

    const rightTop = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: 9999,
      cursorY: -50,
    });
    expect(rightTop.x).toBe(maxX);
    expect(rightTop.y).toBe(0);

    const inside = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: 123,
      cursorY: 234,
    });
    expect(inside.x).toBe(123);
    expect(inside.y).toBe(234);
  });

  it('keeps the click window fixed: clicks 2 and 3 do not extend it', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    let next = tick(state, 0, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(next.clickCount).toBe(1);
    expect(next.clickWindowRemaining).toBe(CLICK_WINDOW_S);

    // Advance 3.75 s in MAX_DT_S steps, then click 2 at t=3.9 s.
    for (let i = 0; i < 15; i += 1) {
      next = tick(next, MAX_DT_S, bounds, false, rng);
    }
    next = tick(next, 0.15, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(next.clickCount).toBe(2);
    expect(next.clickWindowRemaining).toBeCloseTo(0.1);

    // Let the fixed 4-second window expire (click 2 did NOT extend it).
    next = tick(next, 0.1, bounds, false, rng);
    expect(next.clickCount).toBe(0);
    expect(next.clickWindowRemaining).toBe(0);

    // Click 3 at t=4.2 s starts a fresh window instead of grabbing.
    next = tick(next, 0.2, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(next.phase).not.toBe('grabbed');
    expect(next.clickCount).toBe(1);
    expect(next.clickWindowRemaining).toBe(CLICK_WINDOW_S);
  });

  it('does nothing on double-click while roaming', () => {
    const rng = createSeededRng(1);
    const idle = createRoamState(bounds, rng);
    const idleAfter = tick(idle, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      doubleClick: true,
      cursorX: 123,
      cursorY: 234,
    });
    expect(idleAfter.phase).toBe('idle');
    expect(idleAfter.clickCount).toBe(0);
    expect(idleAfter.clickWindowRemaining).toBe(0);

    const walk: RoamState = {
      ...createRoamState(bounds, rng),
      phase: 'walk',
      anim: 'walk',
      x: 100,
      targetX: 300,
    };
    const walkAfter = tick(walk, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      doubleClick: true,
      cursorX: 123,
      cursorY: 234,
    });
    expect(walkAfter.phase).toBe('walk');
    expect(walkAfter.clickCount).toBe(0);
    expect(walkAfter.clickWindowRemaining).toBe(0);
  });

  it('counts clicks in every roam phase including climb', () => {
    const rng = createSeededRng(1);
    const base = createRoamState(bounds, rng);

    const climbUp: RoamState = {
      ...base,
      phase: 'climbUp',
      anim: 'walk',
      x: 0,
      y: 200,
      climbTargetY: 100,
    };
    const afterClimbUp = tick(climbUp, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(afterClimbUp.clickCount).toBe(1);

    const climbPause: RoamState = {
      ...base,
      phase: 'climbPause',
      anim: 'idle',
      x: 0,
      y: 100,
      timer: 2,
    };
    const afterClimbPause = tick(climbPause, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(afterClimbPause.clickCount).toBe(1);

    const climbDown: RoamState = {
      ...base,
      phase: 'climbDown',
      anim: 'walk',
      x: 0,
      y: 150,
    };
    const afterClimbDown = tick(climbDown, 0.1, bounds, false, rng, { ...defaultRoamInput, clicks: 1 });
    expect(afterClimbDown.clickCount).toBe(1);
  });

  it('grabs at the third click position when three separate clicks arrive within the window', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const path = [
      { x: 100, y: 100 },
      { x: 200, y: 150 },
      { x: 350, y: 275 },
    ];
    let next = state;
    for (let i = 0; i < path.length; i += 1) {
      next = tick(next, 1, bounds, false, rng, {
        ...defaultRoamInput,
        clicks: 1,
        cursorX: path[i].x,
        cursorY: path[i].y,
      });
    }
    expect(next.phase).toBe('grabbed');
    expect(next.x).toBe(path[path.length - 1].x);
    expect(next.y).toBe(path[path.length - 1].y);
  });

  it('resets click state after being grabbed so a fresh three-click sequence is required', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const grabbed = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
    });
    expect(grabbed.clickCount).toBe(0);
    expect(grabbed.clickWindowRemaining).toBe(0);
  });

  it('pauses roam timer and position progression while grabbed', () => {
    const rng = createSeededRng(1);
    const state: RoamState = { ...createRoamState(bounds, rng), phase: 'walk', anim: 'walk', x: 100, targetX: 300 };
    const grabbed = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: 100,
      cursorY: 100,
    });
    const still = tick(grabbed, 1, bounds, false, rng, {
      ...defaultRoamInput,
      cursorX: 100,
      cursorY: 100,
    });
    expect(still.x).toBe(100);
    expect(still.y).toBe(100);
    expect(still.timer).toBe(grabbed.timer);
  });

  it('releases to gliding on double-click while grabbed', () => {
    const rng = createSeededRng(1);
    const state = createRoamState(bounds, rng);
    const grabbed = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX: 200,
      cursorY: 200,
    });
    const gliding = tick(grabbed, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      doubleClick: true,
      cursorX: 250,
      cursorY: 250,
    });
    expect(gliding.phase).toBe('gliding');
    expect(gliding.anim).toBe('parachute-wind');
    expect(gliding.x).toBe(250);
    expect(gliding.y).toBe(250);
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
