// Pure state machine: (event, nowMs, rng) -> quip text or null. No DOM/
// Electron/filesystem access, so it's fully unit-testable (roam.ts pattern).
// Enforces two independent rules:
//  - one quip per QUIP_COOLDOWN_MS window, across all triggers;
//  - never repeats the immediately-previous quip shown for a given trigger's
//    pool (tracked by index, not text, so the evolution pool's {stage}
//    substitution doesn't defeat the repeat check).

import { QUIP_COOLDOWN_MS } from './quip-config';
import { QUIP_POOLS, type QuipTrigger } from './quips';
import type { Stage } from '../xp/curve';

export interface SchedulerState {
  readonly lastShownAtMs: number | null;
  readonly lastIndexByPool: ReadonlyMap<QuipTrigger, number>;
}

export function createSchedulerState(): SchedulerState {
  return { lastShownAtMs: null, lastIndexByPool: new Map() };
}

export interface SchedulerResult {
  readonly state: SchedulerState;
  readonly text: string | null;
}

// Deterministic single reroll on an immediate repeat, rather than looping
// until the rng disagrees — bounded, and still varied enough for a pool of
// canned lines.
function pickIndex(poolLength: number, lastIndex: number | undefined, rng: () => number): number {
  if (poolLength <= 1) return 0;
  const index = Math.floor(rng() * poolLength);
  return index === lastIndex ? (index + 1) % poolLength : index;
}

export function schedule(
  state: SchedulerState,
  trigger: QuipTrigger,
  nowMs: number,
  rng: () => number,
  evolvedStage?: Stage,
): SchedulerResult {
  if (state.lastShownAtMs !== null && nowMs - state.lastShownAtMs < QUIP_COOLDOWN_MS) {
    return { state, text: null };
  }

  const pool = QUIP_POOLS[trigger];
  const lastIndex = state.lastIndexByPool.get(trigger);
  const index = pickIndex(pool.length, lastIndex, rng);
  const template = pool[index];
  const text = trigger === 'evolution' && evolvedStage ? template.replace('{stage}', evolvedStage) : template;

  const lastIndexByPool = new Map(state.lastIndexByPool);
  lastIndexByPool.set(trigger, index);
  return { state: { lastShownAtMs: nowMs, lastIndexByPool }, text };
}
