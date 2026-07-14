import { describe, expect, it } from 'vitest';
import { createSchedulerState, schedule } from './scheduler';
import { QUIP_COOLDOWN_MS } from './quip-config';
import { QUIP_POOLS } from './quips';

// Deterministic sequence rng — returns each value in order, then repeats
// the last one. Enough control to pin exact pool indices in these tests.
function sequenceRng(values: readonly number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('scheduler: cooldown window', () => {
  it('fires the first event and returns text', () => {
    const result = schedule(createSchedulerState(), 'appStart', 1_000, sequenceRng([0]));
    expect(result.text).not.toBeNull();
    expect(result.state.lastShownAtMs).toBe(1_000);
  });

  it('suppresses a second trigger inside the cooldown window', () => {
    const first = schedule(createSchedulerState(), 'appStart', 1_000, sequenceRng([0]));
    const second = schedule(first.state, 'idle', 1_000 + QUIP_COOLDOWN_MS - 1, sequenceRng([0]));
    expect(second.text).toBeNull();
    // Cooldown state is untouched by a suppressed attempt.
    expect(second.state).toBe(first.state);
  });

  it('allows a new quip once the cooldown window has fully elapsed', () => {
    const first = schedule(createSchedulerState(), 'appStart', 1_000, sequenceRng([0]));
    const second = schedule(first.state, 'idle', 1_000 + QUIP_COOLDOWN_MS, sequenceRng([0]));
    expect(second.text).not.toBeNull();
  });
});

describe('scheduler: no-immediate-repeat per pool', () => {
  it('never shows the same pool index twice in a row, even when the rng rolls it again', () => {
    // rng rolls index 0 both times; the second call must reroll away from it.
    const first = schedule(createSchedulerState(), 'idle', 0, sequenceRng([0]));
    const second = schedule(first.state, 'idle', QUIP_COOLDOWN_MS, sequenceRng([0]));
    expect(second.text).not.toBe(first.text);
  });

  it('is deterministic given the same rng sequence', () => {
    const a = schedule(createSchedulerState(), 'idle', 0, sequenceRng([0.4]));
    const b = schedule(createSchedulerState(), 'idle', 0, sequenceRng([0.4]));
    expect(a.text).toBe(b.text);
  });
});

describe('scheduler: evolution stage substitution', () => {
  it('fills the {stage} placeholder from evolvedStage', () => {
    const result = schedule(createSchedulerState(), 'evolution', 0, sequenceRng([0]), 'teen');
    expect(result.text).not.toContain('{stage}');
    expect(result.text).toContain('teen');
  });

  it('every entry in the evolution pool contains a {stage} placeholder', () => {
    for (const template of QUIP_POOLS.evolution) {
      expect(template).toContain('{stage}');
    }
  });
});

describe('scheduler: launch sequence (evolution then appStart in the same tick)', () => {
  // A launch that crosses a stage (e.g. injected XP) fires evolution and
  // then appStart from the same did-finish-load handler: the evolution quip
  // must win and the immediately-following appStart must be suppressed by
  // the cooldown — one quip on screen, never zero and never two.
  it('shows the evolution quip and suppresses the same-instant appStart', () => {
    const evolution = schedule(createSchedulerState(), 'evolution', 1_000, sequenceRng([0]), 'teen');
    expect(evolution.text).toContain('teen');

    const appStart = schedule(evolution.state, 'appStart', 1_000, sequenceRng([0]));
    expect(appStart.text).toBeNull();
  });
});
