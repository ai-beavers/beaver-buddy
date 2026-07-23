// Small, hardened settings window: its own preload (settings-preload.ts,
// pet overlay preload untouched), same window hardening as the pet window
// (hardening.ts), and the app's first renderer -> main IPC. Every handler
// re-validates the payload (settings-validate.ts — the renderer's disabled
// radio button is UI only, never trusted) and the sender frame (only this
// window's own main frame may call these channels — defense in depth even
// though no other window's preload exposes them).

import path from 'node:path';
import { app, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron';
import { applyWindowHardening } from '../hardening';
import {
  SETTINGS_CONNECT_USAGE_CHANNEL,
  SETTINGS_DISCONNECT_CHANNEL,
  SETTINGS_FORCE_WORK_CHANNEL,
  SETTINGS_READ_STATUS_CHANNEL,
  SETTINGS_SAVE_CHANNEL,
} from '../ipc-channels';
import { USAGE_SOURCE_IDS, type UsageSourceId } from '../usage/sources';
import type { UsageSourcesSnapshot } from '../usage/tracker';
import { REVENUECAT_KEY_ACCOUNT, REVENUECAT_PROJECT_ACCOUNT, STRIPE_KEY_ACCOUNT } from './mrr-config';
import { deleteSecret, setSecret } from './secrets';
import { saveSettingsState, type Mode, type SettingsState } from './settings-store';
import {
  isValidationError,
  validateConnectUsageInput,
  validateDisconnectInput,
  validateSaveInput,
} from './settings-validate';

import type { Stage } from '../xp/curve';

export interface XpStatusPayload {
  readonly xp: number;
  readonly level: number;
  readonly stage: Stage;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number;
  readonly lastSeenByModel: Record<string, number>;
}

export interface SettingsWindowDeps {
  readonly stateDir: string;
  readonly keychainService: string;
  readonly getSettings: () => SettingsState;
  readonly getXpState: () => XpStatusPayload;
  readonly onSettingsChanged: (next: SettingsState) => void;
  readonly onForceWork: () => void;
  readonly getUsageSources: () => UsageSourcesSnapshot;
  readonly onUsageEnabledChanged: (next: SettingsState) => void;
}

let settingsWindow: BrowserWindow | null = null;
let handlersRegistered = false;

// Baseline content height for the settings window. It is capped below against
// the current work area, so adding usage-source rows degrades to scrolling on
// small/high-DPI screens instead of clipping content.
const SETTINGS_WINDOW_CONTENT_HEIGHT = 713;
// useContentSize height covers only the content; workAreaSize is the total
// usable screen, so reserve room for the OS title bar (~31 px on Windows)
// plus slack before capping — keeps the whole window on small/high-DPI
// screens (e.g. 1366x768 or 1080p @150%, workArea ~688 px).
const TITLE_BAR_ALLOWANCE = 40;

function isFromSettingsWindow(event: IpcMainInvokeEvent): boolean {
  return settingsWindow !== null && !settingsWindow.isDestroyed() && event.senderFrame === settingsWindow.webContents.mainFrame;
}

// Never trust the renderer's disabled-radio UI alone: mode can only be
// 'mrr' if at least one source is connected after the save.
export function nextModeAfterSave(requested: Mode, stripeConnected: boolean, revenuecatConnected: boolean): Mode {
  return requested === 'mrr' && !(stripeConnected || revenuecatConnected) ? 'tokens' : requested;
}

// A disconnect that removes the last connected source can never leave
// mode stuck on 'mrr' with nothing to poll.
export function nextModeAfterDisconnect(current: Mode, stripeConnected: boolean, revenuecatConnected: boolean): Mode {
  return stripeConnected || revenuecatConnected ? current : 'tokens';
}

export interface SettingsHandlers {
  readStatus(event: IpcMainInvokeEvent): unknown;
  save(event: IpcMainInvokeEvent, payload: unknown): Promise<unknown>;
  disconnect(event: IpcMainInvokeEvent, payload: unknown): Promise<unknown>;
  connectUsage(event: IpcMainInvokeEvent, payload: unknown): Promise<unknown>;
  forceWork(event: IpcMainInvokeEvent): unknown;
}

function usagePayload(usage: UsageSourcesSnapshot) {
  return Object.fromEntries(
    USAGE_SOURCE_IDS.map((source) => {
      const snapshot = usage[source];
      return [
        source,
        {
          enabled: snapshot?.enabled ?? false,
          connected: snapshot?.connected ?? false,
          logsFound: snapshot?.logsFound ?? false,
          lifetimeTokens: snapshot?.lifetimeTokens ?? 0,
          todayTokens: snapshot?.todayTokens ?? 0,
        },
      ];
    }),
  );
}

function preserveOptionalUsageFlags(current: SettingsState): Partial<SettingsState> {
  return {
    ...(current.piEnabled === undefined ? {} : { piEnabled: current.piEnabled }),
    ...(current.kimiEnabled === undefined ? {} : { kimiEnabled: current.kimiEnabled }),
    ...(current.opencodeEnabled === undefined ? {} : { opencodeEnabled: current.opencodeEnabled }),
  };
}

function setUsageEnabled(current: SettingsState, target: UsageSourceId, enabled: boolean): SettingsState {
  return {
    ...current,
    claudeEnabled: target === 'claude' ? enabled : current.claudeEnabled,
    codexEnabled: target === 'codex' ? enabled : current.codexEnabled,
    ...(target === 'pi' || current.piEnabled !== undefined ? { piEnabled: target === 'pi' ? enabled : current.piEnabled ?? false } : {}),
    ...(target === 'kimi' || current.kimiEnabled !== undefined ? { kimiEnabled: target === 'kimi' ? enabled : current.kimiEnabled ?? false } : {}),
    ...(target === 'opencode' || current.opencodeEnabled !== undefined
      ? { opencodeEnabled: target === 'opencode' ? enabled : current.opencodeEnabled ?? false }
      : {}),
  };
}


// Handler bodies are Electron-free (validate + keychain + settings store +
// deps only); the sender-frame check comes in as a predicate so tests can
// exercise the unauthorized path without a BrowserWindow.
export function createSettingsHandlers(
  deps: SettingsWindowDeps,
  isAuthorized: (event: IpcMainInvokeEvent) => boolean,
): SettingsHandlers {
  return {
    readStatus(event) {
      if (!isAuthorized(event)) return { error: 'unauthorized' };
      const s = deps.getSettings();
      const xp = deps.getXpState();
      return {
        stripeConnected: s.stripeConnected,
        revenuecatConnected: s.revenuecatConnected,
        mode: s.mode,
        xp,
        ...usagePayload(deps.getUsageSources()),
      };
    },

    async save(event, payload) {
      if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };
      const parsed = validateSaveInput(payload);
      if (isValidationError(parsed)) return { ok: false, error: parsed.error };

      const current = deps.getSettings();
      let stripeConnected = current.stripeConnected;
      let revenuecatConnected = current.revenuecatConnected;

      try {
        if (parsed.stripeKey) {
          await setSecret(deps.stateDir, deps.keychainService, STRIPE_KEY_ACCOUNT, parsed.stripeKey);
          stripeConnected = true;
        }
        if (parsed.revenuecatKey && parsed.revenuecatProjectId) {
          await setSecret(deps.stateDir, deps.keychainService, REVENUECAT_KEY_ACCOUNT, parsed.revenuecatKey);
          await setSecret(deps.stateDir, deps.keychainService, REVENUECAT_PROJECT_ACCOUNT, parsed.revenuecatProjectId);
          revenuecatConnected = true;
        }
      } catch {
        return { ok: false, error: 'secret write failed' };
      }

      const mode = nextModeAfterSave(parsed.mode ?? current.mode, stripeConnected, revenuecatConnected);
      const next: SettingsState = {
        mode,
        stripeConnected,
        revenuecatConnected,
        claudeEnabled: current.claudeEnabled,
        codexEnabled: current.codexEnabled,
        ...preserveOptionalUsageFlags(current),
      };
      await saveSettingsState(deps.stateDir, next);
      deps.onSettingsChanged(next);
      return { ok: true };
    },

    async disconnect(event, payload) {
      if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };
      const parsed = validateDisconnectInput(payload);
      if (isValidationError(parsed)) return { ok: false, error: parsed.error };

      const current = deps.getSettings();

      if (USAGE_SOURCE_IDS.includes(parsed.target as UsageSourceId)) {
        const next = setUsageEnabled(current, parsed.target as UsageSourceId, false);
        await saveSettingsState(deps.stateDir, next);
        deps.onSettingsChanged(next);
        deps.onUsageEnabledChanged(next);
        return { ok: true, ...usagePayload(deps.getUsageSources()) };
      }

      let stripeConnected = current.stripeConnected;
      let revenuecatConnected = current.revenuecatConnected;

      try {
        if (parsed.target === 'stripe') {
          await deleteSecret(deps.stateDir, deps.keychainService, STRIPE_KEY_ACCOUNT);
          stripeConnected = false;
        } else {
          await deleteSecret(deps.stateDir, deps.keychainService, REVENUECAT_KEY_ACCOUNT);
          await deleteSecret(deps.stateDir, deps.keychainService, REVENUECAT_PROJECT_ACCOUNT);
          revenuecatConnected = false;
        }
      } catch {
        return { ok: false, error: 'secret delete failed' };
      }

      const mode = nextModeAfterDisconnect(current.mode, stripeConnected, revenuecatConnected);
      const next: SettingsState = {
        mode,
        stripeConnected,
        revenuecatConnected,
        claudeEnabled: current.claudeEnabled,
        codexEnabled: current.codexEnabled,
        ...preserveOptionalUsageFlags(current),
      };
      await saveSettingsState(deps.stateDir, next);
      deps.onSettingsChanged(next);
      return { ok: true };
    },

    forceWork(event) {
      if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };
      deps.onForceWork();
      return { ok: true };
    },

    async connectUsage(event, payload) {
      if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };
      const parsed = validateConnectUsageInput(payload);
      if (isValidationError(parsed)) return { ok: false, error: parsed.error };

      const current = deps.getSettings();
      const next = setUsageEnabled(current, parsed.target, true);
      await saveSettingsState(deps.stateDir, next);
      deps.onSettingsChanged(next);
      deps.onUsageEnabledChanged(next);
      const usage = deps.getUsageSources();
      const source = usage[parsed.target];
      return {
        ok: true,
        target: parsed.target,
        connected: source?.connected ?? false,
        ...usagePayload(usage),
      };
    },
  };
}

