// Secret store is mocked (never the real one); the handlers under test are
// Electron-free by construction (createSettingsHandlers takes the frame
// check as a predicate). Electron itself is mocked too, so the window-options
// pin test at the bottom can call openSettingsWindow without a real app.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { createSettingsHandlers, nextModeAfterDisconnect, nextModeAfterSave, openSettingsWindow, type SettingsWindowDeps } from './settings-window';
import { deleteSecret, setSecret } from './secrets';
import type { SettingsState } from './settings-store';
import type { UsageSourcesSnapshot } from '../usage/tracker';

vi.mock('electron', () => {
  const fakeWin = {
    loadFile: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    focus: vi.fn(),
    isDestroyed: () => false,
    webContents: {},
  };
  return {
    app: { getAppPath: () => '/app' },
    ipcMain: { handle: vi.fn() },
    // Large work area: the pin test asserts the uncapped measured constant.
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 4000, height: 4000 } }) },
    // mockImplementation (not a bare vi.fn()): `new BrowserWindow(...)` must
    // return the fake window or win.loadFile(...) would throw. A regular
    // function (not an arrow) so it can be used as a constructor.
    BrowserWindow: vi.fn().mockImplementation(function () {
      return fakeWin;
    }),
  };
});

vi.mock('../hardening', () => ({
  applyWindowHardening: vi.fn(),
}));

vi.mock('./secrets', () => ({
  setSecret: vi.fn().mockResolvedValue(undefined),
  deleteSecret: vi.fn().mockResolvedValue(undefined),
}));

