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

describe('xp store', () => {
  it('missing file -> fresh state, no crash', () => {
    expect(loadState(stateDir)).toEqual({ xp: 0, lastSeenLifetimeTokens: 0, lastMrrAwardDate: null });
  });

  it('roundtrips a saved state', () => {
    const state = { xp: 1234.5, lastSeenLifetimeTokens: 987654, lastMrrAwardDate: '2026-07-13' };
    saveState(stateDir, state);
    expect(loadState(stateDir)).toEqual(state);
  });

  it('corrupt file -> fresh state, no crash', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), '{not valid json');
    expect(loadState(stateDir)).toEqual({ xp: 0, lastSeenLifetimeTokens: 0, lastMrrAwardDate: null });
  });

  it('schema-invalid file (negative xp) -> fresh state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: -5, lastSeenLifetimeTokens: 0 }));
    expect(loadState(stateDir)).toEqual({ xp: 0, lastSeenLifetimeTokens: 0, lastMrrAwardDate: null });
  });

  it('schema-invalid file (lastMrrAwardDate not a string/null) -> fresh state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'xp-state.json'),
      JSON.stringify({ xp: 5, lastSeenLifetimeTokens: 0, lastMrrAwardDate: 12345 }),
    );
    expect(loadState(stateDir)).toEqual({ xp: 0, lastSeenLifetimeTokens: 0, lastMrrAwardDate: null });
  });

  it('creates the state dir if missing', () => {
    const nested = path.join(stateDir, 'nested', 'dir');
    saveState(nested, { xp: 1, lastSeenLifetimeTokens: 2, lastMrrAwardDate: null });
    expect(loadState(nested)).toEqual({ xp: 1, lastSeenLifetimeTokens: 2, lastMrrAwardDate: null });
  });

  it('leaves no stray tmp files behind after a save (atomic tmp cleanup)', () => {
    saveState(stateDir, { xp: 10, lastSeenLifetimeTokens: 20, lastMrrAwardDate: null });
    saveState(stateDir, { xp: 30, lastSeenLifetimeTokens: 40, lastMrrAwardDate: null });
    const entries = fs.readdirSync(stateDir);
    expect(entries).toEqual(['xp-state.json']);
  });

  it('schema migration: an old file without lastMrrAwardDate loads clean as null', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'xp-state.json'), JSON.stringify({ xp: 42, lastSeenLifetimeTokens: 4200 }));
    expect(loadState(stateDir)).toEqual({ xp: 42, lastSeenLifetimeTokens: 4200, lastMrrAwardDate: null });
  });
});
