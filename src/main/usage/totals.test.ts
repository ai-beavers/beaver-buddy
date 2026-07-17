import { describe, expect, it } from 'vitest';
import { aggregate, todayTotalTokens, type UsageEntry } from './totals';

function entry(overrides: Partial<UsageEntry>): UsageEntry {
  return {
    timestampMs: Date.now(),
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    ...overrides,
  };
}

describe('aggregate', () => {
  it('sums input/output/cache splits into totalTokens', () => {
    const { lifetime } = aggregate([
      entry({ inputTokens: 10, outputTokens: 20, cacheCreationTokens: 5, cacheReadTokens: 2 }),
      entry({ inputTokens: 1, outputTokens: 1 }),
    ]);

    expect(lifetime).toEqual({
      inputTokens: 11,
      outputTokens: 21,
      cacheCreationTokens: 5,
      cacheReadTokens: 2,
      totalTokens: 39,
    });
  });

  it('buckets by local calendar date, not UTC', () => {
    const day1 = new Date(2026, 0, 5, 23, 59, 0).getTime(); // Jan 5, local 23:59
    const day2 = new Date(2026, 0, 6, 0, 0, 1).getTime(); // Jan 6, local 00:00:01

    const { daily } = aggregate([entry({ timestampMs: day1, inputTokens: 3 }), entry({ timestampMs: day2, inputTokens: 4 })]);

    expect(daily.size).toBe(2);
    expect(daily.get('2026-01-05')?.inputTokens).toBe(3);
    expect(daily.get('2026-01-06')?.inputTokens).toBe(4);
  });

  it('same-day entries accumulate under one bucket', () => {
    const morning = new Date(2026, 2, 1, 9, 0, 0).getTime();
    const evening = new Date(2026, 2, 1, 21, 0, 0).getTime();

    const { daily, lifetime } = aggregate([
      entry({ timestampMs: morning, inputTokens: 10 }),
      entry({ timestampMs: evening, inputTokens: 5 }),
    ]);

    expect(daily.size).toBe(1);
    expect(daily.get('2026-03-01')?.inputTokens).toBe(15);
    expect(lifetime.inputTokens).toBe(15);
  });

  it('empty input produces zero totals', () => {
    const { daily, lifetime } = aggregate([]);
    expect(daily.size).toBe(0);
    expect(lifetime.totalTokens).toBe(0);
  });
});

describe('todayTotalTokens', () => {
  it('returns today\'s bucket totalTokens', () => {
    const morning = new Date(2026, 2, 1, 9, 0, 0).getTime();
    const totals = aggregate([
      entry({ timestampMs: morning, inputTokens: 10, outputTokens: 5 }),
      entry({ timestampMs: new Date(2026, 1, 28, 12, 0, 0).getTime(), inputTokens: 100 }),
    ]);
    expect(todayTotalTokens(totals, morning)).toBe(15);
  });

  it('returns 0 when today has no entries', () => {
    const totals = aggregate([entry({ timestampMs: new Date(2026, 0, 1).getTime(), inputTokens: 50 })]);
    expect(todayTotalTokens(totals, new Date(2026, 2, 1).getTime())).toBe(0);
  });
});
