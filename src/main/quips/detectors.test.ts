import { describe, expect, it } from 'vitest';
import { createDetectorState, detectEvents, type DetectorState } from './detectors';
import { CODING_SESSION_LENGTH_MIN, IDLE_LENGTH_MIN, TOKEN_SPIKE_RATE_PER_MIN } from './quip-config';

const MIN_MS = 60_000;

function feed(state: DetectorState, snapshots: readonly { nowMs: number; lifetimeTokens: number }[]) {
  let s = state;
  const allEvents: string[][] = [];
  for (const snap of snapshots) {
    const result = detectEvents(s, snap);
    s = result.state;
    allEvents.push([...result.events]);
  }
  return { state: s, allEvents };
}

describe('detectors: first snapshot', () => {
  it('emits no events on the very first snapshot (baseline only)', () => {
    const result = detectEvents(createDetectorState(), { nowMs: 0, lifetimeTokens: 500 });
    expect(result.events).toEqual([]);
  });
});

describe('detectors: token-spike threshold edge', () => {
  it('does not fire at exactly the threshold rate', () => {
    const tokensAtThreshold = TOKEN_SPIKE_RATE_PER_MIN; // exactly threshold over 1 minute
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: MIN_MS, lifetimeTokens: tokensAtThreshold },
    ]);
    expect(allEvents[1]).not.toContain('tokenSpike');
  });

  it('fires just above the threshold rate', () => {
    const tokensAboveThreshold = TOKEN_SPIKE_RATE_PER_MIN + 1;
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: MIN_MS, lifetimeTokens: tokensAboveThreshold },
    ]);
    expect(allEvents[1]).toContain('tokenSpike');
  });
});

describe('detectors: sustained coding-session boundary', () => {
  it('does not fire before CODING_SESSION_LENGTH_MIN of continuous nonzero deltas', () => {
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: 1 * MIN_MS, lifetimeTokens: 10 },
      { nowMs: (CODING_SESSION_LENGTH_MIN - 1) * MIN_MS, lifetimeTokens: 20 },
    ]);
    expect(allEvents.flat()).not.toContain('codingSession');
  });

  it('fires once the streak reaches CODING_SESSION_LENGTH_MIN, and only once per streak', () => {
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: 1 * MIN_MS, lifetimeTokens: 10 },
      { nowMs: CODING_SESSION_LENGTH_MIN * MIN_MS, lifetimeTokens: 20 },
      { nowMs: (CODING_SESSION_LENGTH_MIN + 5) * MIN_MS, lifetimeTokens: 30 },
    ]);
    const fires = allEvents.filter((events) => events.includes('codingSession'));
    expect(fires).toHaveLength(1);
  });
});

describe('detectors: idle fires once per stretch', () => {
  it('fires once after IDLE_LENGTH_MIN of zero deltas, then stays silent for the rest of the stretch', () => {
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 100 },
      { nowMs: 1 * MIN_MS, lifetimeTokens: 100 },
      { nowMs: IDLE_LENGTH_MIN * MIN_MS, lifetimeTokens: 100 },
      { nowMs: (IDLE_LENGTH_MIN + 5) * MIN_MS, lifetimeTokens: 100 },
    ]);
    const fires = allEvents.filter((events) => events.includes('idle'));
    expect(fires).toHaveLength(1);
  });

  it('fires again in a fresh idle stretch after activity resumes', () => {
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: IDLE_LENGTH_MIN * MIN_MS, lifetimeTokens: 0 }, // idle stretch 1 fires
      { nowMs: (IDLE_LENGTH_MIN + 1) * MIN_MS, lifetimeTokens: 10 }, // activity resets the streak
      { nowMs: (IDLE_LENGTH_MIN + 2) * MIN_MS, lifetimeTokens: 10 }, // first zero-delta sample re-anchors idleSinceMs here
      { nowMs: (2 * IDLE_LENGTH_MIN + 2) * MIN_MS, lifetimeTokens: 10 }, // idle stretch 2 fires
    ]);
    const fires = allEvents.filter((events) => events.includes('idle'));
    expect(fires).toHaveLength(2);
  });
});

describe('detectors: poll-gap tolerance', () => {
  it('measures the spike rate over an arbitrarily large gap rather than assuming a fixed tick', () => {
    // A huge token jump over a huge gap, at exactly the threshold rate: no spike.
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: 100 * MIN_MS, lifetimeTokens: 100 * TOKEN_SPIKE_RATE_PER_MIN },
    ]);
    expect(allEvents[1]).not.toContain('tokenSpike');
  });

  it('treats a long idle gap the same as continuous zero-delta polling for the idle threshold', () => {
    const { allEvents } = feed(createDetectorState(), [
      { nowMs: 0, lifetimeTokens: 0 },
      { nowMs: (IDLE_LENGTH_MIN + 60) * MIN_MS, lifetimeTokens: 0 }, // one big gap, still zero delta
    ]);
    expect(allEvents[1]).toContain('idle');
  });
});
