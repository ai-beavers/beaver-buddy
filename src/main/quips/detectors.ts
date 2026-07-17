// Pure state machine: fed periodic (nowMs, lifetimeTokens, todayTokens)
// snapshots from the usage tracker, emits quip trigger events. No
// timers/Electron access of its own — main.ts drives it off
// UsageTracker.onTick (the tracker's existing refresh cadence), so there's
// no second polling loop.

import { CODING_SESSION_LENGTH_MIN, IDLE_LENGTH_MIN, SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY, SPEND_TIER_OK_MIN_TOKENS_PER_DAY } from './quip-config';
import type { QuipTrigger } from './quips';
import { localDateKey } from '../usage/totals';

export type SpendTier = 'spendWeak' | 'spendOk' | 'spendCrazy';

export interface DetectorSnapshot {
  readonly nowMs: number;
  readonly lifetimeTokens: number;
  readonly todayTokens: number;
}

export interface DetectorState {
  readonly lastSnapshot: DetectorSnapshot | null;
  readonly activeSinceMs: number | null; // start of the current nonzero-delta streak
  readonly codingSessionFired: boolean; // fired once for the current streak
  readonly idleSinceMs: number | null; // start of the current zero-delta streak
  readonly idleFired: boolean; // fired once for the current streak
  readonly lastSpendTier: SpendTier | null; // highest tier announced today
  readonly spendTierDateKey: string | null; // local YYYY-MM-DD of lastSpendTier
}

export function createDetectorState(): DetectorState {
  return {
    lastSnapshot: null,
    activeSinceMs: null,
    codingSessionFired: false,
    idleSinceMs: null,
    idleFired: false,
    lastSpendTier: null,
    spendTierDateKey: null,
  };
}

export interface DetectorResult {
  readonly state: DetectorState;
  readonly events: readonly QuipTrigger[];
}

const MS_PER_MIN = 60_000;

const TIER_RANK: Readonly<Record<SpendTier, number>> = {
  spendWeak: 1,
  spendOk: 2,
  spendCrazy: 3,
};

// Classifies today's cumulative token total into a spend tier. Returns null
// below 1 token (idle/no-activity days stay on the separate idle trigger).
export function classifySpendTier(todayTokens: number): SpendTier | null {
  if (todayTokens < 1) return null;
  if (todayTokens >= SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY) return 'spendCrazy';
  if (todayTokens >= SPEND_TIER_OK_MIN_TOKENS_PER_DAY) return 'spendOk';
  return 'spendWeak';
}

export function detectEvents(state: DetectorState, snapshot: DetectorSnapshot): DetectorResult {
  const { lastSnapshot } = state;
  if (!lastSnapshot) {
    // First snapshot establishes a baseline only — no delta to measure yet.
    // Spend tiers still evaluate today's cumulative total so a mid-day
    // launch can announce the tier the user is already in.
    const dateKey = localDateKey(snapshot.nowMs);
    const tier = classifySpendTier(snapshot.todayTokens);
    const events: QuipTrigger[] = tier ? [tier] : [];
    return {
      state: {
        ...state,
        lastSnapshot: snapshot,
        idleSinceMs: snapshot.nowMs,
        lastSpendTier: tier,
        spendTierDateKey: dateKey,
      },
      events,
    };
  }

  // Tolerates an arbitrarily long gap between polls (app was asleep,
  // display was off) — codingSession/idle measure wall-clock duration
  // from their streak-start timestamps, never assumed to be one fixed
  // poll tick.
  const delta = Math.max(0, snapshot.lifetimeTokens - lastSnapshot.lifetimeTokens);

  const events: QuipTrigger[] = [];

  // Spend-tier crossing: fire once when today's cumulative total climbs
  // into a higher tier. Resets at local midnight (new date key).
  const dateKey = localDateKey(snapshot.nowMs);
  let { lastSpendTier, spendTierDateKey } = state;
  if (spendTierDateKey !== dateKey) {
    lastSpendTier = null;
    spendTierDateKey = dateKey;
  }
  const tier = classifySpendTier(snapshot.todayTokens);
  if (tier !== null) {
    const prevRank = lastSpendTier ? TIER_RANK[lastSpendTier] : 0;
    if (TIER_RANK[tier] > prevRank) {
      events.push(tier);
      lastSpendTier = tier;
    }
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

  return {
    state: {
      lastSnapshot: snapshot,
      activeSinceMs,
      codingSessionFired,
      idleSinceMs,
      idleFired,
      lastSpendTier,
      spendTierDateKey,
    },
    events,
  };
}
