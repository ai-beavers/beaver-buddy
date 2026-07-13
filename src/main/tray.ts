// Tray (menu-bar) UI: Pause/Resume toggle + Quit. Pause state itself lives in
// main.ts (pause-state.ts); this module only renders the menu and forwards
// the toggle click.

import path from 'node:path';
import { app, Menu, nativeImage, Tray } from 'electron';

export interface TrayCallbacks {
  onTogglePause: () => void;
  isPaused: () => boolean;
}

export function createTray(callbacks: TrayCallbacks): Tray {
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip('Beaver Buddy');

  const rebuildMenu = (): void => {
    const menu = Menu.buildFromTemplate([
      {
        label: callbacks.isPaused() ? 'Resume' : 'Pause',
        click: () => {
          callbacks.onTogglePause();
          rebuildMenu();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
  };

  rebuildMenu();
  return tray;
}
