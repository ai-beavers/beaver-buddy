import { describe, expect, it } from 'vitest';
import {
  clampRoamStateToBounds,
  createRoamState,
  createSeededRng,
  defaultRoamInput,
  enterToiletRoutine,
  forceToiletRoutine,
  forceWorking,
  tick,
  type Bounds,
  type RoamInput,
  type RoamState,
} from './roam.js';
import {
  BEAVER_TILE_PX,
  CLICKS_TO_GRAB,
  CLICK_WINDOW_S,
  CLIMB_SPEED_PX_S,
  GLIDE_FALL_SPEED_PX_S,
  GLIDE_ROTATION_MAX_DEG,
  GLIDE_SWAY_AMP_MAX_PX,
  GLIDE_SWAY_AMP_MIN_PX,
  GLIDE_SWAY_SPEED_MAX,
  GLIDE_SWAY_SPEED_MIN,
  LANDING_DURATION_S,
  MAX_DT_S,
  PET_SCALE,
  WALK_SPEED_PX_S,
  WORK_DURATION_MAX_S,
} from './pet-config.js';

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
    // createRoamState consumes 2 rng() calls (initial x, initial idle pause).
    // decideNext then rolls work (3rd, high to skip), toilet routine (4th, high
    // to skip), then climb (5th, below CLIMB_PROBABILITY 0.35).
    const rng = scriptedRng([0.9, 0.9, 0.9, 0.9, 0.2, 0.5, 0.5]);
    let state: RoamState = { ...createRoamState(bounds, rng), phase: 'idle', x: 0, y: bounds.height - SCALED_TILE_PX, timer: 0.01 };
    state = tick(state, 1, bounds, false, rng);
    expect(state.phase).toBe('climbUp');
    expect(state.rotation).not.toBe(0);
  });
});

describe('roam: working (sit and type)', () => {
  const ground = bounds.height - SCALED_TILE_PX;

  it('enters working when the idle timer expires and the work roll wins', () => {
    // createRoamState consumes 2 rng() calls; decideNext's first call is the
    // work roll — land it below WORK_PROBABILITY (0.05).
    const rng = scriptedRng([0.9, 0.9, 0.01, 0.5]);
    const start: RoamState = { ...createRoamState(bounds, rng), phase: 'idle', x: 300, y: ground, timer: 0.01 };
    const next = tick(start, 1, bounds, false, rng);
    expect(next.phase).toBe('working');
    expect(next.anim).toBe('type');
    // Stationary: it sits where it was idling.
    expect(next.x).toBe(300);
    expect(next.y).toBe(ground);
  });

  it('stays put for the whole typing loop, then returns to idle roaming', () => {
    const rng = createSeededRng(1);
    let state: RoamState = {
      ...createRoamState(bounds, rng),
      phase: 'working',
      anim: 'type',
      x: 250,
      y: ground,
      timer: WORK_DURATION_MAX_S,
    };
    // Tick past the longest possible loop; x never moves while working.
    let sawWorking = false;
    for (let elapsed = 0; elapsed < WORK_DURATION_MAX_S + 1; elapsed += 0.1) {
      state = tick(state, 0.1, bounds, false, rng);
      expect(state.x).toBe(250);
      if (state.phase === 'working') sawWorking = true;
    }
    expect(sawWorking).toBe(true);
    expect(state.phase).toBe('idle');
    expect(state.anim).toBe('idle');
  });

  it('forceWorking starts typing from idle and snaps to the ground', () => {
    const rng = createSeededRng(1);
    const start: RoamState = { ...createRoamState(bounds, rng), phase: 'walk', anim: 'walk', x: 250, y: 10 };
    const next = forceWorking(start, bounds, rng);
    expect(next.phase).toBe('working');
    expect(next.anim).toBe('type');
    expect(next.x).toBe(250);
    expect(next.y).toBe(ground);
    expect(next.timer).toBeGreaterThan(0);
  });

  it('forceWorking is a no-op mid grab/glide/landing (never interrupts an interaction)', () => {
    const rng = createSeededRng(1);
    for (const phase of ['grabbed', 'gliding', 'landing'] as const) {
      const busy: RoamState = { ...createRoamState(bounds, rng), phase, anim: 'struggle' };
      expect(forceWorking(busy, bounds, rng)).toBe(busy);
    }
  });

  it('can still be grabbed mid-type', () => {
    const rng = createSeededRng(1);
    let state: RoamState = {
      ...createRoamState(bounds, rng),
      phase: 'working',
      anim: 'type',
      x: 250,
      y: ground,
      timer: WORK_DURATION_MAX_S,
    };
    const grab: RoamInput = { ...defaultRoamInput, clicks: CLICKS_TO_GRAB, cursorX: 250, cursorY: ground };
    state = tick(state, 0.1, bounds, false, rng, grab);
    expect(state.phase).toBe('grabbed');
    expect(state.anim).toBe('struggle');
  });
});

