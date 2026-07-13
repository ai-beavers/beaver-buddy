// Electron hardening (CLAUDE.md P1 invariants): the renderer only ever loads
// our own local index.html, but we still deny navigation, new-window
// creation, permission requests, and downloads defense-in-depth — the app
// never intends to show remote content, so anything that would do so is a
// bug or an attack, not a feature to support.

import type { BrowserWindow } from 'electron';
import { session } from 'electron';

export function applyWindowHardening(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

export function applySessionHardening(): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  ses.on('will-download', (event) => {
    event.preventDefault();
  });
}
