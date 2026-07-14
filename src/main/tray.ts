// Tray (menu-bar) UI: disabled pet info line + Pause/Resume toggle + Quit.
// Pause state itself lives in main.ts (pause-state.ts); XP/level state lives
// in xp/engine.ts — this module only renders the menu and forwards clicks.

import path from 'node:path';
import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { xpForLevel, type Stage } from './xp/curve';

export interface TrayCallbacks {
  onTogglePause: () => void;
  isPaused: () => boolean;
  getPetLabel: () => string;
}

export function formatPetLabel(state: { readonly level: number; readonly stage: Stage; readonly xp: number }): string {
  const nextLevelXp = xpForLevel(state.level + 1);
  return `Lv ${state.level} — ${state.stage} (${Math.floor(state.xp)}/${nextLevelXp})`;
}

// Pure menu-shape builder — no Electron Menu/Tray construction, so it is
// unit-testable without a running Electron process.
export function buildMenuTemplate(callbacks: TrayCallbacks, rebuild: () => void): MenuItemConstructorOptions[] {
  return [
    { label: callbacks.getPetLabel(), enabled: false },
    { type: 'separator' },
    {
      label: callbacks.isPaused() ? 'Resume' : 'Pause',
      click: () => {
        callbacks.onTogglePause();
        rebuild();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
}

export interface TrayHandle {
  readonly tray: Tray;
  // Rebuilds the context menu from current callback values — call whenever
  // pause or pet state changes outside a menu click (e.g. XP accrual).
  refresh(): void;
}

export function createTray(callbacks: TrayCallbacks): TrayHandle {
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip('Beaver Buddy');

  const rebuildMenu = (): void => {
    tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate(callbacks, rebuildMenu)));
  };

  rebuildMenu();
  return { tray, refresh: rebuildMenu };
}
