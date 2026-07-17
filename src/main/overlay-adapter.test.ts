import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen } from 'electron';

// Electron's screen module is mocked because vitest runs under plain Node,
// not inside an Electron process. BrowserWindow is mocked as a thin object
// that records setAlwaysOnTop/setBounds calls.
const screenEventHandlers = new Map<string, Set<() => void>>();

function emitScreenEvent(event: string): void {
  screenEventHandlers.get(event)?.forEach((handler) => handler());
}

function setMockPrimaryDisplay(display: Electron.Display): void {
  vi.mocked(screen.getPrimaryDisplay).mockReturnValue(display);
}

vi.mock('electron', () => ({
  screen: {
    getPrimaryDisplay: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!screenEventHandlers.has(event)) {
        screenEventHandlers.set(event, new Set());
      }
      screenEventHandlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: () => void) => {
      screenEventHandlers.get(event)?.delete(handler);
    }),
  },
  BrowserWindow: vi.fn(),
}));

import {
  configureAlwaysOnTop,
  detectTaskbarEdge,
  effectiveWorkArea,
  fitWindowToWorkArea,
  getOverlayWindowBounds,
  getPrimaryWorkAreaInfo,
  onWorkAreaChanged,
} from './overlay-adapter';

describe('detectTaskbarEdge', () => {
  it('detects a taskbar at the bottom', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    expect(detectTaskbarEdge(bounds as Electron.Rectangle, workArea as Electron.Rectangle)).toBe('bottom');
  });

  it('detects a taskbar at the top', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 40, width: 1920, height: 1040 };
    expect(detectTaskbarEdge(bounds as Electron.Rectangle, workArea as Electron.Rectangle)).toBe('top');
  });

  it('detects a taskbar at the left', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 60, y: 0, width: 1860, height: 1080 };
    expect(detectTaskbarEdge(bounds as Electron.Rectangle, workArea as Electron.Rectangle)).toBe('left');
  });

  it('detects a taskbar at the right', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1860, height: 1080 };
    expect(detectTaskbarEdge(bounds as Electron.Rectangle, workArea as Electron.Rectangle)).toBe('right');
  });

  it('returns none when workArea matches bounds (auto-hide or no taskbar)', () => {
    const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    expect(detectTaskbarEdge(bounds as Electron.Rectangle, workArea as Electron.Rectangle)).toBe('none');
  });
});

describe('effectiveWorkArea', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('insets the work area on win32 when workArea === bounds (auto-hide)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display;
    expect(effectiveWorkArea(display)).toEqual({ x: 2, y: 2, width: 1916, height: 1076 });
  });

  it('leaves the work area unchanged on win32 with a visible taskbar', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    } as Electron.Display;
    expect(effectiveWorkArea(display)).toEqual({ x: 0, y: 0, width: 1920, height: 1040 });
  });

  it('leaves the work area unchanged on darwin even when workArea === bounds', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display;
    expect(effectiveWorkArea(display)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('leaves the work area unchanged on linux even when workArea === bounds', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display;
    expect(effectiveWorkArea(display)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it('clamps width/height to 1 on a tiny win32 auto-hide display', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const display = {
      bounds: { x: 0, y: 0, width: 3, height: 2 },
      workArea: { x: 0, y: 0, width: 3, height: 2 },
    } as Electron.Display;
    expect(effectiveWorkArea(display)).toEqual({ x: 2, y: 2, width: 1, height: 1 });
  });
});

describe('getPrimaryWorkAreaInfo', () => {
  beforeEach(() => {
    screenEventHandlers.clear();
    setMockPrimaryDisplay({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    } as Electron.Display);
  });

  it('returns the primary display work area and detected edge', () => {
    const info = getPrimaryWorkAreaInfo();
    expect(info).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
      taskbarEdge: 'bottom',
    });
  });

  it('returns inset values with taskbarEdge none on win32 auto-hide', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    setMockPrimaryDisplay({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display);
    const info = getPrimaryWorkAreaInfo();
    expect(info).toEqual({
      x: 2,
      y: 2,
      width: 1916,
      height: 1076,
      taskbarEdge: 'none',
    });
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });
});

describe('getOverlayWindowBounds', () => {
  it('returns bounds matching the display work area', () => {
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 40, width: 1920, height: 1040 },
    } as Electron.Display;
    expect(getOverlayWindowBounds(display)).toEqual({ x: 0, y: 40, width: 1920, height: 1040 });
  });

  it('returns inset bounds on win32 when the taskbar is auto-hidden', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const display = {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display;
    expect(getOverlayWindowBounds(display)).toEqual({ x: 2, y: 2, width: 1916, height: 1076 });
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });
});

describe('configureAlwaysOnTop', () => {
  it('uses floating on macOS', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const win = { setAlwaysOnTop: vi.fn() } as unknown as Electron.BrowserWindow;
    configureAlwaysOnTop(win as Electron.BrowserWindow);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'floating');
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('uses normal on Windows', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const win = { setAlwaysOnTop: vi.fn() } as unknown as Electron.BrowserWindow;
    configureAlwaysOnTop(win as Electron.BrowserWindow);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'normal');
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('uses normal on Linux', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const win = { setAlwaysOnTop: vi.fn() } as unknown as Electron.BrowserWindow;
    configureAlwaysOnTop(win as Electron.BrowserWindow);
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'normal');
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });
});

describe('fitWindowToWorkArea', () => {
  it('sets bounds without animation', () => {
    const win = { setBounds: vi.fn() } as unknown as Electron.BrowserWindow;
    fitWindowToWorkArea(win as Electron.BrowserWindow, {
      x: 0,
      y: 40,
      width: 1920,
      height: 1040,
      taskbarEdge: 'bottom',
    });
    expect(win.setBounds).toHaveBeenCalledWith({ x: 0, y: 40, width: 1920, height: 1040 }, false);
  });
});

describe('onWorkAreaChanged', () => {
  beforeEach(() => {
    screenEventHandlers.clear();
    setMockPrimaryDisplay({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    } as Electron.Display);
  });

  afterEach(() => {
    screenEventHandlers.clear();
  });

  it('subscribes to display-added, display-removed, and display-metrics-changed', () => {
    const callback = vi.fn();
    onWorkAreaChanged(callback);
    expect(screenEventHandlers.has('display-added')).toBe(true);
    expect(screenEventHandlers.has('display-removed')).toBe(true);
    expect(screenEventHandlers.has('display-metrics-changed')).toBe(true);
  });

  it('fires the callback when display-metrics-changed fires', () => {
    const callback = vi.fn();
    onWorkAreaChanged(callback);
    setMockPrimaryDisplay({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1000 },
    } as Electron.Display);
    emitScreenEvent('display-metrics-changed');
    expect(callback).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 1920,
      height: 1000,
      taskbarEdge: 'bottom',
    });
  });

  it('reports inset info when metrics change to win32 auto-hide', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const callback = vi.fn();
    onWorkAreaChanged(callback);
    setMockPrimaryDisplay({
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    } as Electron.Display);
    emitScreenEvent('display-metrics-changed');
    expect(callback).toHaveBeenCalledWith({
      x: 2,
      y: 2,
      width: 1916,
      height: 1076,
      taskbarEdge: 'none',
    });
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('unsubscribes all handlers when the returned cleanup is called', () => {
    const callback = vi.fn();
    const unsubscribe = onWorkAreaChanged(callback);
    unsubscribe();
    emitScreenEvent('display-added');
    emitScreenEvent('display-removed');
    emitScreenEvent('display-metrics-changed');
    expect(callback).not.toHaveBeenCalled();
  });
});
