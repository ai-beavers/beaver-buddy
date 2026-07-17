import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HATCH_START_CHANNEL,
  PAUSE_CHANGED_CHANNEL,
  PET_CHANGED_CHANNEL,
  QUIP_CHANGED_CHANNEL,
  SETTINGS_DISCONNECT_CHANNEL,
  SETTINGS_READ_STATUS_CHANNEL,
  SETTINGS_RESET_PET_CHANNEL,
  SETTINGS_SAVE_CHANNEL,
  SETTINGS_CONNECT_USAGE_CHANNEL,
} from './ipc-channels';

// preload.ts runs sandboxed and cannot require sibling modules, so it carries
// a hand-synced copy of each channel literal instead of importing them. The
// preload also can't be imported under vitest (it needs Electron's
// contextBridge), so the honest check is a source-text assertion: this test
// fails if any literal ever drifts.
describe('ipc-channels drift guard', () => {
  const source = readFileSync('src/main/preload.ts', 'utf8');

  it('preload.ts hand-synced channel literal matches PAUSE_CHANGED_CHANNEL', () => {
    const match = source.match(/const PAUSE_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(PAUSE_CHANGED_CHANNEL);
  });

  it('preload.ts hand-synced channel literal matches PET_CHANGED_CHANNEL', () => {
    const match = source.match(/const PET_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(PET_CHANGED_CHANNEL);
  });

  it('preload.ts hand-synced channel literal matches HATCH_START_CHANNEL', () => {
    const match = source.match(/const HATCH_START_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(HATCH_START_CHANNEL);
  });

  it('preload.ts hand-synced channel literal matches QUIP_CHANGED_CHANNEL', () => {
    const match = source.match(/const QUIP_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(QUIP_CHANGED_CHANNEL);
  });

  // The settings window has its own sandboxed preload (mrr/settings-preload.ts)
  // with its own hand-synced copies — same constraint, same drift risk.
  const settingsSource = readFileSync('src/main/mrr/settings-preload.ts', 'utf8');

  it('settings-preload.ts hand-synced channel literal matches SETTINGS_SAVE_CHANNEL', () => {
    const match = settingsSource.match(/const SETTINGS_SAVE_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(SETTINGS_SAVE_CHANNEL);
  });

  it('settings-preload.ts hand-synced channel literal matches SETTINGS_READ_STATUS_CHANNEL', () => {
    const match = settingsSource.match(/const SETTINGS_READ_STATUS_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(SETTINGS_READ_STATUS_CHANNEL);
  });

  it('settings-preload.ts hand-synced channel literal matches SETTINGS_DISCONNECT_CHANNEL', () => {
    const match = settingsSource.match(/const SETTINGS_DISCONNECT_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(SETTINGS_DISCONNECT_CHANNEL);
  });

  it('settings-preload.ts hand-synced channel literal matches SETTINGS_RESET_PET_CHANNEL', () => {
    const match = settingsSource.match(/const SETTINGS_RESET_PET_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(SETTINGS_RESET_PET_CHANNEL);
  });

  it('settings-preload.ts hand-synced channel literal matches SETTINGS_CONNECT_USAGE_CHANNEL', () => {
    const match = settingsSource.match(/const SETTINGS_CONNECT_USAGE_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(SETTINGS_CONNECT_USAGE_CHANNEL);
  });
});
