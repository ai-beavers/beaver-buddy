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
  getGrowthMode: () => 'tokens' | 'mrr';
  // MRR is hidden from the submenu entirely (not just disabled) until at
  // least one source is connected.
  isMrrAvailable: () => boolean;
  onSelectGrowthMode: (mode: 'tokens' | 'mrr') => void;
  onOpenGrowthSettings: () => void;
  // Opens the same settings window, focused on Connect (Claude Code / Codex).
  onOpenConnect: () => void;
}

export function formatPetLabel(state: { readonly level: number; readonly stage: Stage; readonly xp: number }): string {
  const nextLevelXp = xpForLevel(state.level + 1);
  return `Lv ${state.level} — ${state.stage} (${Math.floor(state.xp)}/${nextLevelXp})`;
}

// Pure menu-shape builder — no Electron Menu/Tray construction, so it is
// unit-testable without a running Electron process.
export function buildMenuTemplate(callbacks: TrayCallbacks, rebuild: () => void): MenuItemConstructorOptions[] {
  const growthSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Source: Tokens',
      type: 'radio',
      checked: callbacks.getGrowthMode() === 'tokens',
      click: () => {
        callbacks.onSelectGrowthMode('tokens');
        rebuild();
      },
    },
  ];
  if (callbacks.isMrrAvailable()) {
    growthSubmenu.push({
      label: 'Source: MRR',
      type: 'radio',
      checked: callbacks.getGrowthMode() === 'mrr',
      click: () => {
        callbacks.onSelectGrowthMode('mrr');
        rebuild();
      },
    });
  }
  growthSubmenu.push({ type: 'separator' }, { label: 'Settings…', click: () => callbacks.onOpenGrowthSettings() });

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
    { label: 'Connect…', click: () => callbacks.onOpenConnect() },
    { label: 'Growth', submenu: growthSubmenu },
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

// QA-only introspection seam (same family as --smoke's stdout JSON): a
// native Tray context menu has no external readback API, so a live check
// that the MRR item is hidden/shown has nothing else to poll. Optional and
// a no-op unless main.ts wires it behind a debug flag.
export function createTray(callbacks: TrayCallbacks, onMenuBuilt?: (labels: readonly string[]) => void): TrayHandle {
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  const tray = new Tray(icon);
  tray.setToolTip('Beaver Buddy');

  const rebuildMenu = (): void => {
    const template = buildMenuTemplate(callbacks, rebuildMenu);
    tray.setContextMenu(Menu.buildFromTemplate(template));
    if (onMenuBuilt) {
      const growth = template.find((i) => i.label === 'Growth');
      const submenuLabels = ((growth?.submenu as MenuItemConstructorOptions[] | undefined) ?? []).map((i) => i.label ?? '');
      onMenuBuilt(submenuLabels);
    }
  };

  rebuildMenu();
  return { tray, refresh: rebuildMenu };
}
