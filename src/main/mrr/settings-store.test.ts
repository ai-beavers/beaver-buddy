import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSettingsState, saveSettingsState } from './settings-store';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-settings-store-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('settings store', () => {
  it('missing file -> fresh state (tokens, nothing connected)', () => {
    expect(loadSettingsState(stateDir)).toEqual({ mode: 'tokens', stripeConnected: false, revenuecatConnected: false });
  });

  it('roundtrips a saved state', () => {
    const state = { mode: 'mrr' as const, stripeConnected: true, revenuecatConnected: false };
    saveSettingsState(stateDir, state);
    expect(loadSettingsState(stateDir)).toEqual(state);
  });

  it('corrupt file -> fresh state, no crash', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'growth-settings.json'), '{not valid json');
    expect(loadSettingsState(stateDir)).toEqual({ mode: 'tokens', stripeConnected: false, revenuecatConnected: false });
  });

  it('schema-invalid mode -> fresh state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'growth-settings.json'),
      JSON.stringify({ mode: 'bogus', stripeConnected: false, revenuecatConnected: false }),
    );
    expect(loadSettingsState(stateDir)).toEqual({ mode: 'tokens', stripeConnected: false, revenuecatConnected: false });
  });

  it('never persists key material — only mode/connected booleans are ever written', () => {
    saveSettingsState(stateDir, { mode: 'mrr', stripeConnected: true, revenuecatConnected: true });
    const raw = fs.readFileSync(path.join(stateDir, 'growth-settings.json'), 'utf8');
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['mode', 'revenuecatConnected', 'stripeConnected']);
  });
});
