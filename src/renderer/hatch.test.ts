import { describe, expect, it } from 'vitest';
import {
  hatchShakeOffset,
  shakeJitterPx,
  sparkOffsets,
  startHatch,
  tickHatch,
  type HatchState,
} from './hatch.js';
import { createSeededRng } from './roam.js';
import {
  HATCH_BABY_APPEAR_DURATION_S,
  HATCH_BURST_DURATION_S,
  HATCH_LODGE_IDLE_DURATION_S,
  HATCH_SHAKE_BURST_ACTIVE_S,
  HATCH_SHAKE_BURST_COUNT,
  HATCH_SHAKE_PAUSE_END_S,
  HATCH_SHAKE_PAUSE_START_S,
} from './pet-config.js';

// Fake clock: step tickHatch by fixed dt increments instead of real timers —
// the sequencer is a pure function of (state, dt, rng), so this is exactly
// as deterministic as vi.useFakeTimers() would be, with no setTimeout/rAF
// plumbing needed (same pattern as evolution.test.ts's advance()).
function advance(state: HatchState, totalSeconds: number, rng: () => number, stepSeconds = 1 / 1000): HatchState {
  let s = state;
  let remaining = totalSeconds;
  while (remaining > 0) {
    const dt = Math.min(stepSeconds, remaining);
    s = tickHatch(s, dt, rng);
    remaining -= dt;
  }
  return s;
}

// Each phase transition inside tickHatch resets elapsedS to 0, discarding
// the fractional remainder above the threshold (same pattern as
// evolution.ts's shake -> flash reset) — so an exact-duration advance can
// undershoot by up to ~stepSeconds per transition. The shake phase alone
// has 2*HATCH_SHAKE_BURST_COUNT-1 transitions; this margin comfortably
// covers that plus the rest of the sequence.
const EPSILON_S = 0.05;

// Sum of every active-shake + inter-burst-pause duration, i.e. exactly the
// time needed to walk through all bursts and land in the 'burst' phase.
function totalShakeDurationS(): number {
  let total = HATCH_SHAKE_BURST_COUNT * HATCH_SHAKE_BURST_ACTIVE_S;
  for (let b = 1; b < HATCH_SHAKE_BURST_COUNT; b++) {
    const t = b / (HATCH_SHAKE_BURST_COUNT - 1);
    total += HATCH_SHAKE_PAUSE_START_S + (HATCH_SHAKE_PAUSE_END_S - HATCH_SHAKE_PAUSE_START_S) * t;
  }
  return total;
}

describe('hatch: phase progression', () => {
  it('starts in lodge-idle', () => {
    expect(startHatch().phase).toBe('lodge-idle');
  });

  it('stays in lodge-idle until the duration elapses', () => {
    const state = advance(startHatch(), HATCH_LODGE_IDLE_DURATION_S - 0.05, Math.random);
    expect(state.phase).toBe('lodge-idle');
  });

  it('moves lodge-idle -> shake once the idle duration elapses', () => {
    const state = advance(startHatch(), HATCH_LODGE_IDLE_DURATION_S + EPSILON_S, Math.random);
    expect(state.phase).toBe('shake');
  });

  it('moves shake -> burst after all bursts + pauses complete', () => {
    const state = advance(
      startHatch(),
      HATCH_LODGE_IDLE_DURATION_S + totalShakeDurationS() + EPSILON_S,
      Math.random,
    );
    expect(state.phase).toBe('burst');
    expect(state.burstsDone).toBe(HATCH_SHAKE_BURST_COUNT);
    expect(state.sparks.length).toBeGreaterThan(0);
  });

  it('moves burst -> baby-appear -> done', () => {
    const toBurst = HATCH_LODGE_IDLE_DURATION_S + totalShakeDurationS() + EPSILON_S;
    const state = advance(startHatch(), toBurst + HATCH_BURST_DURATION_S + EPSILON_S, Math.random);
    expect(state.phase).toBe('baby-appear');

    const done = advance(state, HATCH_BABY_APPEAR_DURATION_S + EPSILON_S, Math.random);
    expect(done.phase).toBe('done');
  });

  it('ends in done after the full sequence', () => {
    const total =
      HATCH_LODGE_IDLE_DURATION_S +
      totalShakeDurationS() +
      HATCH_BURST_DURATION_S +
      HATCH_BABY_APPEAR_DURATION_S +
      0.05;
    const state = advance(startHatch(), total, Math.random);
    expect(state.phase).toBe('done');
  });

  it('a done state is a fixed point (further ticks are no-ops)', () => {
    const total =
      HATCH_LODGE_IDLE_DURATION_S +
      totalShakeDurationS() +
      HATCH_BURST_DURATION_S +
      HATCH_BABY_APPEAR_DURATION_S +
      0.05;
    const done = advance(startHatch(), total, Math.random);
    expect(tickHatch(done, 5, Math.random)).toEqual(done);
  });
});

describe('hatch: escalating shake amplitude', () => {
  it('is monotone non-decreasing across bursts, ramping from min to max px', () => {
    const amplitudes = Array.from({ length: HATCH_SHAKE_BURST_COUNT }, (_, i) => shakeJitterPx(i));
    for (let i = 1; i < amplitudes.length; i++) {
      expect(amplitudes[i]).toBeGreaterThanOrEqual(amplitudes[i - 1]);
    }
    expect(amplitudes[0]).toBeLessThan(amplitudes[amplitudes.length - 1]);
  });

  it('shake offset is zero outside the shake phase', () => {
    const idle = startHatch();
    expect(hatchShakeOffset(idle, () => 1)).toEqual({ dx: 0, dy: 0 });
  });

  it('shake offset is zero during the inter-burst pause', () => {
    const paused = advance(startHatch(), HATCH_LODGE_IDLE_DURATION_S + HATCH_SHAKE_BURST_ACTIVE_S + EPSILON_S, Math.random);
    expect(paused.phase).toBe('shake');
    expect(paused.inPause).toBe(true);
    expect(hatchShakeOffset(paused, () => 1)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('hatch: deterministic sparks', () => {
  function toBurstPhase(): HatchState {
    return advance(
      startHatch(),
      HATCH_LODGE_IDLE_DURATION_S + totalShakeDurationS() + EPSILON_S,
      createSeededRng(42),
    );
  }

  it('produces the same spark count and angles for the same seed', () => {
    const a = toBurstPhase();
    const b = toBurstPhase();
    expect(a.phase).toBe('burst');
    expect(a.sparks).toEqual(b.sparks);
    expect(a.sparks.length).toBeGreaterThanOrEqual(4);
    expect(a.sparks.length).toBeLessThanOrEqual(6);
  });

  it('sparks radiate outward from the lodge center as burst time elapses', () => {
    // toBurstPhase() lands just past the shake -> burst threshold (the
    // EPSILON_S overshoot from advance()'s fixed-step clock), so elapsedS is
    // a small positive number, not exactly 0 — assert growth, not an exact
    // zero start.
    const burstStart = toBurstPhase();
    const earlyRadii = sparkOffsets(burstStart).map(({ dx, dy }) => Math.hypot(dx, dy));

    const later = tickHatch(burstStart, 0.2, Math.random);
    const laterRadii = sparkOffsets(later).map(({ dx, dy }) => Math.hypot(dx, dy));

    expect(laterRadii.length).toBe(earlyRadii.length);
    for (let i = 0; i < laterRadii.length; i++) {
      expect(laterRadii[i]).toBeGreaterThan(earlyRadii[i]);
    }
  });

  it('sparkOffsets is empty outside the burst phase', () => {
    expect(sparkOffsets(startHatch())).toEqual([]);
  });
});
