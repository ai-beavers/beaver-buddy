// Preload runs with contextIsolation + sandbox on: it can only reach the
// renderer through contextBridge, and exposes exactly one narrow API —
// nothing filesystem/network/IPC-generic is reachable from renderer JS.

import { contextBridge, ipcRenderer } from 'electron';
import { PAUSE_CHANGED_CHANNEL } from './ipc-channels';

contextBridge.exposeInMainWorld('beaverBuddy', {
  onPausedChanged: (callback: (paused: boolean) => void): void => {
    ipcRenderer.on(PAUSE_CHANGED_CHANNEL, (_event, paused: boolean) => {
      callback(paused);
    });
  },
});
