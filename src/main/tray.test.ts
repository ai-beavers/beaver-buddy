import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildMenuTemplate, createTray, formatPetLabel, loadTrayIcon, type TrayCallbacks } from './tray';
import type { MenuItemConstructorOptions } from 'electron';

const createdIcons: { path: string; template?: boolean }[] = [];

// Minimal fake Tray: records listeners and method calls so the wiring inside
// createTray() (platform gate, single registration, refresh-safety) can be
// asserted under plain Node. Defined via vi.hoisted because the vi.mock
// factory below runs before module-level declarations are initialized.
const { FakeTray } = vi.hoisted(() => {
  class FakeTray {
    static instances: FakeTray[] = [];

    readonly listeners = new Map<string, Array<() => void>>();
    readonly popUpContextMenuCalls: unknown[][] = [];
    readonly setContextMenuCalls: unknown[] = [];
    readonly toolTips: string[] = [];

    constructor(readonly image: unknown) {
      FakeTray.instances.push(this);
    }

    on(event: string, listener: () => void): void {
      const list = this.listeners.get(event) ?? [];
      list.push(listener);
      this.listeners.set(event, list);
    }

    popUpContextMenu(...args: unknown[]): void {
      this.popUpContextMenuCalls.push(args);
    }

    setContextMenu(menu: unknown): void {
      this.setContextMenuCalls.push(menu);
    }

    setToolTip(toolTip: string): void {
      this.toolTips.push(toolTip);
    }
  }
  return { FakeTray };
});

vi.mock('electron', async () => {
  const actual = await vi.importActual<typeof import('electron')>('electron');
  return {
    ...actual,
    app: {
      getAppPath: vi.fn(() => '/mock/app/path'),
    },
    nativeImage: {
      createFromPath: vi.fn((path: string) => {
        const icon = {
          path,
          template: false,
          setTemplateImage(value: boolean) {
            this.template = value;
          },
        };
        createdIcons.push(icon);
        return icon;
      }),
    },
    Menu: {
      buildFromTemplate: vi.fn((template: unknown) => ({ template })),
    },
    Tray: FakeTray,
  };
});

// tray.ts imports 'electron' at module scope, but under plain Node (as
// vitest runs) that resolves to a path string, not the real API — so the
// mock above substitutes app/nativeImage plus the fake Tray/Menu, letting
// tests drive createTray() itself without a running Electron process. The
// visual tray itself is verified live (see docs/design-reviews).

function withPlatform(platform: string, fn: () => void): void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(process, 'platform', original);
  }
}

describe('formatPetLabel', () => {
  it('formats level, stage, and progress toward the next level', () => {
    expect(formatPetLabel({ level: 15, stage: 'baby', xp: 1400 })).toBe('Lv 15 — baby (1400/1500)');
  });

  it('floors fractional xp for display', () => {
    expect(formatPetLabel({ level: 16, stage: 'teen', xp: 1523.7 })).toBe('Lv 16 — teen (1523/1600)');
  });
});

describe('buildMenuTemplate', () => {
  function callbacks(overrides: Partial<TrayCallbacks> = {}): TrayCallbacks {
    return {
      isPaused: () => false,
      onTogglePause: () => {},
      getPetLabel: () => 'Lv 1 — baby (0/100)',
      getGrowthMode: () => 'tokens',
      isMrrAvailable: () => false,
      onSelectGrowthMode: () => {},
      onOpenGrowthSettings: () => {},
      onOpenConnect: () => {},
      ...overrides,
    };
  }

  it('puts a disabled pet info line first', () => {
    const template = buildMenuTemplate(callbacks(), () => {});
    expect(template[0]).toMatchObject({ label: 'Lv 1 — baby (0/100)', enabled: false });
  });

  it('shows Pause when not paused, Resume when paused', () => {
    const notPaused = buildMenuTemplate(callbacks({ isPaused: () => false }), () => {});
    const paused = buildMenuTemplate(callbacks({ isPaused: () => true }), () => {});
    expect(notPaused.find((i) => i.label === 'Pause' || i.label === 'Resume')?.label).toBe('Pause');
    expect(paused.find((i) => i.label === 'Pause' || i.label === 'Resume')?.label).toBe('Resume');
  });

  it('ends with a Quit item', () => {
    const template = buildMenuTemplate(callbacks(), () => {});
    expect(template[template.length - 1]).toMatchObject({ label: 'Quit' });
  });

  it('pause click calls onTogglePause then rebuild', () => {
    const calls: string[] = [];
    const template = buildMenuTemplate(
      callbacks({ onTogglePause: () => calls.push('toggle') }),
      () => calls.push('rebuild'),
    );
    const pauseItem = template.find((i) => i.label === 'Pause');
    pauseItem?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['toggle', 'rebuild']);
  });

  it('includes Connect… before Growth (opens settings modal, not a submenu)', () => {
    const template = buildMenuTemplate(callbacks(), () => {});
    const labels = template.map((i) => i.label);
    expect(labels.indexOf('Connect…')).toBeLessThan(labels.indexOf('Growth'));
    expect(template.find((i) => i.label === 'Connect…')?.submenu).toBeUndefined();
  });

  it('Connect… click calls onOpenConnect', () => {
    const calls: string[] = [];
    const template = buildMenuTemplate(callbacks({ onOpenConnect: () => calls.push('connect') }), () => {});
    template.find((i) => i.label === 'Connect…')?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['connect']);
  });
});

