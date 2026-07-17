import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOnboardingState, saveOnboardingState } from './onboarding';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-onboarding-store-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('onboarding store', () => {
  it('missing file -> not hatched, no crash', () => {
    expect(loadOnboardingState(stateDir)).toEqual({ hatched: false });
  });

  it('roundtrips a saved state', async () => {
    await saveOnboardingState(stateDir, { hatched: true });
    expect(loadOnboardingState(stateDir)).toEqual({ hatched: true });
  });

  it('corrupt file -> not hatched, no crash', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'onboarding-state.json'), '{not valid json');
    expect(loadOnboardingState(stateDir)).toEqual({ hatched: false });
  });

  it('schema-invalid file (non-boolean hatched) -> not hatched', () => {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'onboarding-state.json'), JSON.stringify({ hatched: 'yes' }));
    expect(loadOnboardingState(stateDir)).toEqual({ hatched: false });
  });

  it('leaves no stray tmp files behind after a save (shared atomic helper)', async () => {
    await saveOnboardingState(stateDir, { hatched: true });
    await saveOnboardingState(stateDir, { hatched: false });
    const entries = fs.readdirSync(stateDir);
    expect(entries).toEqual(['onboarding-state.json']);
  });
});