describe('roam: toilet routine', () => {
  it('enterToiletRoutine starts on toilet-read', () => {
    const start = createRoamState(bounds, createSeededRng(1));
    const next = enterToiletRoutine(start);
    expect(next.phase).toBe('toiletRoutine');
    expect(next.anim).toBe('toilet-read');
    expect(next.toiletRoutine?.step).toBe('toilet-read');
    expect(next.toiletReverse).toBe(false);
  });

  it('forceToiletRoutine snaps to ground and is a no-op mid interaction', () => {
    const rng = createSeededRng(1);
    const groundY = bounds.height - SCALED_TILE_PX;
    const walk: RoamState = { ...createRoamState(bounds, rng), phase: 'walk', anim: 'walk', x: 250, y: 10 };
    const next = forceToiletRoutine(walk, bounds);
    expect(next.phase).toBe('toiletRoutine');
    expect(next.y).toBe(groundY);

    for (const phase of ['grabbed', 'gliding', 'landing'] as const) {
      const busy: RoamState = { ...createRoamState(bounds, rng), phase, anim: 'struggle' };
      expect(forceToiletRoutine(busy, bounds)).toBe(busy);
    }
  });

  it('advances through the gag and returns to idle', () => {
    const rng = createSeededRng(1);
    let state = enterToiletRoutine(createRoamState(bounds, rng));
    // 5 steps × 1s each = 5s to reach done → idle
    for (let i = 0; i < 50; i += 1) {
      state = tick(state, 0.1, bounds, false, rng);
    }
    expect(state.phase).toBe('idle');
    expect(state.anim).toBe('idle');
    expect(state.toiletRoutine).toBeNull();
  });

  it('marks wave-back as reverse while in that step', () => {
    const rng = createSeededRng(1);
    let state = enterToiletRoutine(createRoamState(bounds, rng));
    // toilet-read (1s) + flush (1s) + wave-away (1s) → wave-back.
    // tick clamps dt to MAX_DT_S, so advance in small slices.
    for (let i = 0; i < 30; i += 1) {
      state = tick(state, 0.1, bounds, false, rng);
    }
    expect(state.toiletRoutine?.step).toBe('wave-back');
    expect(state.anim).toBe('wave');
    expect(state.toiletReverse).toBe(true);
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
        case 'working':
          expect(state.anim).toBe('type');
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
    expect(grabbed.facing).toBe('right');
    expect(grabbed.rotation).toBe(0);

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
    expect(gliding.y).toBe(262); // 250 + GLIDE_FALL_SPEED_PX_S * 0.1
    expect(gliding.facing).toBe('right');
    expect(gliding.rotation).toBe(0);
  });
});

