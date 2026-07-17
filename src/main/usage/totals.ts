// Pure aggregation: no filesystem, no Electron. Both parsers map their
// format-specific fields into this one entry shape so totals math is
// written and tested exactly once.

export interface UsageEntry {
  readonly timestampMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
}

export interface Totals {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly totalTokens: number;
}

export interface UsageTotals {
  readonly daily: ReadonlyMap<string, Totals>;
  readonly lifetime: Totals;
}

function emptyTotals(): Totals {
  return { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0 };
}

function addEntry(totals: Totals, entry: UsageEntry): Totals {
  const inputTokens = totals.inputTokens + entry.inputTokens;
  const outputTokens = totals.outputTokens + entry.outputTokens;
  const cacheCreationTokens = totals.cacheCreationTokens + entry.cacheCreationTokens;
  const cacheReadTokens = totals.cacheReadTokens + entry.cacheReadTokens;
  return {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
  };
}

// Local calendar date, not UTC — matches ccusage's default daily bucketing,
// which is the ±5% cross-check tool that defines the acceptance metric.
export function localDateKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Today's cumulative token total from an already-aggregated UsageTotals —
// the spend-tier quip detectors key off this rather than a burn rate.
export function todayTotalTokens(totals: UsageTotals, nowMs: number): number {
  return totals.daily.get(localDateKey(nowMs))?.totalTokens ?? 0;
}

export function aggregate(entries: readonly UsageEntry[]): UsageTotals {
  const daily = new Map<string, Totals>();
  let lifetime = emptyTotals();

  for (const entry of entries) {
    const key = localDateKey(entry.timestampMs);
    daily.set(key, addEntry(daily.get(key) ?? emptyTotals(), entry));
    lifetime = addEntry(lifetime, entry);
  }

  return { daily, lifetime };
}
