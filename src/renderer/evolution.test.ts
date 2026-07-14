import { describe, expect, it } from 'vitest';
import { isFlashVisible, shakeOffset, startEvolution, tickEvolution, type EvolutionState } from './evolution.js';
import {
  EVOLUTION_FLASH_BLINK_COUNT,
  EVOLUTION_FLASH_BLINK_DURATION_S,
  EVOLUTION_SHAKE_DURATION_S,
  EVOLUTION_SHAKE_JITTER_PX,
} from './pet-config.js';

// Fake clock: step tickEvolution by fixed dt increments instead of real
// timers — the sequencer is a pure function of (state, dt), so this is
// exactly as deterministic as vi.useFakeTimers() would be, with no
// setTimeout/rAF plumbing needed.
function advance(state: EvolutionState, totalSeconds: number, stepSeconds = 1 / 60): EvolutionState {
  let s = state;
  let remaining = totalSeconds;
  while (remaining > 0) {
    const dt = Math.min(stepSeconds, remaining);
    s = tickEvolution(s, dt);
    remaining -= dt;
  }
  return s;
}

describe('evolution: phase timing', () => {
  it('starts in shake with the target stage', () => {
    const state = startEvolution('teen');
    expect(state.phase).toBe('shake');
    expect(state.targetStage).toBe('teen');
  });

  it('stays in shake until EVOLUTION_SHAKE_DURATION_S elapses', () => {
    const state = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S - 0.1);
    expect(state.phase).toBe('shake');
  });

  it('moves shake -> flash once the shake duration elapses', () => {
    const state = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + 0.01);
    expect(state.phase).toBe('flash');
  });

  it('moves flash -> done after all blinks complete', () => {
    const totalFlashS = EVOLUTION_FLASH_BLINK_COUNT * EVOLUTION_FLASH_BLINK_DURATION_S;
    const state = advance(startEvolution('adult'), EVOLUTION_SHAKE_DURATION_S + totalFlashS + 0.01);
    expect(state.phase).toBe('done');
  });

  it('ends on the new (target) stage', () => {
    const totalFlashS = EVOLUTION_FLASH_BLINK_COUNT * EVOLUTION_FLASH_BLINK_DURATION_S;
    const state = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + totalFlashS + 0.01);
    expect(state.phase).toBe('done');
    expect(state.targetStage).toBe('teen');
  });

  it('a done state is a fixed point (further ticks are no-ops)', () => {
    const totalFlashS = EVOLUTION_FLASH_BLINK_COUNT * EVOLUTION_FLASH_BLINK_DURATION_S;
    const done = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + totalFlashS + 0.01);
    expect(tickEvolution(done, 5)).toEqual(done);
  });
});

describe('evolution: shake offset', () => {
  it('is zero outside the shake phase', () => {
    const flashState = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + 0.01);
    expect(shakeOffset(flashState, () => 1)).toEqual({ dx: 0, dy: 0 });
  });

  it('is bounded by the configured jitter px during shake', () => {
    const state = startEvolution('teen');
    const max = shakeOffset(state, () => 1);
    const min = shakeOffset(state, () => 0);
    expect(max).toEqual({ dx: EVOLUTION_SHAKE_JITTER_PX, dy: EVOLUTION_SHAKE_JITTER_PX });
    expect(min).toEqual({ dx: -EVOLUTION_SHAKE_JITTER_PX, dy: -EVOLUTION_SHAKE_JITTER_PX });
  });
});

describe('evolution: flash blinks', () => {
  it('is visible for the first half of each blink cycle, hidden for the second', () => {
    const flashStart = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + 0.001);
    const onPhase = tickEvolution(flashStart, EVOLUTION_FLASH_BLINK_DURATION_S * 0.1);
    expect(isFlashVisible(onPhase)).toBe(true);
    const offPhase = tickEvolution(flashStart, EVOLUTION_FLASH_BLINK_DURATION_S * 0.6);
    expect(isFlashVisible(offPhase)).toBe(false);
  });

  it('blinks three distinct times before finishing', () => {
    let state = advance(startEvolution('teen'), EVOLUTION_SHAKE_DURATION_S + 0.001);
    const seenVisible: boolean[] = [];
    for (let i = 0; i < EVOLUTION_FLASH_BLINK_COUNT * 2; i++) {
      state = advance(state, EVOLUTION_FLASH_BLINK_DURATION_S / 2 - 0.001);
      seenVisible.push(isFlashVisible(state));
    }
    // Alternates visible/hidden across the three blinks.
    expect(seenVisible).toEqual([true, false, true, false, true, false]);
  });

  it('is never visible outside the flash phase', () => {
    expect(isFlashVisible(startEvolution('teen'))).toBe(false);
  });
});
