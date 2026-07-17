import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshState, loadSettingsState, saveSettingsState } from './settings-store';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-settings-store-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('settings store', () => {
  it('missing file -> fresh state (tokens, nothing connected, usage opt-ins off)', () => {
    expect(loadSettingsState(stateDir)).toEqual(freshState());
  });

  it('roundtrips a saved state', () => {
    const state = {
      mode: 'mrr' as const,
      stripeConnected: true,
      revenuecatConnected: false,
      claudeEnabled: true,
      codexEnabled: false,
    };
    saveSettingsState(stateDir, state);
    expect(loadSettingsState(stateDir)).toEqual(state);
  });

  it('corrupt file -> fresh state, no crash', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'growth-settings.json'), '{not valid json');
    expect(loadSettingsState(stateDir)).toEqual(freshState());
  });

  it('schema-invalid mode -> fresh state', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'growth-settings.json'),
      JSON.stringify({ mode: 'bogus', stripeConnected: false, revenuecatConnected: false }),
    );
    expect(loadSettingsState(stateDir)).toEqual(freshState());
  });

  it('migrates pre-opt-in files with claude/codex disabled (never auto-connect)', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, 'growth-settings.json'),
      JSON.stringify({ mode: 'tokens', stripeConnected: false, revenuecatConnected: true }),
    );
    expect(loadSettingsState(stateDir)).toEqual({
      mode: 'tokens',
      stripeConnected: false,
      revenuecatConnected: true,
      claudeEnabled: false,
      codexEnabled: false,
    });
  });

  it('never persists key material — only mode/connected/opt-in booleans are ever written', () => {
    saveSettingsState(stateDir, {
      mode: 'mrr',
      stripeConnected: true,
      revenuecatConnected: true,
      claudeEnabled: true,
      codexEnabled: true,
    });
    const raw = fs.readFileSync(path.join(stateDir, 'growth-settings.json'), 'utf8');
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'claudeEnabled',
      'codexEnabled',
      'mode',
      'revenuecatConnected',
      'stripeConnected',
    ]);
  });
});