const setSecretMock = vi.mocked(setSecret);
const deleteSecretMock = vi.mocked(deleteSecret);

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
      onProgressReset: vi.fn().mockResolvedValue(undefined),
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
    setSecretMock.mockClear();
    deleteSecretMock.mockClear();
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
    const d = deps();
    const handlers = createSettingsHandlers(d, () => false);
    expect(handlers.readStatus(fakeEvent)).toEqual({ error: 'unauthorized' });
    await expect(handlers.save(fakeEvent, { stripeKey: 'rk_fake' })).resolves.toEqual({ ok: false, error: 'unauthorized' });
    await expect(handlers.disconnect(fakeEvent, { target: 'stripe' })).resolves.toEqual({ ok: false, error: 'unauthorized' });
    await expect(handlers.resetProgress(fakeEvent)).resolves.toEqual({ ok: false, error: 'unauthorized' });
    await expect(handlers.connectUsage(fakeEvent, { target: 'claude' })).resolves.toEqual({ ok: false, error: 'unauthorized' });
    expect(changed).toHaveLength(0);
    expect(d.onProgressReset).not.toHaveBeenCalled();
  });

  it('readStatus returns mode/connected booleans plus per-source usage, never secrets', () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    expect(handlers.readStatus(fakeEvent)).toEqual({
      stripeConnected: false,
      revenuecatConnected: false,
      mode: 'tokens',
      claude: { enabled: false, connected: false, logsFound: true, lifetimeTokens: 0, todayTokens: 0 },
      codex: { enabled: false, connected: false, logsFound: true, lifetimeTokens: 9_000_000, todayTokens: 1_000 },
    });
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

  it('connectUsage opts in and reports connected when logs exist', async () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    const result = (await handlers.connectUsage(fakeEvent, { target: 'codex' })) as {
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
    await expect(handlers.save(fakeEvent, { stripeKey: 'rk_fake' })).resolves.toEqual({ ok: true });
    expect(settings).toEqual({
      mode: 'tokens',
      stripeConnected: true,
      revenuecatConnected: false,
      claudeEnabled: false,
      codexEnabled: false,
    });
    expect(changed).toHaveLength(1);
    expect(setSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'stripe-key', 'rk_fake');
  });

  it('save with revenuecat credentials stores both key and project id', async () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    await expect(
      handlers.save(fakeEvent, { revenuecatKey: 'rc_fake', revenuecatProjectId: 'proj_1' }),
    ).resolves.toEqual({ ok: true });
    expect(setSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'revenuecat-key', 'rc_fake');
    expect(setSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'revenuecat-project', 'proj_1');
  });

  it('save requesting mrr with nothing connected is forced back to tokens', async () => {
    const handlers = createSettingsHandlers(deps(), () => true);
    await handlers.save(fakeEvent, { mode: 'mrr' });
    expect(settings.mode).toBe('tokens');
  });

  it('disconnecting the last source forces mode back to tokens', async () => {
    settings = { mode: 'mrr', stripeConnected: true, revenuecatConnected: false, claudeEnabled: false, codexEnabled: false };
    const handlers = createSettingsHandlers(deps(), () => true);
    await handlers.disconnect(fakeEvent, { target: 'stripe' });
    expect(settings).toEqual({
      mode: 'tokens',
      stripeConnected: false,
      revenuecatConnected: false,
      claudeEnabled: false,
      codexEnabled: false,
    });
    expect(deleteSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'stripe-key');
  });

  it('disconnecting one of two sources preserves mrr mode', async () => {
    settings = { mode: 'mrr', stripeConnected: true, revenuecatConnected: true, claudeEnabled: false, codexEnabled: false };
    const handlers = createSettingsHandlers(deps(), () => true);
    await handlers.disconnect(fakeEvent, { target: 'revenuecat' });
    expect(settings).toEqual({
      mode: 'mrr',
      stripeConnected: true,
      revenuecatConnected: false,
      claudeEnabled: false,
      codexEnabled: false,
    });
    expect(deleteSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'revenuecat-key');
    expect(deleteSecretMock).toHaveBeenCalledWith(stateDir, 'svc', 'revenuecat-project');
  });

  it('resetProgress calls the dep exactly once and reports success', async () => {
    const d = deps();
    const handlers = createSettingsHandlers(d, () => true);
    await expect(handlers.resetProgress(fakeEvent)).resolves.toEqual({ ok: true });
    expect(d.onProgressReset).toHaveBeenCalledTimes(1);
  });

  it('resetProgress leaves growth settings and usage opt-ins untouched', async () => {
    settings = { ...settings, stripeConnected: true, claudeEnabled: true };
    const d = deps();
    const handlers = createSettingsHandlers(d, () => true);
    await expect(handlers.resetProgress(fakeEvent)).resolves.toEqual({ ok: true });
    expect(d.onProgressReset).toHaveBeenCalledTimes(1);
    expect(settings.stripeConnected).toBe(true);
    expect(settings.claudeEnabled).toBe(true);
    expect(changed).toHaveLength(0);
  });

  it('resetProgress maps a dep failure onto { ok: false }', async () => {
    const d = deps();
    vi.mocked(d.onProgressReset).mockRejectedValue(new Error('boom'));
    const handlers = createSettingsHandlers(d, () => true);
    await expect(handlers.resetProgress(fakeEvent)).resolves.toEqual({ ok: false, error: 'reset failed' });
  });
});

