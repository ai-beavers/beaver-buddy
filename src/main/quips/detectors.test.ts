import { describe, expect, it } from 'vitest';
import { classifySpendTier, createDetectorState, detectEvents, type DetectorState } from './detectors';
import { CODING_SESSION_LENGTH_MIN, IDLE_LENGTH_MIN, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY, SPEND_TIER_OK_MIN_TOKENS_PER_DAY } from './quip-config';

const MIN_MS = 60_000;

function snap(nowMs: number, lifetimeTokens: number, todayTokens: number) {
  return { nowMs, lifetimeTokens, todayTokens };
}

function feed(state: DetectorState, snapshots: readonly { nowMs: number; lifetimeTokens: number; todayTokens: number }[]) {
  let s = state;
  const allEvents: string[][] = [];
  for (const snapshot of snapshots) {
    const result = detectEvents(s, snapshot);
    s = result.state;
    allEvents.push([...result.events]);
  }
  return { state: s, allEvents };
}

describe('classifySpendTier', () => {
  it('returns null below 1 token', () => {
    expect(classifySpendTier(0)).toBeNull();
  });

  it('returns spendWeak just below the ok floor', () => {
    expect(classifySpendTier(1)).toBe('spendWeak');
    expect(classifySpendTier(SPEND_TIER_OK_MIN_TOKENS_PER_DAY - 1)).toBe('spendWeak');
  });

  it('returns spendOk at the ok floor and just below crazy', () => {
    expect(classifySpendTier(SPEND_TIER_OK_MIN_TOKENS_PER_DAY)).toBe('spendOk');
    expect(classifySpendTier(SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY - 1)).toBe('spendOk');
  });

  it('returns spendCrazy at and above the crazy floor', () => {
    expect(classifySpendTier(SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY)).toBe('spendCrazy');
    expect(classifySpendTier(SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY + 1)).toBe('spendCrazy');
  });
});

describe('detectors: first snapshot', () => {
  it('announces the current spend tier on the first snapshot (mid-day launch)', () => {
    const result = detectEvents(createDetectorState(), snap(0, 500, 500));
    expect(result.events).toEqual(['spendWeak']);
  });

  it('emits no spend tier when today has zero tokens', () => {
    const result = detectEvents(createDetectorState(), snap(0, 0, 0));
    expect(result.events).toEqual([]);
  });
});

describe('detectors: spend-tier crossings', () => {
  it('fires spendWeak at 1 token, then does not re-fire while still weak', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 0, 0),
      snap(MIN_MS, 1, 1),
      snap(2 * MIN_MS, 2, 2),
    ]);
    expect(allEvents[1]).toContain('spendWeak');
    expect(allEvents[2]).not.toContain('spendWeak');
  });

  it('fires spendOk when today crosses the ok floor', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 100, 100),
      snap(MIN_MS, SPEND_TIER_OK_MIN_TOKENS_PER_DAY, SPEND_TIER_OK_MIN_TOKENS_PER_DAY),
    ]);
    expect(allEvents[0]).toEqual(['spendWeak']);
    expect(allEvents[1]).toContain('spendOk');
  });

  it('fires spendCrazy when today crosses the crazy floor', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, SPEND_TIER_OK_MIN_TOKENS_PER_DAY, SPEND_TIER_OK_MIN_TOKENS_PER_DAY),
      snap(MIN_MS, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY),
    ]);
    expect(allEvents[0]).toEqual(['spendOk']);
    expect(allEvents[1]).toContain('spendCrazy');
  });

  it('does not re-fire on a later tick still in the same tier', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, SPEND_TIER_OK_MIN_TOKENS_PER_DAY, SPEND_TIER_OK_MIN_TOKENS_PER_DAY),
      snap(MIN_MS, SPEND_TIER_OK_MIN_TOKENS_PER_DAY + 1000, SPEND_TIER_OK_MIN_TOKENS_PER_DAY + 1000),
      snap(2 * MIN_MS, SPEND_TIER_OK_MIN_TOKENS_PER_DAY + 2000, SPEND_TIER_OK_MIN_TOKENS_PER_DAY + 2000),
    ]);
    const okFires = allEvents.filter((events) => events.includes('spendOk'));
    expect(okFires).toHaveLength(1);
  });

  it('re-fires from spendWeak after a local-midnight rollover', () => {
    // Day 1 evening → day 2 morning: date key changes, climb starts over.
    const day1 = new Date(2026, 2, 1, 23, 0, 0).getTime();
    const day2 = new Date(2026, 2, 2, 0, 1, 0).getTime();
    const { allEvents } = feed(createDetectorState(), [
      snap(day1, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY),
      snap(day2, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY + 50, 50),
    ]);
    expect(allEvents[0]).toEqual(['spendCrazy']);
    expect(allEvents[1]).toContain('spendWeak');
  });
});

describe('detectors: sustained coding-session boundary', () => {
  it('does not fire before CODING_SESSION_LENGTH_MIN of continuous nonzero deltas', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 0, 0),
      snap(1 * MIN_MS, 10, 10),
      snap((CODING_SESSION_LENGTH_MIN - 1) * MIN_MS, 20, 20),
    ]);
    expect(allEvents.flat()).not.toContain('codingSession');
  });

  it('fires once the streak reaches CODING_SESSION_LENGTH_MIN, and only once per streak', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 0, 0),
      snap(1 * MIN_MS, 10, 10),
      snap(CODING_SESSION_LENGTH_MIN * MIN_MS, 20, 20),
      snap((CODING_SESSION_LENGTH_MIN + 5) * MIN_MS, 30, 30),
    ]);
    const fires = allEvents.filter((events) => events.includes('codingSession'));
    expect(fires).toHaveLength(1);
  });
});

describe('detectors: idle fires once per stretch', () => {
  it('fires once after IDLE_LENGTH_MIN of zero deltas, then stays silent for the rest of the stretch', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 100, 100),
      snap(1 * MIN_MS, 100, 100),
      snap(IDLE_LENGTH_MIN * MIN_MS, 100, 100),
      snap((IDLE_LENGTH_MIN + 5) * MIN_MS, 100, 100),
    ]);
    const fires = allEvents.filter((events) => events.includes('idle'));
    expect(fires).toHaveLength(1);
  });

  it('fires again in a fresh idle stretch after activity resumes', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 0, 0),
      snap(IDLE_LENGTH_MIN * MIN_MS, 0, 0), // idle stretch 1 fires
      snap((IDLE_LENGTH_MIN + 1) * MIN_MS, 10, 10), // activity resets the streak
      snap((IDLE_LENGTH_MIN + 2) * MIN_MS, 10, 10), // first zero-delta sample re-anchors idleSinceMs here
      snap((2 * IDLE_LENGTH_MIN + 2) * MIN_MS, 10, 10), // idle stretch 2 fires
    ]);
    const fires = allEvents.filter((events) => events.includes('idle'));
    expect(fires).toHaveLength(2);
  });
});

describe('detectors: poll-gap tolerance', () => {
  it('treats a long idle gap the same as continuous zero-delta polling for the idle threshold', () => {
    const { allEvents } = feed(createDetectorState(), [
      snap(0, 0, 0),
      snap((IDLE_LENGTH_MIN + 60) * MIN_MS, 0, 0), // one big gap, still zero delta
    ]);
    expect(allEvents[1]).toContain('idle');
  });
});
