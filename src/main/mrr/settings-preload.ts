// Own minimal preload for the settings window ONLY — the pet overlay
// window keeps using ../preload.ts, untouched. Runs sandboxed
// (contextIsolation + sandbox): can only reach the renderer through
// contextBridge, exposes exactly the settings calls, nothing
// filesystem/network/IPC-generic. Same "can't require sibling files under
// sandbox" constraint as ../preload.ts documents — channel literals are
// hand-synced here instead of imported (see ../ipc-channels.test.ts's
// drift guard, extended to cover this file too).

import { contextBridge, ipcRenderer } from 'electron';

const SETTINGS_SAVE_CHANNEL = 'settings:save'; // must match src/main/ipc-channels.ts
const SETTINGS_READ_STATUS_CHANNEL = 'settings:read-status'; // must match src/main/ipc-channels.ts
const SETTINGS_DISCONNECT_CHANNEL = 'settings:disconnect'; // must match src/main/ipc-channels.ts
const SETTINGS_RESET_PET_CHANNEL = 'settings:reset-pet'; // must match src/main/ipc-channels.ts
const SETTINGS_CONNECT_USAGE_CHANNEL = 'settings:connect-usage'; // must match src/main/ipc-channels.ts

export interface SaveSettingsPayload {
  stripeKey?: string;
  revenuecatKey?: string;
  revenuecatProjectId?: string;
  mode?: 'tokens' | 'mrr';
}

contextBridge.exposeInMainWorld('beaverBuddySettings', {
  save: (payload: SaveSettingsPayload): Promise<unknown> => ipcRenderer.invoke(SETTINGS_SAVE_CHANNEL, payload),
  readStatus: (): Promise<unknown> => ipcRenderer.invoke(SETTINGS_READ_STATUS_CHANNEL),
  disconnect: (target: 'stripe' | 'revenuecat' | 'claude' | 'codex'): Promise<unknown> =>
    ipcRenderer.invoke(SETTINGS_DISCONNECT_CHANNEL, { target }),
  resetPet: (): Promise<unknown> => ipcRenderer.invoke(SETTINGS_RESET_PET_CHANNEL),
  connectUsage: (target: 'claude' | 'codex'): Promise<unknown> =>
    ipcRenderer.invoke(SETTINGS_CONNECT_USAGE_CHANNEL, { target }),
});
