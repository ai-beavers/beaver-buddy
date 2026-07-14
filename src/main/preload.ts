// Preload runs with contextIsolation + sandbox on: it can only reach the
// renderer through contextBridge, and exposes exactly one narrow API —
// nothing filesystem/network/IPC-generic is reachable from renderer JS.
//
// A sandboxed preload's require() only resolves Node/Electron built-ins,
// not sibling project files (confirmed empirically: requiring
// `./ipc-channels` here throws "module not found" at preload load time,
// which previously left `window.beaverBuddy` undefined and crashed the
// renderer before it could draw anything). So the channel name is inlined
// here instead of imported — keep it in sync with ipc-channels.ts by hand.

import { contextBridge, ipcRenderer } from 'electron';

const PAUSE_CHANGED_CHANNEL = 'state:paused'; // must match src/main/ipc-channels.ts
const PET_CHANGED_CHANNEL = 'state:pet'; // must match src/main/ipc-channels.ts
const HATCH_START_CHANNEL = 'state:hatch'; // must match src/main/ipc-channels.ts
const QUIP_CHANGED_CHANNEL = 'state:quip'; // must match src/main/ipc-channels.ts

interface PetChangedPayload {
  level: number;
  stage: 'baby' | 'teen' | 'adult';
  evolvingTo?: 'baby' | 'teen' | 'adult';
}

interface QuipChangedPayload {
  text: string;
  durationMs: number;
}

contextBridge.exposeInMainWorld('beaverBuddy', {
  onPausedChanged: (callback: (paused: boolean) => void): void => {
    ipcRenderer.on(PAUSE_CHANGED_CHANNEL, (_event, paused: boolean) => {
      callback(paused);
    });
  },
  onPetChanged: (callback: (pet: PetChangedPayload) => void): void => {
    ipcRenderer.on(PET_CHANGED_CHANNEL, (_event, pet: PetChangedPayload) => {
      callback(pet);
    });
  },
  // One-way main -> renderer only; nothing renderer -> main is exposed here.
  onHatchStart: (callback: () => void): void => {
    ipcRenderer.on(HATCH_START_CHANNEL, () => {
      callback();
    });
  },
  // One-way main -> renderer only; nothing renderer -> main is exposed here.
  onQuip: (callback: (quip: QuipChangedPayload) => void): void => {
    ipcRenderer.on(QUIP_CHANGED_CHANNEL, (_event, quip: QuipChangedPayload) => {
      callback(quip);
    });
  },
});
