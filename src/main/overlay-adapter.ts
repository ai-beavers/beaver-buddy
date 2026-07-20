import { BrowserWindow, screen, type Display } from 'electron';

export type TaskbarEdge = 'top' | 'bottom' | 'left' | 'right' | 'none';

export interface WorkAreaInfo {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly taskbarEdge: TaskbarEdge;
}

export type CaptureMode = 'hover-forward' | 'full-capture';

export function isValidCaptureMode(value: unknown): value is CaptureMode {
  return value === 'hover-forward' || value === 'full-capture';
}

/**
 * Switches the overlay between click-through hover tracking and full input
 * capture. 'hover-forward' keeps clicks passing through to the desktop while
 * still receiving mouse-move events; 'full-capture' captures all mouse input
 * so the pet can be grabbed and dragged.
 */
export function setCaptureMode(win: BrowserWindow, mode: CaptureMode): void {
  if (mode === 'hover-forward') {
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    win.setIgnoreMouseEvents(false);
  }
}

/**
 * Detects which screen edge hosts the taskbar by comparing the display's
 * full bounds with its work area. When the taskbar is set to auto-hide,
 * Windows typically reports workArea identical to bounds, so this returns
 * 'none'. That auto-hide case is instead mitigated by effectiveWorkArea(),
 * which pulls the overlay a few DIP off every screen edge so the shell's
 * auto-hide trigger strip stays reachable. The opening taskbar may still
 * briefly cover the beaver — documented Windows system behavior.
 */
export function detectTaskbarEdge(bounds: Electron.Rectangle, workArea: Electron.Rectangle): TaskbarEdge {
  if (workArea.y > bounds.y) return 'top';
  if (workArea.x > bounds.x) return 'left';
  if (workArea.x + workArea.width < bounds.x + bounds.width) return 'right';
  if (workArea.y + workArea.height < bounds.y + bounds.height) return 'bottom';
  return 'none';
}

// Inset in DIP, applied on Windows when workArea === bounds (taskbar
// auto-hidden): pulls the overlay off every screen edge so the shell's
// auto-hide trigger strip stays reachable. The opening taskbar may still
// briefly cover the beaver — documented Windows system behavior.
const AUTO_HIDE_INSET_DIP = 2;

export function effectiveWorkArea(display: Display): Electron.Rectangle {
  const { bounds, workArea } = display;
  const autoHide =
    workArea.x === bounds.x &&
    workArea.y === bounds.y &&
    workArea.width === bounds.width &&
    workArea.height === bounds.height;
  if (process.platform === 'win32' && autoHide) {
    return {
      x: workArea.x + AUTO_HIDE_INSET_DIP,
      y: workArea.y + AUTO_HIDE_INSET_DIP,
      width: Math.max(1, workArea.width - 2 * AUTO_HIDE_INSET_DIP),
      height: Math.max(1, workArea.height - 2 * AUTO_HIDE_INSET_DIP),
    };
  }
  return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height };
}

function toWorkAreaInfo(display: Display): WorkAreaInfo {
  const effective = effectiveWorkArea(display);
  return {
    x: effective.x,
    y: effective.y,
    width: effective.width,
    height: effective.height,
    taskbarEdge: detectTaskbarEdge(display.bounds, display.workArea),
  };
}

export function getPrimaryWorkAreaInfo(): WorkAreaInfo {
  return toWorkAreaInfo(screen.getPrimaryDisplay());
}

/**
 * Returns the bounds the overlay window should occupy for a given display.
 * The window is sized to the work area so the beaver never wanders behind
 * a visible taskbar.
 */
export function getOverlayWindowBounds(display: Display): Electron.Rectangle {
  return effectiveWorkArea(display);
}

/**
 * Chooses the always-on-top level per platform.
 *
 * macOS: 'floating' keeps the overlay above normal apps while staying below
 *        system-modal UI.
 * Windows: 'normal' makes the window HWND_TOPMOST. Empirical testing is
 *          required to confirm it stays above the taskbar; if it does not,
 *          'pop-up-menu' is the documented fallback. We start with 'normal'
 *          because it is the least intrusive topmost level that still places
 *          the window above ordinary applications.
 */
export function configureAlwaysOnTop(win: BrowserWindow): void {
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(true, 'normal');
  }
}

/**
 * Resizes/moves the overlay to the given work area immediately.
 * No animation is used: Electron window animation on a transparent,
 * click-through overlay can cause flicker and desynchronises the renderer
 * (window.innerWidth/innerHeight updates asynchronously during the
 * animation). The beaver moves itself smoothly inside the new bounds via the
 * roaming state machine.
 */
export function fitWindowToWorkArea(win: BrowserWindow, info: WorkAreaInfo): void {
  win.setBounds(
    {
      x: info.x,
      y: info.y,
      width: info.width,
      height: info.height,
    },
    false,
  );
}

/**
 * Subscribes to display changes that can affect the available work area.
 * The callback receives the new primary-display work area info.
 */
export function onWorkAreaChanged(callback: (info: WorkAreaInfo) => void): () => void {
  const handler = () => callback(getPrimaryWorkAreaInfo());
  screen.on('display-added', handler);
  screen.on('display-removed', handler);
  screen.on('display-metrics-changed', handler);
  return () => {
    screen.off('display-added', handler);
    screen.off('display-removed', handler);
    screen.off('display-metrics-changed', handler);
  };
}
