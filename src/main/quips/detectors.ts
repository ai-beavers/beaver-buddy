// Pure state machine: fed periodic (nowMs, lifetimeTokens) snapshots from
// the usage tracker, emits quip trigger events. No timers/Electron access of
// its own — main.ts drives it off UsageTracker.onTick (the tracker's
// existing refresh cadence), so there's no second polling loop.

import { CODING_SESSION_LENGTH_MIN, IDLE_LENGTH_MIN, TOKEN_SPIKE_RATE_PER_MIN } from './quip-config';
import type { QuipTrigger } from './quips';

export interface DetectorSnapshot {
  readonly nowMs: number;
  readonly lifetimeTokens: number;
}

export interface DetectorState {
  readonly lastSnapshot: DetectorSnapshot | null;
  readonly activeSinceMs: number | null; // start of the current nonzero-delta streak
  readonly codingSessionFired: boolean; // fired once for the current streak
  readonly idleSinceMs: number | null; // start of the current zero-delta streak
  readonly idleFired: boolean; // fired once for the current streak
}

export function createDetectorState(): DetectorState {
  return { lastSnapshot: null, activeSinceMs: null, codingSessionFired: false, idleSinceMs: null, idleFired: false };
}

export interface DetectorResult {
  readonly state: DetectorState;
  readonly events: readonly QuipTrigger[];
}

const MS_PER_MIN = 60_000;

export function detectEvents(state: DetectorState, snapshot: DetectorSnapshot): DetectorResult {
  const { lastSnapshot } = state;
  if (!lastSnapshot) {
    // First snapshot establishes a baseline only — no delta to measure yet.
    return { state: { ...state, lastSnapshot: snapshot, idleSinceMs: snapshot.nowMs }, events: [] };
  }

  const elapsedMs = snapshot.nowMs - lastSnapshot.nowMs;
  // Tolerates an arbitrarily long gap between polls (app was asleep,
  // display was off) — the rate is just measured over whatever interval
  // actually elapsed, never assumed to be one fixed poll tick.
  const delta = Math.max(0, snapshot.lifetimeTokens - lastSnapshot.lifetimeTokens);
  const elapsedMin = elapsedMs / MS_PER_MIN;
  const ratePerMin = elapsedMin > 0 ? delta / elapsedMin : 0;

  const events: QuipTrigger[] = [];
  if (ratePerMin > TOKEN_SPIKE_RATE_PER_MIN) {
    events.push('tokenSpike');
  }

  let { activeSinceMs, codingSessionFired, idleSinceMs, idleFired } = state;

  if (delta > 0) {
    idleSinceMs = null;
    idleFired = false;
    if (activeSinceMs === null) {
      activeSinceMs = snapshot.nowMs;
      codingSessionFired = false;
    } else if (!codingSessionFired && snapshot.nowMs - activeSinceMs >= CODING_SESSION_LENGTH_MIN * MS_PER_MIN) {
      events.push('codingSession');
      codingSessionFired = true;
    }
  } else {
    activeSinceMs = null;
    codingSessionFired = false;
    if (idleSinceMs === null) {
      idleSinceMs = snapshot.nowMs;
      idleFired = false;
    } else if (!idleFired && snapshot.nowMs - idleSinceMs >= IDLE_LENGTH_MIN * MS_PER_MIN) {
      events.push('idle');
      idleFired = true;
    }
  }

  return { state: { lastSnapshot: snapshot, activeSinceMs, codingSessionFired, idleSinceMs, idleFired }, events };
}
