// XP accrual + evolution detection. Subscribes to the usage tracker's
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

// Growth source, mirrored from settings-store.ts's Mode without importing
// it — xp/engine.ts stays independent of the mrr layer built on top of it.
export type GrowthMode = 'tokens' | 'mrr';

export class XpEngine {
  private readonly stateDir: string;
  private state: XpState;
  private lastUpdate: PetUpdate | null = null;
  private readonly listeners = new Set<(update: PetUpdate) => void>();
  private mode: GrowthMode = 'tokens';

  constructor(stateDir: string, initial: XpState = loadState(stateDir)) {
    this.stateDir = stateDir;
    this.state = initial;
  }

  // Gates ingestLifetimeTokens below — set from the persisted growth
  // settings at startup and on every settings:save mode change.
  setMode(mode: GrowthMode): void {
    this.mode = mode;
  }

  getLastMrrAwardDate(): string | null {
    return this.state.lastMrrAwardDate;
  }

  getState(): PetState {
    const level = levelForXp(this.state.xp);
    return { xp: this.state.xp, level, stage: stageForLevel(level) };
  }

  // The most recent emitted update, or a synthesized non-evolving snapshot
  // when nothing has been emitted yet. Lets a receiver that starts
  // listening late (a renderer page that finishes loading after launch-time
  // accrual already fired) catch up without losing an in-flight evolution —
  // the engine stays the single source of evolvingTo.
  getLastUpdate(): PetUpdate {
    if (this.lastUpdate) return this.lastUpdate;
    const { level, stage } = this.getState();
    return { level, stage };
  }

  // Returns an unsubscribe function.
  onUpdate(callback: (update: PetUpdate) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Wires the usage tracker: applies whatever it has already scanned once,
  // then every subsequent change. Returns an unsubscribe function.
  attachTracker(tracker: TrackerLike): () => void {
    const unsubscribe = tracker.onChange((totals) => this.ingestLifetimeTokens(totals.lifetime.totalTokens));
    this.ingestLifetimeTokens(tracker.getTotals().lifetime.totalTokens);
    return unsubscribe;
  }

  ingestLifetimeTokens(totalTokens: number): void {
    const delta = Math.max(0, totalTokens - this.state.lastSeenLifetimeTokens);
    if (delta === 0) return; // cursor only moves forward — no double count
    if (this.mode === 'mrr') {
      // Cursor keeps advancing silently — no XP award — so switching back
      // to tokens mode later can never retroactively award this history
      // (the no-double-count invariant holds in both switch directions).
      this.applyState({ lastSeenLifetimeTokens: totalTokens });
      return;
    }
    this.applyXp(delta / TOKENS_PER_XP, totalTokens);
  }

  // Dev-only acceptance path (--inject-xp): goes through the same
  // persist/level/evolution logic as real accrual, but leaves the token
  // cursor untouched so it can never mask or double-count real usage.
  injectXp(amount: number): void {
    if (!(amount > 0)) return;
    this.applyXp(amount, this.state.lastSeenLifetimeTokens);
  }

  // MRR growth-mode award path: applies XP and records the local date it
  // was awarded for, atomically (one saveState), so a poll that finds
  // mrr_dollars * rate rounds to 0 XP still records the date and is not
  // retried later the same day.
  awardMrr(xpAmount: number, localDate: string): void {
    this.applyState({ xp: this.state.xp + Math.max(0, xpAmount), lastMrrAwardDate: localDate });
  }

  private applyXp(deltaXp: number, lastSeenLifetimeTokens: number): void {
    this.applyState({ xp: this.state.xp + deltaXp, lastSeenLifetimeTokens });
  }

  private applyState(patch: Partial<XpState>): void {
    const before = this.getState();
    this.state = { ...this.state, ...patch };
    saveState(this.stateDir, this.state);
    const after = this.getState();
    const evolvingTo = after.stage !== before.stage ? after.stage : undefined;
    const update: PetUpdate = { level: after.level, stage: evolvingTo ? before.stage : after.stage, evolvingTo };
    this.lastUpdate = update;
    for (const listener of this.listeners) listener(update);
  }
}
