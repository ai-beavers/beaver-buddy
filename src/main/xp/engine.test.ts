import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { XpEngine, type PetUpdate, type TrackerLike } from './engine';
import { weightForModel } from './weights';
import { xpForLevel } from './curve';
import type { UsageTotals } from '../usage/totals';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-xp-engine-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function modelTotals(model: string, inputTokens: number, outputTokens: number = 0): UsageTotals {
  const totalTokens = inputTokens + outputTokens;
  return {
    daily: new Map(),
    lifetime: { inputTokens, outputTokens, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens },
    lifetimeByModel: new Map([[model, { inputTokens, outputTokens }]]),
  };
}

// Tokens needed for exactly `xp` XP with a given model (weight applied).
// For 'unknown' (weight 1.0), tokens = xp * 200.
function tokensForXp(xp: number, model: string = 'unknown'): number {
  return xp * (1000 / (5 * weightForModel(model)));
}

// Minimal fake matching UsageTracker's onChange/getTotals surface (TrackerLike)
// — no real Electron process or usage-log files needed.
class FakeTracker implements TrackerLike {
  private totals: UsageTotals = modelTotals('unknown', 0);
  private listeners = new Set<(totals: UsageTotals) => void | Promise<void>>();

  getTotals(): UsageTotals {
    return this.totals;
  }

  onChange(callback: (totals: UsageTotals) => void | Promise<void>): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async setModelTotals(model: string, inputTokens: number, outputTokens: number = 0): Promise<void> {
    this.totals = modelTotals(model, inputTokens, outputTokens);
    for (const listener of this.listeners) await listener(this.totals);
  }
}

describe('XpEngine: per-model delta accrual', () => {
  it('converts a token delta into xp at XP_PER_1K_TOKENS for unknown weight', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel);
    expect(engine.getState().xp).toBe(10);
  });

  it('accrues only the delta on subsequent ingests', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 1000).lifetimeByModel);
    await engine.ingestModelTotals(modelTotals('unknown', 2500).lifetimeByModel);
    expect(engine.getState().xp).toBe(12.5);
  });
});

describe('XpEngine: weighted award', () => {
  it('applies model weight to the token-to-xp conversion', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('claude-opus-4-8', 1000).lifetimeByModel);
    // 1000 tokens / 1000 * 5 XP * 1.55 weight = 7.75 XP
    expect(engine.getState().xp).toBe(7.75);
  });

  it('awards more for a high-weight model than unknown for the same tokens', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('claude-opus-4-8', 1000).lifetimeByModel);
    await engine.ingestModelTotals(modelTotals('unknown', 1000).lifetimeByModel);
    expect(engine.getState().xp).toBe(7.75 + 5);
  });
});

describe('XpEngine: idempotent per-model cursor', () => {
  it('the same per-model totals ingested twice do not double-count', async () => {
    const engine = new XpEngine(stateDir);
    const totals = modelTotals('unknown', 2000);
    await engine.ingestModelTotals(totals.lifetimeByModel);
    await engine.ingestModelTotals(totals.lifetimeByModel);
    expect(engine.getState().xp).toBe(10);
  });

  it('a total that dips below the cursor (log rotation) is ignored, not subtracted', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel);
    await engine.ingestModelTotals(modelTotals('unknown', 500).lifetimeByModel); // rotated log, smaller total
    expect(engine.getState().xp).toBe(10);
    await engine.ingestModelTotals(modelTotals('unknown', 2500).lifetimeByModel); // growth resumes past the old cursor
    expect(engine.getState().xp).toBe(12.5);
  });

  it('restart replay: a fresh engine loading persisted state does not double-count the same total', async () => {
    const engine1 = new XpEngine(stateDir);
    await engine1.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel);

    const engine2 = new XpEngine(stateDir); // simulates relaunch, reloads from disk
    await engine2.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel); // same total replayed on restart
    expect(engine2.getState().xp).toBe(10);
  });
});

describe('XpEngine: evolution', () => {
  it('fires exactly once per stage crossing, with the target stage', async () => {
    const engine = new XpEngine(stateDir);
    await engine.injectXp(xpForLevel(16)); // reach level 16 silently, no listener yet
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    // Delta just enough to cross teen -> older-teen at level 17.
    const deltaXp = xpForLevel(17) - xpForLevel(16);
    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(deltaXp)).lifetimeByModel);

    const evolutions = updates.filter((u) => u.evolvingTo !== undefined);
    expect(evolutions).toHaveLength(1);
    expect(evolutions[0].evolvingTo).toBe('older-teen');
    expect(evolutions[0].stage).toBe('teen'); // pre-evolution display stage
    expect(engine.getState().stage).toBe('older-teen'); // internal state already updated
  });

  it('does not fire on updates that stay within the same stage', async () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(100)).lifetimeByModel);
    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(200)).lifetimeByModel);

    expect(updates.every((u) => u.evolvingTo === undefined)).toBe(true);
  });

  it('crosses all five stage boundaries', async () => {
    const engine = new XpEngine(stateDir);
    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));

    for (const level of [5, 9, 17, 25]) {
      await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(xpForLevel(level))).lifetimeByModel);
    }

    const evolutions = updates.filter((u) => u.evolvingTo !== undefined);
    expect(evolutions.map((u) => u.evolvingTo)).toEqual(['young-baby', 'teen', 'older-teen', 'adult']);
  });
});

