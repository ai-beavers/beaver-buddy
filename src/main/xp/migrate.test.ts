import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateIfNeeded } from './migrate';
import { loadState, saveState, type XpStateV2 } from './store';
import { weightForModel } from './weights';
import type { UsageTotals } from '../usage/totals';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-xp-migrate-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function totals(models: Record<string, { inputTokens: number; outputTokens: number }>): UsageTotals {
  const lifetime = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0 };
  const lifetimeByModel = new Map<string, { inputTokens: number; outputTokens: number }>();

  for (const [model, tokens] of Object.entries(models)) {
    lifetime.inputTokens += tokens.inputTokens;
    lifetime.outputTokens += tokens.outputTokens;
    lifetimeByModel.set(model, { inputTokens: tokens.inputTokens, outputTokens: tokens.outputTokens });
  }
  lifetime.totalTokens = lifetime.inputTokens + lifetime.outputTokens + lifetime.cacheCreationTokens + lifetime.cacheReadTokens;

  return { daily: new Map(), lifetime, lifetimeByModel };
}

describe('migrateIfNeeded', () => {
  it('migrates a v1 file to v2 with weighted XP and per-model cursors', async () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 0, lastSeenLifetimeTokens: 7_200_000_000 }));

    await migrateIfNeeded(
      stateDir,
      totals({
        'claude-opus-4-8': { inputTokens: 1000, outputTokens: 0 },
        'unknown': { inputTokens: 1000, outputTokens: 0 },
      }),
    );

    const state = loadState(stateDir) as XpStateV2;
    expect(state.schemaVersion).toBe(2);
    expect(state).toEqual({
      xp: 5 * weightForModel('claude-opus-4-8') + 5 * weightForModel('unknown'),
      lastSeenByModel: { 'claude-opus-4-8': 1000, unknown: 1000 },
      lastMrrAwardDate: null,
      schemaVersion: 2,
    });
  });

  it('is idempotent: a second migration leaves the state unchanged', async () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 0, lastSeenLifetimeTokens: 7_200_000_000 }));

    const t = totals({ unknown: { inputTokens: 2000, outputTokens: 0 } });
    await migrateIfNeeded(stateDir, t);
    const first = loadState(stateDir) as XpStateV2;

    await migrateIfNeeded(stateDir, t);
    const second = loadState(stateDir) as XpStateV2;

    expect(second).toEqual(first);
  });

  it('fresh install: no state file results in a clean v2 state with zero cursors', async () => {
    await migrateIfNeeded(stateDir, totals({}));
    const state = loadState(stateDir) as XpStateV2;
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('corrupt v1 file is treated as a fresh v2 state with zero cursors', async () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), '{not valid json');

    await migrateIfNeeded(stateDir, totals({
        'claude-opus-4-8': { inputTokens: 1000, outputTokens: 0 },
      }),
    );

    const state = loadState(stateDir) as XpStateV2;
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('preserves lastMrrAwardDate from the v1 state during migration', async () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'xp-state.json'),
      JSON.stringify({ xp: 100, lastSeenLifetimeTokens: 1000, lastMrrAwardDate: '2026-07-13' }),
    );

    await migrateIfNeeded(stateDir, totals({ unknown: { inputTokens: 2000, outputTokens: 0 } }));
    const state = loadState(stateDir) as XpStateV2;
    expect(state.lastMrrAwardDate).toBe('2026-07-13');
    expect(state.schemaVersion).toBe(2);
  });

  it('writes per-model cursors equal to the totals so the next ingest delta is zero', async () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 0, lastSeenLifetimeTokens: 7_200_000_000 }));

    await migrateIfNeeded(
      stateDir,
      totals({
        'claude-opus-4-8': { inputTokens: 1000, outputTokens: 500 },
        'gpt-5.6-sol': { inputTokens: 200, outputTokens: 300 },
      }),
    );

    const state = loadState(stateDir) as XpStateV2;
    expect(state.lastSeenByModel).toEqual({ 'claude-opus-4-8': 1500, 'gpt-5.6-sol': 500 });
  });

  it('leaves an already v2 state untouched', async () => {
    const initial = { xp: 99, lastSeenByModel: { a: 100 }, lastMrrAwardDate: '2026-07-14', schemaVersion: 2 as const };
    await saveState(stateDir, initial);

    await migrateIfNeeded(stateDir, totals({ b: { inputTokens: 9999, outputTokens: 0 } }));
    const state = loadState(stateDir) as XpStateV2;
    expect(state).toEqual(initial);
  });
});
