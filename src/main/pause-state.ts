// Pure pause-state logic — no Electron imports, so it is unit-testable
// without a running app. Two independent flags compose into one effective
// paused value: `manual` is the tray Pause/Resume toggle, `system` is set by
// powerMonitor suspend/resume. A system resume only clears the auto-pause —
// it must never override a manual pause the user set before the machine
// slept.

export interface PauseState {
  readonly manual: boolean;
  readonly system: boolean;
}

export function createPauseState(): PauseState {
  return { manual: false, system: false };
}

export function isPaused(state: PauseState): boolean {
  return state.manual || state.system;
}

export function toggleManualPause(state: PauseState): PauseState {
  return { ...state, manual: !state.manual };
}

export function setSystemPause(state: PauseState, system: boolean): PauseState {
  return { ...state, system };
}
