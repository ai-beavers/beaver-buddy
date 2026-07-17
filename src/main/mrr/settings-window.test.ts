// Keychain is mocked (never the real one); the handlers under test are
// Electron-free by construction (createSettingsHandlers takes the frame
// check as a predicate), so importing settings-window.ts here is safe the
// same way tray.test.ts's import of tray.ts is — no Electron API is called.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { createSettingsHandlers, nextModeAfterDisconnect, nextModeAfterSave, type SettingsWindowDeps } from './settings-window';
import type { SettingsState } from './settings-store';
import type { UsageSourcesSnapshot } from '../usage/tracker';

vi.mock('./keychain', () => ({
  setKeychainSecret: vi.fn().mockResolvedValue(undefined),
  deleteKeychainSecret: vi.fn().mockResolvedValue(undefined),
}));

describe('nextModeAfterSave', () => {
  it('forces tokens when mrr is requested with nothing connected', () => {
    expect(nextModeAfterSave('mrr', false, false)).toBe('tokens');
  });

  it('preserves mrr when a source is connected', () => {
    expect(nextModeAfterSave('mrr', true, false)).toBe('mrr');
    expect(nextModeAfterSave('mrr', false, true)).toBe('mrr');
  });

  it('tokens always stays tokens', () => {
    expect(nextModeAfterSave('tokens', true, true)).toBe('tokens');
    expect(nextModeAfterSave('tokens', false, false)).toBe('tokens');
  });
});

describe('nextModeAfterDisconnect', () => {
  it('forces tokens when the last connected source is removed', () => {
    expect(nextModeAfterDisconnect('mrr', false, false)).toBe('tokens');
  });

  it('preserves mrr when one of two sources remains', () => {
    expect(nextModeAfterDisconnect('mrr', true, false)).toBe('mrr');
    expect(nextModeAfterDisconnect('mrr', false, true)).toBe('mrr');
  });

  it('tokens stays tokens regardless', () => {
    expect(nextModeAfterDisconnect('tokens', false, false)).toBe('tokens');
    expect(nextModeAfterDisconnect('tokens', true, true)).toBe('tokens');
  });
});

describe('createSettingsHandlers', () => {
  let stateDir: string;
  let settings: SettingsState;
  let changed: SettingsState[];
  let petResets: number;
  let usageEnabledCalls: { claudeEnabled: boolean; codexEnabled: boolean }[];
  let usageSnapshot: UsageSourcesSnapshot;

  const fakeEvent = {} as IpcMainInvokeEvent;

  function deps(): SettingsWindowDeps {
    return {
      stateDir,
      keychainService: 'svc',
      getSettings: () => settings,
      onSettingsChanged: (next) => {
        settings = next;
        changed.push(next);
      },
      onPetReset: () => {
        petResets += 1;
      },
      getUsageSources: () => usageSnapshot,
      onUsageEnabledChanged: (next) => {
        usageEnabledCalls.push(next);
        usageSnapshot = {
          claude: {
            ...usageSnapshot.claude,
            enabled: next.claudeEnabled,
            connected: next.claudeEnabled && usageSnapshot.claude.logsFound,
            lifetimeTokens: next.claudeEnabled ? usageSnapshot.claude.lifetimeTokens : 0,
            todayTokens: next.claudeEnabled ? usageSnapshot.claude.todayTokens : 0,
          },
          codex: {
            ...usageSnapshot.codex,
            enabled: next.codexEnabled,
            connected: next.codexEnabled && usageSnapshot.codex.logsFound,
            lifetimeTokens: next.codexEnabled ? usageSnapshot.codex.lifetimeTokens : 0,
            todayTokens: next.codexEnabled ? usageSnapshot.codex.todayTokens : 0,
          },
        };
      },
    };
  }

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-settings-window-'));
    settings = {
      mode: 'tokens',
      stripeConnected: false,
      revenuecatConnected: false,
      claudeEnabled: false,
      codexEnabled: false,
    };
    changed = [];
    petResets = 0;
    usageEnabledCalls = [];
    usageSnapshot = {
      claude: { enabled: false, logsFound: true, connected: false, lifetimeTokens: 0, todayTokens: 0 },
      codex: { enabled: false, logsFound: true, connected: false, lifetimeTokens: 9_000_000, todayTokens: 1_000 },
    };
  });

  afterEach(() => {
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it('unauthorized sender is rejected on all handlers, with no state change', async () => {
    const handlers = createSettingsHandlers(deps(), () => false);
    expect(handlers.readStatus(fakeEvent)).toEqual({ error: 'unauthorized' });
    await expect(handlers.save(fakeEvent, { stripeKey: 'rk_fake' })).resolves.toEqual({ ok: false, error: 'unauthorized' });
    await expect(handlers.disconnect(fakeEvent, { target: 'stripe' })).resolves.toEqual({ ok: false, error: 'unauthorized' });
    expect(handlers.resetPet(fakeEvent)).toEqual({ ok: false, error: 'unauthorized' });
    expect(handlers.connectUsage(fakeEvent, { target: 'claude' })).toEqual({ ok: false, error: 'unauthorized' });
    expect(changed).toHaveLength(0);
    expect(petResets).toBe(0);
  });

  it('readStatus does not auto-connect just because logs exist', () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    const status = handlers.readStatus(fakeEvent) as {
      claude: { enabled: boolean; connected: boolean };
      codex: { enabled: boolean; connected: boolean };
    };
    expect(status.claude).toMatchObject({ enabled: false, connected: false });
    expect(status.codex).toMatchObject({ enabled: false, connected: false });
  });

  it('connectUsage opts in and reports connected when logs exist', () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    const result = handlers.connectUsage(fakeEvent, { target: 'codex' }) as {
      ok: boolean;
      connected: boolean;
      codex: { enabled: boolean; connected: boolean; todayTokens: number };
    };
    expect(result.ok).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.codex).toMatchObject({ enabled: true, connected: true, todayTokens: 1_000 });
    expect(settings.codexEnabled).toBe(true);
    expect(settings.claudeEnabled).toBe(false);
    expect(usageEnabledCalls).toEqual([{ claudeEnabled: false, codexEnabled: true }]);
  });

  it('disconnect claude opts out without touching stripe keys', async () => {
    settings = { ...settings, claudeEnabled: true };
    usageSnapshot = {
      ...usageSnapshot,
      claude: { enabled: true, logsFound: true, connected: true, lifetimeTokens: 5, todayTokens: 2 },
    };
    const handlers = createSettingsHandlers(deps(), () => true);
    await expect(handlers.disconnect(fakeEvent, { target: 'claude' })).resolves.toMatchObject({ ok: true });
    expect(settings.claudeEnabled).toBe(false);
    expect(usageEnabledCalls).toEqual([{ claudeEnabled: false, codexEnabled: false }]);
  });

  it('save with a key connects the source and persists', async () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    await expect(handlers.save(fakeEvent, { stripeKey: 'rk_test' })).resolves.toEqual({ ok: true });
    expect(settings.stripeConnected).toBe(true);
    expect(changed).toHaveLength(1);
  });

  it('resetPet calls onPetReset and leaves growth settings untouched', () => {
    settings = { ...settings, stripeConnected: true, claudeEnabled: true };
    const handlers = createSettingsHandlers(deps(), () => true);
    expect(handlers.resetPet(fakeEvent)).toEqual({ ok: true });
    expect(petResets).toBe(1);
    expect(settings.stripeConnected).toBe(true);
    expect(settings.claudeEnabled).toBe(true);
  });
});
