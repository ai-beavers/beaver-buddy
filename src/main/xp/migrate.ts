import { XP_PER_1K_TOKENS } from './curve';
import { weightForModel } from './weights';
import { loadState, saveState, type XpState } from './store';
import type { UsageTotals } from '../usage/totals';

// One-time migration from the old single cursor (v1) to the per-model v2
// state. The old cursor was polluted by cache tokens, so this migration
// deliberately breaks it once: it recomputes XP from the new, cache-free
// lifetimeByModel totals and sets per-model cursors to the same totals,
// making the next ingest delta-zero. Idempotent: once schemaVersion is 2,
// migrateIfNeeded returns immediately.
export async function migrateIfNeeded(stateDir: string, totals: UsageTotals): Promise<void> {
  const state: XpState = loadState(stateDir);
  if (state.schemaVersion === 2) return;

  let xp = 0;
  const lastSeenByModel: Record<string, number> = {};

  for (const [model, tokens] of totals.lifetimeByModel) {
    const total = tokens.inputTokens + tokens.outputTokens;
    lastSeenByModel[model] = total;
    xp += (total / 1000) * XP_PER_1K_TOKENS * weightForModel(model);
  }

  await saveState(stateDir, {
    xp,
    lastSeenByModel,
    lastMrrAwardDate: state.lastMrrAwardDate ?? null,
    schemaVersion: 2,
  });
}
