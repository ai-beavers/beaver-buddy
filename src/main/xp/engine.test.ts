import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { XpEngine, type PetUpdate, type TrackerLike } from './engine';
import { TOKENS_PER_XP, xpForLevel } from './curve';
import type { UsageTotals } from '../usage/totals';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-xp-engine-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function totalsOf(totalTokens: number): UsageTotals {
  return { daily: new Map(), lifetime: { inputTokens: totalTokens, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens } };
}

// Minimal fake matching UsageTracker's onChange/getTotals surface (TrackerLike)
// — no real Electron process or usage-log files needed.
class FakeTracker implements TrackerLike {
  private totals: UsageTotals = totalsOf(0);
  private listeners = new Set<(totals: UsageTotals) => void>();

  getTotals(): UsageTotals {
    return this.totals;
  }

  onChange(callback: (totals: UsageTotals) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  setTotalTokens(totalTokens: number): void {
    this.totals = totalsOf(totalTokens);
    for (const listener of this.listeners) listener(this.totals);
  }
}

describe('XpEngine: delta accrual', () => {
  it('converts a token delta into xp at TOKENS_PER_XP', () => {
    const engine = new XpEngine(stateDir);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 5);
    expect(engine.getState().xp).toBe(5);
  });

  it('accrues only the delta on subsequent ingests', () => {
    const engine = new XpEngine(stateDir);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 5);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 8);
    expect(engine.getState().xp).toBe(8);
  });
});

describe('XpEngine: idempotent cursor', () => {
  it('the same lifetime total ingested twice does not double-count', () => {
    const engine = new XpEngine(stateDir);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    expect(engine.getState().xp).toBe(10);
  });

  it('a total that dips below the cursor (log rotation) is ignored, not subtracted', () => {
    const engine = new XpEngine(stateDir);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 3); // rotated log, smaller total
    expect(engine.getState().xp).toBe(10);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 12); // growth resumes past the old cursor
    expect(engine.getState().xp).toBe(12);
  });

  it('restart replay: a fresh engine loading persisted state does not double-count the same total', () => {
    const engine1 = new XpEngine(stateDir);
    engine1.ingestLifetimeTokens(TOKENS_PER_XP * 10);

    const engine2 = new XpEngine(stateDir); // simulates relaunch, reloads from disk
    engine2.ingestLifetimeTokens(TOKENS_PER_XP * 10); // same total replayed on restart
    expect(engine2.getState().xp).toBe(10);
  });
});

describe('XpEngine: evolution', () => {
  it('fires exactly once per stage crossing, with the target stage', () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(15)); // reach level 15, still baby
    engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(16)); // cross into teen

    const evolutions = updates.filter((u) => u.evolvingTo !== undefined);
    expect(evolutions).toHaveLength(1);
    expect(evolutions[0].evolvingTo).toBe('teen');
    expect(evolutions[0].stage).toBe('baby'); // pre-evolution display stage
    expect(engine.getState().stage).toBe('teen'); // internal state already updated
  });

  it('does not fire on updates that stay within the same stage', () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    engine.ingestLifetimeTokens(TOKENS_PER_XP * 100);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 200);

    expect(updates.every((u) => u.evolvingTo === undefined)).toBe(true);
  });
});

describe('XpEngine: attachTracker', () => {
  it('ingests the tracker current totals once, then subsequent onChange totals', () => {
    const tracker = new FakeTracker();
    tracker.setTotalTokens(TOKENS_PER_XP * 4); // already-scanned before attach

    const engine = new XpEngine(stateDir);
    engine.attachTracker(tracker);
    expect(engine.getState().xp).toBe(4);

    tracker.setTotalTokens(TOKENS_PER_XP * 9);
    expect(engine.getState().xp).toBe(9);
  });
});

describe('XpEngine: --inject-xp path', () => {
  it('adds xp directly through the same persist/level/evolution logic, without moving the token cursor', () => {
    const engine = new XpEngine(stateDir);
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 3);

    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));
    engine.injectXp(xpForLevel(16) - 3); // push straight into teen

    expect(engine.getState().level).toBe(16);
    expect(engine.getState().stage).toBe('teen');
    expect(updates.some((u) => u.evolvingTo === 'teen')).toBe(true);

    // Token cursor unaffected by injection: replaying the same real total
    // that was already ingested does not double count.
    engine.ingestLifetimeTokens(TOKENS_PER_XP * 3);
    expect(engine.getState().level).toBe(16);
  });

  it('persists injected xp across a simulated restart', () => {
    const engine1 = new XpEngine(stateDir);
    engine1.injectXp(xpForLevel(15));

    const engine2 = new XpEngine(stateDir);
    expect(engine2.getState().level).toBe(15);
    expect(engine2.getState().stage).toBe('baby');
  });

  it('ignores non-positive amounts', () => {
    const engine = new XpEngine(stateDir);
    engine.injectXp(0);
    engine.injectXp(-5);
    expect(engine.getState().xp).toBe(0);
  });
});