describe('buildMenuTemplate: growth submenu', () => {
  function callbacks(overrides: Partial<TrayCallbacks> = {}): TrayCallbacks {
    return {
      isPaused: () => false,
      onTogglePause: () => {},
      getPetLabel: () => 'Lv 1 — baby (0/100)',
      getGrowthMode: () => 'tokens',
      isMrrAvailable: () => false,
      onSelectGrowthMode: () => {},
      onOpenGrowthSettings: () => {},
      onOpenConnect: () => {},
      ...overrides,
    };
  }

  function growthSubmenu(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
    const growth = template.find((i) => i.label === 'Growth');
    return (growth?.submenu ?? []) as MenuItemConstructorOptions[];
  }

  it('hides the MRR item when no source is connected', () => {
    const submenu = growthSubmenu(buildMenuTemplate(callbacks({ isMrrAvailable: () => false }), () => {}));
    expect(submenu.some((i) => i.label === 'Source: MRR')).toBe(false);
    expect(submenu.some((i) => i.label === 'Source: Tokens')).toBe(true);
  });

  it('shows the MRR item, checked, once a source is connected and mode is mrr', () => {
    const submenu = growthSubmenu(
      buildMenuTemplate(callbacks({ isMrrAvailable: () => true, getGrowthMode: () => 'mrr' }), () => {}),
    );
    const mrrItem = submenu.find((i) => i.label === 'Source: MRR');
    expect(mrrItem).toMatchObject({ type: 'radio', checked: true });
    expect(submenu.find((i) => i.label === 'Source: Tokens')).toMatchObject({ checked: false });
  });

  it('always includes a Settings… item', () => {
    const submenu = growthSubmenu(buildMenuTemplate(callbacks(), () => {}));
    expect(submenu.some((i) => i.label === 'Settings…')).toBe(true);
  });

  it('mode click calls onSelectGrowthMode then rebuild', () => {
    const calls: string[] = [];
    const submenu = growthSubmenu(
      buildMenuTemplate(callbacks({ onSelectGrowthMode: () => { calls.push('select'); } }), () => calls.push('rebuild')),
    );
    submenu.find((i) => i.label === 'Source: Tokens')?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['select', 'rebuild']);
  });

  it('settings click calls onOpenGrowthSettings', () => {
    const calls: string[] = [];
    const submenu = growthSubmenu(
      buildMenuTemplate(callbacks({ onOpenGrowthSettings: () => calls.push('open') }), () => {}),
    );
    submenu.find((i) => i.label === 'Settings…')?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['open']);
  });
});

interface MockNativeImage {
  path: string;
  template: boolean;
}

describe('loadTrayIcon', () => {
  beforeEach(() => {
    createdIcons.length = 0;
  });

  it('loads tray-icon.png on Windows without calling setTemplateImage', () => {
    withPlatform('win32', () => {
      const icon = loadTrayIcon() as unknown as MockNativeImage;
      expect(icon.path).toBe(path.join('/mock/app/path', 'assets', 'tray-icon.png'));
      expect(icon.template).toBe(false);
    });
  });

  it('loads tray-iconTemplate.png on macOS and marks it as template', () => {
    withPlatform('darwin', () => {
      const icon = loadTrayIcon() as unknown as MockNativeImage;
      expect(icon.path).toBe(path.join('/mock/app/path', 'assets', 'tray-iconTemplate.png'));
      expect(icon.template).toBe(true);
    });
  });

  it('loads tray-icon.png on Linux without calling setTemplateImage', () => {
    withPlatform('linux', () => {
      const icon = loadTrayIcon() as unknown as MockNativeImage;
      expect(icon.path).toBe(path.join('/mock/app/path', 'assets', 'tray-icon.png'));
      expect(icon.template).toBe(false);
    });
  });
});

describe('createTray single-click menu', () => {
  function callbacks(overrides: Partial<TrayCallbacks> = {}): TrayCallbacks {
    return {
      isPaused: () => false,
      onTogglePause: () => {},
      getPetLabel: () => 'Lv 1 — baby (0/100)',
      getGrowthMode: () => 'tokens',
      isMrrAvailable: () => false,
      onSelectGrowthMode: () => {},
      onOpenGrowthSettings: () => {},
      onOpenConnect: () => {},
      ...overrides,
    };
  }

  beforeEach(() => {
    FakeTray.instances.length = 0;
  });

  it('registers exactly one click handler on win32 that pops the current menu without arguments', () => {
    withPlatform('win32', () => {
      createTray(callbacks());
      const tray = FakeTray.instances[0];
      const clickListeners = tray.listeners.get('click') ?? [];
      expect(clickListeners).toHaveLength(1);
      clickListeners[0]();
      // No arguments: the handler never captures a Menu object, so after any
      // refresh() it pops whatever setContextMenu() installed most recently.
      expect(tray.popUpContextMenuCalls).toEqual([[]]);
    });
  });

  it('does not stack click handlers across refresh() rebuilds', () => {
    withPlatform('win32', () => {
      const handle = createTray(callbacks());
      handle.refresh();
      handle.refresh();
      const tray = FakeTray.instances[0];
      expect(tray.setContextMenuCalls).toHaveLength(3);
      const clickListeners = tray.listeners.get('click') ?? [];
      expect(clickListeners).toHaveLength(1);
      clickListeners[0]();
      expect(tray.popUpContextMenuCalls).toHaveLength(1);
    });
  });

  it('registers no click handler on darwin but still builds the menu', () => {
    withPlatform('darwin', () => {
      createTray(callbacks());
      const tray = FakeTray.instances[0];
      expect(tray.listeners.get('click')).toBeUndefined();
      expect(tray.setContextMenuCalls).toHaveLength(1);
    });
  });

  it('registers no click handler on linux (popUpContextMenu is darwin/win32 only)', () => {
    withPlatform('linux', () => {
      createTray(callbacks());
      const tray = FakeTray.instances[0];
      expect(tray.listeners.get('click')).toBeUndefined();
      expect(tray.setContextMenuCalls).toHaveLength(1);
    });
  });
});
