import { describe, expect, it } from 'vitest';
import { createPauseState, isPaused, setSystemPause, toggleManualPause } from './pause-state';

describe('pause-state', () => {
  it('starts unpaused', () => {
    expect(isPaused(createPauseState())).toBe(false);
  });

  it('toggle pauses and un-pauses manually', () => {
    let state = createPauseState();
    state = toggleManualPause(state);
    expect(isPaused(state)).toBe(true);
    state = toggleManualPause(state);
    expect(isPaused(state)).toBe(false);
  });

  it('system suspend pauses; system resume un-pauses', () => {
    let state = createPauseState();
    state = setSystemPause(state, true);
    expect(isPaused(state)).toBe(true);
    state = setSystemPause(state, false);
    expect(isPaused(state)).toBe(false);
  });

  it('resume never overrides a manual pause set before sleep', () => {
    let state = createPauseState();
    state = toggleManualPause(state); // user pauses
    state = setSystemPause(state, true); // machine sleeps
    state = setSystemPause(state, false); // machine wakes
    expect(isPaused(state)).toBe(true); // still paused — manual flag persists
  });

  it('manual resume during system sleep stays paused until system also resumes', () => {
    let state = createPauseState();
    state = setSystemPause(state, true); // machine sleeps (auto-pause)
    state = toggleManualPause(state); // user toggles pause on, then...
    state = toggleManualPause(state); // ...toggles it back off
    expect(isPaused(state)).toBe(true); // system flag still holds it paused
    state = setSystemPause(state, false);
    expect(isPaused(state)).toBe(false);
  });
});