describe('XpEngine: getLastUpdate (late-listener resend)', () => {
  it('synthesizes a non-evolving snapshot when nothing was emitted', () => {
    const engine = new XpEngine(stateDir, { xp: xpForLevel(20), lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
    expect(engine.getLastUpdate()).toEqual({ level: 20, stage: 'older-teen' });
  });

  it('preserves an evolution emitted before any listener attached', async () => {
    // Launch-crossing scenario: accrual (with a stage crossing) happens
    // before the renderer page is ready — the resend must still carry the
    // evolvingTo, not a stale reconstruction.
    const engine = new XpEngine(stateDir);
    await engine.injectXp(xpForLevel(16)); // start at level 16 (teen) so only one boundary is crossed
    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(xpForLevel(17) - xpForLevel(16))).lifetimeByModel);
    expect(engine.getLastUpdate()).toEqual({ level: 17, stage: 'teen', evolvingTo: 'older-teen' });
  });

  it('tracks the latest emission', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(xpForLevel(17))).lifetimeByModel); // crossing
    await engine.ingestModelTotals(modelTotals('unknown', tokensForXp(xpForLevel(18))).lifetimeByModel); // plain accrual
    expect(engine.getLastUpdate()).toEqual({ level: 18, stage: 'older-teen', evolvingTo: undefined });
  });
});

describe('XpEngine: attachTracker', () => {
  it('ingests the tracker current totals once, then subsequent onChange totals', async () => {
    const tracker = new FakeTracker();
    await tracker.setModelTotals('unknown', 800); // already-scanned before attach

    const engine = new XpEngine(stateDir);
    await engine.attachTracker(tracker);
    expect(engine.getState().xp).toBe(4);

    await tracker.setModelTotals('unknown', 1800);
    expect(engine.getState().xp).toBe(9);
  });
});

describe('XpEngine: --inject-xp path', () => {
  it('adds xp directly through the same persist/level/evolution logic, without moving the per-model cursor', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 600).lifetimeByModel);

    const updates: PetUpdate[] = [];
    engine.onUpdate((u) => updates.push(u));
    await engine.injectXp(xpForLevel(16) - 3); // push straight into teen

    expect(engine.getState().level).toBe(16);
    expect(engine.getState().stage).toBe('teen');
    expect(updates.some((u) => u.evolvingTo === 'teen')).toBe(true);

    // Token cursor unaffected by injection: replaying the same real total
    // that was already ingested does not double count.
    await engine.ingestModelTotals(modelTotals('unknown', 600).lifetimeByModel);
    expect(engine.getState().level).toBe(16);
  });

  it('persists injected xp across a simulated restart', async () => {
    const engine1 = new XpEngine(stateDir);
    await engine1.injectXp(xpForLevel(15));

    const engine2 = new XpEngine(stateDir);
    expect(engine2.getState().level).toBe(15);
    expect(engine2.getState().stage).toBe('teen');
  });

  it('ignores non-positive amounts', async () => {
    const engine = new XpEngine(stateDir);
    await engine.injectXp(0);
    await engine.injectXp(-5);
    expect(engine.getState().xp).toBe(0);
  });
});

describe('XpEngine: growth mode gating (setMode/ingestModelTotals/awardMrr)', () => {
  it('defaults to tokens mode: token ingestion awards XP as before', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 1000).lifetimeByModel);
    expect(engine.getState().xp).toBe(5);
  });

  it('mrr mode: token ingestion advances the per-model cursor silently, no XP awarded', async () => {
    const engine = new XpEngine(stateDir);
    engine.setMode('mrr');
    await engine.ingestModelTotals(modelTotals('unknown', 20_000).lifetimeByModel);
    expect(engine.getState().xp).toBe(0);
  });

  it('no-double-count switching tokens -> mrr -> tokens: the token history consumed while in mrr mode is never retroactively awarded', async () => {
    const engine = new XpEngine(stateDir);
    await engine.ingestModelTotals(modelTotals('unknown', 600).lifetimeByModel); // tokens mode: 3 xp
    engine.setMode('mrr');
    await engine.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel); // mrr mode: cursor advances, no award
    engine.setMode('tokens');
    await engine.ingestModelTotals(modelTotals('unknown', 2000).lifetimeByModel); // same total re-ingested: cursor already there, delta 0
    expect(engine.getState().xp).toBe(3);
  });

  it('no-double-count switching mrr -> tokens -> mrr: lastMrrAwardDate persists through the tokens interlude', async () => {
    const engine = new XpEngine(stateDir);
    engine.setMode('mrr');
    await engine.awardMrr(500, '2026-07-13');
    engine.setMode('tokens');
    await engine.ingestModelTotals(modelTotals('unknown', 400).lifetimeByModel); // unrelated token accrual while in tokens mode
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
    await engine.awardMrr(xpForLevel(17), '2026-07-13');
    expect(updates.some((u) => u.evolvingTo === 'older-teen')).toBe(true);
  });
});