function registerHandlers(deps: SettingsWindowDeps): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const handlers = createSettingsHandlers(deps, isFromSettingsWindow);
  ipcMain.handle(SETTINGS_READ_STATUS_CHANNEL, (event) => handlers.readStatus(event));
  ipcMain.handle(SETTINGS_SAVE_CHANNEL, (event, payload: unknown) => handlers.save(event, payload));
  ipcMain.handle(SETTINGS_DISCONNECT_CHANNEL, (event, payload: unknown) => handlers.disconnect(event, payload));
  ipcMain.handle(SETTINGS_CONNECT_USAGE_CHANNEL, (event, payload: unknown) => handlers.connectUsage(event, payload));
  ipcMain.handle(SETTINGS_FORCE_WORK_CHANNEL, (event) => handlers.forceWork(event));
}

export function openSettingsWindow(deps: SettingsWindowDeps): void {
  registerHandlers(deps);

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 420,
    // Content-sized (useContentSize): all 5 fieldsets + the status line fit
    // without scrolling; capped so window + title bar stay inside the work
    // area on small/high-DPI screens (content then scrolls, no data loss).
    height: Math.min(
      SETTINGS_WINDOW_CONTENT_HEIGHT,
      screen.getPrimaryDisplay().workAreaSize.height - TITLE_BAR_ALLOWANCE,
    ),
    useContentSize: true,
    resizable: false,
    title: 'Beaver Buddy — Settings',
    // .ico on Windows (multi-resolution, native taskbar sharpness); 1024² PNG
    // master on macOS/Linux (system/Dock applies the continuous-corner mask).
    icon: path.join(
      app.getAppPath(),
      'assets',
      process.platform === 'win32' ? 'icon.ico' : 'beaver-buddy-icon.png',
    ),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'settings-preload.js'),
    },
  });

  applyWindowHardening(win);

  win.loadFile(path.join(app.getAppPath(), 'dist', 'main', 'mrr', 'settings.html')).catch((error: unknown) => {
    console.error('Failed to load settings window:', error);
    if (!win.isDestroyed()) {
      win.destroy();
    }
    // A late rejection must not clobber a *different*, already-open
    // replacement window if one was opened before this promise settled.
    if (settingsWindow === win) {
      settingsWindow = null;
    }
  });

  win.on('closed', () => {
    if (settingsWindow === win) {
      settingsWindow = null;
    }
  });

  settingsWindow = win;
}
