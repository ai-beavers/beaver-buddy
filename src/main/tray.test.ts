import { describe, expect, it } from 'vitest';
import { buildMenuTemplate, formatPetLabel, type TrayCallbacks } from './tray';
import type { MenuItemConstructorOptions } from 'electron';

// tray.ts imports 'electron' at module scope, but under plain Node (as
// vitest runs) that resolves to a path string, not the real API — so
// merely importing the module and building menu *data* (never calling
// Tray/Menu/app APIs) is safe without a running Electron process. The
// visual tray itself is verified live (see docs/design-reviews).

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

  it('always includes a Growth settings… item', () => {
    const submenu = growthSubmenu(buildMenuTemplate(callbacks(), () => {}));
    expect(submenu.some((i) => i.label === 'Growth settings…')).toBe(true);
  });

  it('mode click calls onSelectGrowthMode then rebuild', () => {
    const calls: string[] = [];
    const submenu = growthSubmenu(
      buildMenuTemplate(callbacks({ onSelectGrowthMode: () => calls.push('select') }), () => calls.push('rebuild')),
    );
    submenu.find((i) => i.label === 'Source: Tokens')?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['select', 'rebuild']);
  });

  it('settings click calls onOpenGrowthSettings', () => {
    const calls: string[] = [];
    const submenu = growthSubmenu(
      buildMenuTemplate(callbacks({ onOpenGrowthSettings: () => calls.push('open') }), () => {}),
    );
    submenu.find((i) => i.label === 'Growth settings…')?.click?.(undefined as never, undefined as never, undefined as never);
    expect(calls).toEqual(['open']);
  });
});
