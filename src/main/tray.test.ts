import { describe, expect, it } from 'vitest';
import { buildMenuTemplate, formatPetLabel, type TrayCallbacks } from './tray';

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
