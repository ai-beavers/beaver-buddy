// Small, hardened settings window: its own preload (settings-preload.ts,
// pet overlay preload untouched), same window hardening as the pet window
// (hardening.ts), and the app's first renderer -> main IPC. Every handler
// re-validates the payload (settings-validate.ts — the renderer's disabled
// radio button is UI only, never trusted) and the sender frame (only this
// window's own main frame may call these channels — defense in depth even
// though no other window's preload exposes them).

import path from 'node:path';
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { applyWindowHardening } from '../hardening';
import { SETTINGS_DISCONNECT_CHANNEL, SETTINGS_READ_STATUS_CHANNEL, SETTINGS_SAVE_CHANNEL } from '../ipc-channels';
import { deleteKeychainSecret, setKeychainSecret } from './keychain';
import { REVENUECAT_KEY_ACCOUNT, REVENUECAT_PROJECT_ACCOUNT, STRIPE_KEY_ACCOUNT } from './mrr-config';
import { saveSettingsState, type Mode, type SettingsState } from './settings-store';
import { isValidationError, validateDisconnectInput, validateSaveInput } from './settings-validate';

export interface SettingsWindowDeps {
  readonly stateDir: string;
  readonly keychainService: string;
  readonly getSettings: () => SettingsState;
  readonly onSettingsChanged: (next: SettingsState) => void;
}

let settingsWindow: BrowserWindow | null = null;
let handlersRegistered = false;

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
      return { stripeConnected: s.stripeConnected, revenuecatConnected: s.revenuecatConnected, mode: s.mode };
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
          await setKeychainSecret(deps.keychainService, STRIPE_KEY_ACCOUNT, parsed.stripeKey);
          stripeConnected = true;
        }
        if (parsed.revenuecatKey && parsed.revenuecatProjectId) {
          await setKeychainSecret(deps.keychainService, REVENUECAT_KEY_ACCOUNT, parsed.revenuecatKey);
          await setKeychainSecret(deps.keychainService, REVENUECAT_PROJECT_ACCOUNT, parsed.revenuecatProjectId);
          revenuecatConnected = true;
        }
      } catch {
        return { ok: false, error: 'keychain write failed' };
      }

      const mode = nextModeAfterSave(parsed.mode ?? current.mode, stripeConnected, revenuecatConnected);
      const next: SettingsState = { mode, stripeConnected, revenuecatConnected };
      saveSettingsState(deps.stateDir, next);
      deps.onSettingsChanged(next);
      return { ok: true };
    },

    async disconnect(event, payload) {
      if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };
      const parsed = validateDisconnectInput(payload);
      if (isValidationError(parsed)) return { ok: false, error: parsed.error };

      const current = deps.getSettings();
      let stripeConnected = current.stripeConnected;
      let revenuecatConnected = current.revenuecatConnected;

      try {
        if (parsed.target === 'stripe') {
          await deleteKeychainSecret(deps.keychainService, STRIPE_KEY_ACCOUNT);
          stripeConnected = false;
        } else {
          await deleteKeychainSecret(deps.keychainService, REVENUECAT_KEY_ACCOUNT);
          await deleteKeychainSecret(deps.keychainService, REVENUECAT_PROJECT_ACCOUNT);
          revenuecatConnected = false;
        }
      } catch {
        return { ok: false, error: 'keychain delete failed' };
      }

      const mode = nextModeAfterDisconnect(current.mode, stripeConnected, revenuecatConnected);
      const next: SettingsState = { mode, stripeConnected, revenuecatConnected };
      saveSettingsState(deps.stateDir, next);
      deps.onSettingsChanged(next);
      return { ok: true };
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
}

export function openSettingsWindow(deps: SettingsWindowDeps): void {
  registerHandlers(deps);

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const win = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    title: 'Beaver Buddy — Growth Settings',
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
  });

  win.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow = win;
}