describe('openSettingsWindow', () => {
  it('destroys the window and resets the reference when the page fails to load', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingWin = {
      loadFile: vi.fn().mockRejectedValue(new Error('load failed')),
      on: vi.fn(),
      focus: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
      webContents: {},
    };
    const replacementWin = {
      loadFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      focus: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
      webContents: {},
    };
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return failingWin;
    });
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return replacementWin;
    });

    const deps: SettingsWindowDeps = {
      stateDir: '/unused',
      keychainService: 'svc',
      getSettings: () => ({
        mode: 'tokens',
        stripeConnected: false,
        revenuecatConnected: false,
        claudeEnabled: false,
        codexEnabled: false,
      }),
      onSettingsChanged: () => {},
      onProgressReset: vi.fn().mockResolvedValue(undefined),
      getUsageSources: () => ({
        claude: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
        codex: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
      }),
      onUsageEnabledChanged: () => {},
    };

    openSettingsWindow(deps);
    // Wait for the loadFile rejection to propagate into the code's catch handler.
    await expect(failingWin.loadFile.mock.results[0].value).rejects.toThrow('load failed');

    expect(errorSpy).toHaveBeenCalledWith('Failed to load settings window:', expect.any(Error));
    expect(failingWin.destroy).toHaveBeenCalledTimes(1);

    // A second open should create a new BrowserWindow because the reference
    // was reset to null, and the new window should load its page normally.
    openSettingsWindow(deps);
    expect(BrowserWindow).toHaveBeenCalledTimes(2);
    expect(replacementWin.loadFile).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('a late loadFile rejection does not clobber a replacement window opened in the meantime', async () => {
    // settingsWindow is module-scoped state that outlives individual `it`
    // blocks in this file — close out whatever window a previous test left
    // tracked so this one starts from a clean slate.
    const priorWin = vi.mocked(BrowserWindow).mock.results.at(-1)?.value as
      | { on: ReturnType<typeof vi.fn> }
      | undefined;
    const priorClosedHandler = priorWin?.on.mock.calls.find((call: unknown[]) => call[0] === 'closed')?.[1] as
      | (() => void)
      | undefined;
    priorClosedHandler?.();
    const callsBefore = vi.mocked(BrowserWindow).mock.calls.length;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectFirstLoad: (error: Error) => void = () => {};
    const firstWin = {
      loadFile: vi.fn().mockImplementation(
        () => new Promise((_resolve, reject) => { rejectFirstLoad = reject; }),
      ),
      on: vi.fn(),
      focus: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
      webContents: {},
    };
    const secondWin = {
      loadFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      focus: vi.fn(),
      isDestroyed: () => false,
      destroy: vi.fn(),
      webContents: {},
    };
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return firstWin;
    });
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      return secondWin;
    });

    const deps: SettingsWindowDeps = {
      stateDir: '/unused',
      keychainService: 'svc',
      getSettings: () => ({
        mode: 'tokens',
        stripeConnected: false,
        revenuecatConnected: false,
        claudeEnabled: false,
        codexEnabled: false,
      }),
      onSettingsChanged: () => {},
      onProgressReset: vi.fn().mockResolvedValue(undefined),
      getUsageSources: () => ({
        claude: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
        codex: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
      }),
      onUsageEnabledChanged: () => {},
    };

    openSettingsWindow(deps);
    expect(firstWin.loadFile).toHaveBeenCalled();

    // The user closes the first window before its loadFile() ever settles.
    const closedHandler = firstWin.on.mock.calls.find(([event]) => event === 'closed')?.[1] as (() => void) | undefined;
    closedHandler?.();

    // A second, genuine open creates a replacement window.
    openSettingsWindow(deps);
    expect(secondWin.loadFile).toHaveBeenCalled();

    // The first window's loadFile() now rejects, late — after the replacement is live.
    rejectFirstLoad(new Error('load failed'));
    await Promise.resolve();
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith('Failed to load settings window:', expect.any(Error));
    expect(firstWin.destroy).toHaveBeenCalledTimes(1);

    // The replacement must still be treated as the live settings window: a
    // third open focuses it rather than creating a stray duplicate.
    openSettingsWindow(deps);
    expect(secondWin.focus).toHaveBeenCalledTimes(1);
    expect(vi.mocked(BrowserWindow).mock.calls.length).toBe(callsBefore + 2);

    errorSpy.mockRestore();
  });

  it('pins the measured content height, useContentSize, fixed-size flags, and platform icon', () => {
    const deps: SettingsWindowDeps = {
      stateDir: '/unused',
      keychainService: 'svc',
      getSettings: () => ({
        mode: 'tokens',
        stripeConnected: false,
        revenuecatConnected: false,
        claudeEnabled: false,
        codexEnabled: false,
      }),
      onSettingsChanged: () => {},
      onProgressReset: vi.fn().mockResolvedValue(undefined),
      getUsageSources: () => ({
        claude: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
        codex: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
      }),
      onUsageEnabledChanged: () => {},
    };

    openSettingsWindow(deps);

    // 713 = 705 px content (CDP worst-case measurement 2026-07-17, see
    // settings-window.ts) + 8 px buffer; workArea mock is 4000 px, so the
    // cap does not apply here.
    const expectedIcon = process.platform === 'win32'
      ? path.join('/app', 'assets', 'icon.ico')
      : path.join('/app', 'assets', 'beaver-buddy-icon.png');
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 420,
        height: 713,
        useContentSize: true,
        resizable: false,
        icon: expectedIcon,
      }),
    );
  });
});
