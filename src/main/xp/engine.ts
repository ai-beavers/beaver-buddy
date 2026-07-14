// XP accrual + evolution detection. Subscribes to the BL-5 usage tracker's
// lifetime token total through a durable, forward-only cursor
// (lastSeenLifetimeTokens) so restarts, log rotation, and re-scans can never
// double-count XP: delta is always max(0, total - lastSeen), and the cursor
// itself only ever moves forward.

import { levelForXp, stageForLevel, TOKENS_PER_XP, type Stage } from './curve';
import { loadState, saveState, type XpState } from './store';
import type { UsageTotals } from '../usage/totals';

export interface PetState {
  readonly xp: number;
  readonly level: number;
  readonly stage: Stage;
}

// IPC/tray push payload: `stage` is what should be rendered right now (the
// pre-evolution stage while a transition is in flight); `evolvingTo` is set
// only on the update that crosses a stage boundary.
export interface PetUpdate {
  readonly level: number;
  readonly stage: Stage;
  readonly evolvingTo?: Stage;
}

// Structural subset of UsageTracker — lets tests inject a fake without
// touching real usage-log files or a real Electron process.
export interface TrackerLike {
  getTotals(): UsageTotals;
  onChange(callback: (totals: UsageTotals) => void): () => void;
}

export class XpEngine {
  private readonly stateDir: string;
  private state: XpState;
  private readonly listeners = new Set<(update: PetUpdate) => void>();

  constructor(stateDir: string, initial: XpState = loadState(stateDir)) {
    this.stateDir = stateDir;
    this.state = initial;
  }

  getState(): PetState {
    const level = levelForXp(this.state.xp);
    return { xp: this.state.xp, level, stage: stageForLevel(level) };
  }

  // Returns an unsubscribe function.
  onUpdate(callback: (update: PetUpdate) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Wires the BL-5 tracker: applies whatever it has already scanned once,
  // then every subsequent change. Returns an unsubscribe function.
  attachTracker(tracker: TrackerLike): () => void {
    const unsubscribe = tracker.onChange((totals) => this.ingestLifetimeTokens(totals.lifetime.totalTokens));
    this.ingestLifetimeTokens(tracker.getTotals().lifetime.totalTokens);
    return unsubscribe;
  }

  ingestLifetimeTokens(totalTokens: number): void {
    const delta = Math.max(0, totalTokens - this.state.lastSeenLifetimeTokens);
    if (delta === 0) return; // cursor only moves forward — no double count
    this.applyXp(delta / TOKENS_PER_XP, totalTokens);
  }

  // Dev-only acceptance path (--inject-xp): goes through the same
  // persist/level/evolution logic as real accrual, but leaves the token
  // cursor untouched so it can never mask or double-count real usage.
  injectXp(amount: number): void {
    if (!(amount > 0)) return;
    this.applyXp(amount, this.state.lastSeenLifetimeTokens);
  }

  private applyXp(deltaXp: number, lastSeenLifetimeTokens: number): void {
    const before = this.getState();
    this.state = { xp: this.state.xp + deltaXp, lastSeenLifetimeTokens };
    saveState(this.stateDir, this.state);
    const after = this.getState();
    const evolvingTo = after.stage !== before.stage ? after.stage : undefined;
    const update: PetUpdate = { level: after.level, stage: evolvingTo ? before.stage : after.stage, evolvingTo };
    for (const listener of this.listeners) listener(update);
  }
}