describe('roam: parachute C2 glide physics + landing', () => {
  function enterGliding(
    rng: () => number,
    cursorX: number,
    cursorY: number,
  ): RoamState {
    const state = createRoamState(bounds, rng);
    const grabbed = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: CLICKS_TO_GRAB,
      cursorX,
      cursorY,
    });
    return tick(grabbed, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      doubleClick: true,
      cursorX,
      cursorY,
    });
  }

  it('falls at the configured glide speed', () => {
    const rng = createSeededRng(100);
    const state: RoamState = {
      ...createRoamState(bounds, rng),
      phase: 'gliding',
      x: 400,
      y: 100,
      glideBaseX: 400,
      glideSwaySpeed: 0,
      glideSwayAmp: 0,
      glideRotationAmp: 0,
    };
    const next = tick(state, 0.25, bounds, false, rng);
    expect(next.y - state.y).toBeCloseTo(GLIDE_FALL_SPEED_PX_S * 0.25);
    expect(next.phase).toBe('gliding');
  });

  it('seeds sway speed within the configured range', () => {
    const rng = createSeededRng(101);
    const state = enterGliding(rng, 400, 100);
    expect(state.glideSwaySpeed).toBeGreaterThanOrEqual(GLIDE_SWAY_SPEED_MIN);
    expect(state.glideSwaySpeed).toBeLessThanOrEqual(GLIDE_SWAY_SPEED_MAX);
  });

  it('seeds sway amplitude within the configured range', () => {
    const rng = createSeededRng(102);
    const state = enterGliding(rng, 400, 100);
    expect(state.glideSwayAmp).toBeGreaterThanOrEqual(GLIDE_SWAY_AMP_MIN_PX);
    expect(state.glideSwayAmp).toBeLessThanOrEqual(GLIDE_SWAY_AMP_MAX_PX);
  });

  it('rotation follows the sway sine and stays within the configured max', () => {
    const rng = createSeededRng(103);
    const state = enterGliding(rng, 400, 100);
    const next = tick(state, 0.5, bounds, false, rng);
    const sway = Math.sin(state.glideSwayT * state.glideSwaySpeed);
    expect(next.rotation).toBeCloseTo(sway * state.glideRotationAmp);
    expect(Math.abs(next.rotation)).toBeLessThanOrEqual(GLIDE_ROTATION_MAX_DEG + 1e-9);
  });

  it('clamps x to the left edge while gliding', () => {
    const state: RoamState = {
      ...createRoamState(bounds, createSeededRng(1)),
      phase: 'gliding',
      x: 400,
      y: 100,
      glideBaseX: 10,
      glideSwaySpeed: 1,
      glideSwayAmp: 50,
      glideSwayT: (3 * Math.PI) / 2, // sin(3π/2) = -1, pushes x left
      glideRotationAmp: GLIDE_ROTATION_MAX_DEG,
    };
    const next = tick(state, 0.1, bounds, false, createSeededRng(1));
    expect(next.x).toBe(0);
  });

  it('clamps x to the right edge while gliding', () => {
    const max = bounds.width - SCALED_TILE_PX;
    const state: RoamState = {
      ...createRoamState(bounds, createSeededRng(1)),
      phase: 'gliding',
      x: 400,
      y: 100,
      glideBaseX: max - 10,
      glideSwaySpeed: 1,
      glideSwayAmp: 50,
      glideSwayT: Math.PI / 2, // sin(π/2) = 1, pushes x right
      glideRotationAmp: GLIDE_ROTATION_MAX_DEG,
    };
    const next = tick(state, 0.1, bounds, false, createSeededRng(1));
    expect(next.x).toBe(max);
  });

  it('bounds per-tick displacement even for a huge dt (glide)', () => {
    const rng = createSeededRng(106);
    const state = enterGliding(rng, 400, 100);
    const next = tick(state, 10_000, bounds, false, rng);
    const dy = Math.abs(next.y - state.y);
    expect(dy).toBeLessThanOrEqual(GLIDE_FALL_SPEED_PX_S * MAX_DT_S + 1e-9);
  });

  it('transitions to landing with all fields set correctly when ground is reached', () => {
    const rng = createSeededRng(107);
    const ground = bounds.height - SCALED_TILE_PX;
    const state = enterGliding(rng, 400, ground - 30); // still gliding after release tick
    expect(state.phase).toBe('gliding');
    const next = tick(state, 0.25, bounds, false, rng);
    expect(next.phase).toBe('landing');
    expect(next.anim).toBe('land');
    expect(next.y).toBe(ground);
    expect(next.rotation).toBe(0);
    expect(next.landingTimer).toBe(LANDING_DURATION_S);
    expect(next.frameHold).toBe(false);
  });

  it('decrements the landing timer by dt', () => {
    const rng = createSeededRng(108);
    const ground = bounds.height - SCALED_TILE_PX;
    let state = enterGliding(rng, 400, ground - 30);
    state = tick(state, 0.25, bounds, false, rng); // enter landing
    expect(state.phase).toBe('landing');
    const next = tick(state, 0.25, bounds, false, rng);
    expect(next.landingTimer).toBeCloseTo(LANDING_DURATION_S - 0.25);
    expect(next.phase).toBe('landing');
  });

  it('transitions from landing to idle with a fresh idle pause when the timer expires', () => {
    const rng = createSeededRng(109);
    const ground = bounds.height - SCALED_TILE_PX;
    let state = enterGliding(rng, 400, ground - 30);
    state = tick(state, 0.25, bounds, false, rng); // enter landing
    let next = state;
    for (let i = 0; i < 10; i += 1) {
      next = tick(next, 0.25, bounds, false, rng);
      if (next.phase === 'idle') break;
    }
    expect(next.phase).toBe('idle');
    expect(next.anim).toBe('idle');
    expect(next.y).toBe(ground);
    expect(next.rotation).toBe(0);
    expect(next.timer).toBeGreaterThan(0);
  });

  it('keeps x and y stable during landing', () => {
    const rng = createSeededRng(110);
    const ground = bounds.height - SCALED_TILE_PX;
    let state = enterGliding(rng, 400, ground - 30);
    state = tick(state, 0.25, bounds, false, rng); // enter landing
    const next = tick(state, 0.25, bounds, false, rng);
    expect(next.x).toBe(state.x);
    expect(next.y).toBe(ground);
  });

  it('releases at the ground immediately transitions to landing', () => {
    const rng = createSeededRng(111);
    const ground = bounds.height - SCALED_TILE_PX;
    const state = enterGliding(rng, 400, ground);
    const next = tick(state, 0.1, bounds, false, rng);
    expect(next.phase).toBe('landing');
    expect(next.y).toBe(ground);
  });

  it('ignores clicks while gliding', () => {
    const rng = createSeededRng(112);
    const state = enterGliding(rng, 400, 100);
    const next = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: 3,
    });
    expect(next.phase).toBe('gliding');
    expect(next.clickCount).toBe(0);
  });

  it('ignores clicks while landing', () => {
    const rng = createSeededRng(113);
    const ground = bounds.height - SCALED_TILE_PX;
    let state = enterGliding(rng, 400, ground - 10);
    state = tick(state, 0.5, bounds, false, rng); // enter landing
    const next = tick(state, 0.1, bounds, false, rng, {
      ...defaultRoamInput,
      clicks: 3,
    });
    expect(next.phase).toBe('landing');
    expect(next.clickCount).toBe(0);
  });

  it('freezes position and sway while gliding is paused', () => {
    const rng = createSeededRng(114);
    const state = enterGliding(rng, 400, 100);
    const next = tick(state, 0.5, bounds, true, rng);
    expect(next.x).toBe(state.x);
    expect(next.y).toBe(state.y);
    expect(next.glideSwayT).toBe(state.glideSwayT);
    expect(next.frameHold).toBe(true);
  });

  it('freezes landing timer and position while paused', () => {
    const rng = createSeededRng(115);
    const ground = bounds.height - SCALED_TILE_PX;
    let state = enterGliding(rng, 400, ground - 10);
    state = tick(state, 0.5, bounds, false, rng); // enter landing
    const next = tick(state, 0.5, bounds, true, rng);
    expect(next.y).toBe(ground);
    expect(next.landingTimer).toBe(state.landingTimer);
    expect(next.frameHold).toBe(true);
  });

  it('produces identical glide trajectories for the same seed', () => {
    const dtSequence = [0.1, 0.2, 0.15, 0.3, 0.5, 0.1];

    function run(seed: number): RoamState[] {
      const rng = createSeededRng(seed);
      const state = enterGliding(rng, 400, 100);
      const trace: RoamState[] = [state];
      for (const dt of dtSequence) {
        trace.push(tick(trace[trace.length - 1], dt, bounds, false, rng));
      }
      return trace;
    }

    expect(run(200)).toEqual(run(200));
  });

  it('produces different glide trajectories for different seeds', () => {
    const dtSequence = [0.1, 0.2, 0.15, 0.3, 0.5, 0.1];

    function run(seed: number): RoamState[] {
      const rng = createSeededRng(seed);
      const state = enterGliding(rng, 400, 100);
      const trace: RoamState[] = [state];
      for (const dt of dtSequence) {
        trace.push(tick(trace[trace.length - 1], dt, bounds, false, rng));
      }
      return trace;
    }

    expect(run(201)).not.toEqual(run(202));
  });

  it('clampRoamStateToBounds keeps gliding y, clamps landing y, and clamps glideBaseX', () => {
    const ground = bounds.height - SCALED_TILE_PX;
    const max = bounds.width - SCALED_TILE_PX;

    const gliding: RoamState = {
      ...createRoamState(bounds, createSeededRng(1)),
      phase: 'gliding',
      x: -10,
      y: 100,
      glideBaseX: max + 50,
    };
    const clampedGliding = clampRoamStateToBounds(gliding, bounds);
    expect(clampedGliding.y).toBe(100); // not forced to ground
    expect(clampedGliding.x).toBe(0);
    expect(clampedGliding.glideBaseX).toBe(max);

    const landing: RoamState = {
      ...createRoamState(bounds, createSeededRng(1)),
      phase: 'landing',
      x: -10,
      y: 50,
      glideBaseX: max + 50,
    };
    const clampedLanding = clampRoamStateToBounds(landing, bounds);
    expect(clampedLanding.y).toBe(ground); // forced to ground
    expect(clampedLanding.x).toBe(0);
    expect(clampedLanding.glideBaseX).toBe(max);
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
