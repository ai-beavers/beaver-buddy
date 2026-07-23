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

  onChange(callback: (totals: UsageTotals) => void | Promise<void>): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async setTotalTokens(totalTokens: number): Promise<void> {
    this.totals = totalsOf(totalTokens);
    for (const listener of this.listeners) await listener(this.totals);
  }
}

describe('XpEngine: delta accrual', () => {
  it('converts a token delta into xp at TOKENS_PER_XP', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 5);
    expect(engine.getState().xp).toBe(5);
  });

  it('accrues only the delta on subsequent ingests', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 5);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 8);
    expect(engine.getState().xp).toBe(8);
  });
});

describe('XpEngine: idempotent cursor', () => {
  it('the same lifetime total ingested twice does not double-count', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    expect(engine.getState().xp).toBe(10);
  });

  it('a total that dips below the cursor (log rotation) is ignored, not subtracted', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 10);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 3); // rotated log, smaller total
    expect(engine.getState().xp).toBe(10);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 12); // growth resumes past the old cursor
    expect(engine.getState().xp).toBe(12);
  });

  it('restart replay: a fresh engine loading persisted state does not double-count the same total', async () => {
    const engine1 = new XpEngine(stateDir);
    await engine1.ingestLifetimeTokens(TOKENS_PER_XP * 10);

    const engine2 = new XpEngine(stateDir); // simulates relaunch, reloads from disk
    await engine2.ingestLifetimeTokens(TOKENS_PER_XP * 10); // same total replayed on restart
    expect(engine2.getState().xp).toBe(10);
  });
});

describe('XpEngine: evolution', () => {
  it('fires exactly once per stage crossing, with the target stage', async () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    await engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(15)); // reach level 15, still baby
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(16)); // cross into teen

    const evolutions = updates.filter((u) => u.evolvingTo !== undefined);
    expect(evolutions).toHaveLength(1);
    expect(evolutions[0].evolvingTo).toBe('teen');
    expect(evolutions[0].stage).toBe('baby'); // pre-evolution display stage
    expect(engine.getState().stage).toBe('teen'); // internal state already updated
  });

  it('does not fire on updates that stay within the same stage', async () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 100);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 200);

    expect(updates.every((u) => u.evolvingTo === undefined)).toBe(true);
  });
});

describe('XpEngine: getLastUpdate (late-listener resend)', () => {
  it('synthesizes a non-evolving snapshot when nothing was emitted', () => {
    const engine = new XpEngine(stateDir, { xp: xpForLevel(20), lastSeenLifetimeTokens: 0, lastMrrAwardDate: null });
    expect(engine.getLastUpdate()).toEqual({ level: 20, stage: 'teen' });
  });

  it('preserves an evolution emitted before any listener attached', async () => {
    // Launch-crossing scenario: accrual (with a stage crossing) happens
    // before the renderer page is ready — the resend must still carry the
    // evolvingTo, not a stale reconstruction.
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(17));
    expect(engine.getLastUpdate()).toEqual({ level: 17, stage: 'baby', evolvingTo: 'teen' });
  });

  it('tracks the latest emission', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(17)); // crossing
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * xpForLevel(18)); // plain accrual
    expect(engine.getLastUpdate()).toEqual({ level: 18, stage: 'teen', evolvingTo: undefined });
  });
});

describe('XpEngine: attachTracker', () => {
  it('ingests the tracker current totals once, then subsequent onChange totals', async () => {
    const tracker = new FakeTracker();
    tracker.setTotalTokens(TOKENS_PER_XP * 4); // already-scanned before attach

    const engine = new XpEngine(stateDir);
    await engine.attachTracker(tracker);
    expect(engine.getState().xp).toBe(4);

    await tracker.setTotalTokens(TOKENS_PER_XP * 9);
    expect(engine.getState().xp).toBe(9);
  });
});

describe('XpEngine: --inject-xp path', () => {
  it('adds xp directly through the same persist/level/evolution logic, without moving the token cursor', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 3);

    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));
    await engine.injectXp(xpForLevel(16) - 3); // push straight into teen

    expect(engine.getState().level).toBe(16);
    expect(engine.getState().stage).toBe('teen');
    expect(updates.some((u) => u.evolvingTo === 'teen')).toBe(true);

    // Token cursor unaffected by injection: replaying the same real total
    // that was already ingested does not double count.
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 3);
    expect(engine.getState().level).toBe(16);
  });

  it('persists injected xp across a simulated restart', async () => {
    const engine1 = new XpEngine(stateDir);
    await engine1.injectXp(xpForLevel(15));

    const engine2 = new XpEngine(stateDir);
    expect(engine2.getState().level).toBe(15);
    expect(engine2.getState().stage).toBe('baby');
  });

  it('ignores non-positive amounts', async () => {
    const engine = new XpEngine(stateDir);
    await engine.injectXp(0);
    await engine.injectXp(-5);
    expect(engine.getState().xp).toBe(0);
  });
});

describe('XpEngine: growth mode gating (setMode/ingestLifetimeTokens/awardMrr)', () => {
  it('defaults to tokens mode: token ingestion awards XP as before', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 5);
    expect(engine.getState().xp).toBe(5);
  });

  it('mrr mode: token ingestion advances the cursor silently, no XP awarded', async () => {
    const engine = new XpEngine(stateDir);
    engine.setMode('mrr');
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 100);
    expect(engine.getState().xp).toBe(0);
  });

  it('no-double-count switching tokens -> mrr -> tokens: the token history consumed while in mrr mode is never retroactively awarded', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 3); // tokens mode: 3 xp
    engine.setMode('mrr');
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 10); // mrr mode: cursor advances, no award
    engine.setMode('tokens');
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 10); // same total re-ingested: cursor already there, delta 0
    expect(engine.getState().xp).toBe(3);
  });

  it('no-double-count switching mrr -> tokens -> mrr: lastMrrAwardDate persists through the tokens interlude', async () => {
    const engine = new XpEngine(stateDir);
    engine.setMode('mrr');
    await engine.awardMrr(500, '2026-07-13');
    engine.setMode('tokens');
    await engine.ingestLifetimeTokens(TOKENS_PER_XP * 2); // unrelated token accrual while in tokens mode
    engine.setMode('mrr');
    expect(engine.getLastMrrAwardDate()).toBe('2026-07-13'); // survived the round trip
    expect(engine.getState().xp).toBe(502);
  });

  it('awardMrr records the date even when the awarded xp rounds to 0', async () => {
    const engine = new XpEngine(stateDir);
    await engine.awardMrr(0, '2026-07-13');
    expect(engine.getLastMrrAwardDate()).toBe('2026-07-13');
    expect(engine.getState().xp).toBe(0);
  });

  it('awardMrr fires an evolution update on a stage crossing, same as other award paths', async () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));
    await engine.awardMrr(xpForLevel(16), '2026-07-13');
    expect(updates.some((u) => u.evolvingTo === 'teen')).toBe(true);
  });
});
