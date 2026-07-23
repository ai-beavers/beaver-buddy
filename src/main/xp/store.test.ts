import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState } from './store';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-xp-store-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('xp store v2', () => {
  it('missing file -> fresh v2 state, no crash', () => {
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('roundtrips a saved v2 state', async () => {
    const state = { xp: 1234.5, lastSeenByModel: { 'claude-opus': 5000 }, lastMrrAwardDate: '2026-07-13', schemaVersion: 2 as const };
    await saveState(stateDir, state);
    expect(loadState(stateDir)).toEqual(state);
  });

  it('corrupt file -> fresh v2 state, no crash', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), '{not valid json');
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('schema-invalid v2 (negative xp) -> fresh v2 state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: -5, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 }));
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('schema-invalid v2 (negative cursor) -> fresh v2 state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'xp-state.json'),
      JSON.stringify({ xp: 5, lastSeenByModel: { a: -1 }, lastMrrAwardDate: null, schemaVersion: 2 }),
    );
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('schema-invalid v2 (lastMrrAwardDate not string/null) -> fresh v2 state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'xp-state.json'),
      JSON.stringify({ xp: 5, lastSeenByModel: {}, lastMrrAwardDate: 12345, schemaVersion: 2 }),
    );
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('creates the state dir if missing', async () => {
    const nested = path.join(stateDir, 'nested', 'dir');
    await saveState(nested, { xp: 1, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
    expect(loadState(nested)).toEqual({ xp: 1, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
  });

  it('leaves no stray tmp files behind after a save (atomic tmp cleanup)', async () => {
    await saveState(stateDir, { xp: 10, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
    await saveState(stateDir, { xp: 30, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 });
    const entries = fs.readdirSync(stateDir);
    expect(entries).toEqual(['xp-state.json']);
  });
});

describe('xp store v1 migration sentinel', () => {
  it('loads an old v1 file as schemaVersion 1', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 42, lastSeenLifetimeTokens: 4200 }));
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 42, lastSeenLifetimeTokens: 4200, lastMrrAwardDate: null, schemaVersion: 1 });
  });

  it('preserves an optional lastMrrAwardDate from a v1 file', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 7, lastSeenLifetimeTokens: 700, lastMrrAwardDate: '2026-07-13' }));
    const state = loadState(stateDir);
    expect(state).toEqual({ xp: 7, lastSeenLifetimeTokens: 700, lastMrrAwardDate: '2026-07-13', schemaVersion: 1 });
  });

  it('rejects a v1 file with negative lastSeenLifetimeTokens', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 1, lastSeenLifetimeTokens: -1 }));
    const state = loadState(stateDir);
    expect(state.schemaVersion).toBe(2);
    expect(state.xp).toBe(0);
  });
});
