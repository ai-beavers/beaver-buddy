// Atomic JSON persistence for XP state in the app's single state directory
// (CLAUDE.md: one app-support dir; deleting it = factory reset). Missing or
// corrupt file is treated as fresh v2 state — never crashes the app.
//
// v2 stores per-model forward-only cursors so log rotation and cache tokens
// can never pollute the delta calculation. v1 files (lastSeenLifetimeTokens,
// no schemaVersion) are loaded as a migration sentinel and then rewritten by
// migrate.ts.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../atomic-file';

export interface XpStateV2 {
  readonly xp: number;
  readonly lastSeenByModel: Record<string, number>;
  // Local date ("YYYY-MM-DD") the MRR growth mode last awarded XP, or null
  // if it never has. Persists across mode switches so tokens<->mrr can
  // never re-award the same day's MRR twice (see mrr-engine.ts).
  readonly lastMrrAwardDate: string | null;
  readonly schemaVersion: 2;
}

// Loader-internal sentinel for a pre-v2 file that needs migration.
export interface XpStateV1 {
  readonly xp: number;
  readonly lastSeenLifetimeTokens: number;
  readonly lastMrrAwardDate: string | null;
  readonly schemaVersion: 1;
}

export type XpState = XpStateV2 | XpStateV1;

const FILE_NAME = 'xp-state.json';

function freshV2State(): XpStateV2 {
  return { xp: 0, lastSeenByModel: {}, lastMrrAwardDate: null, schemaVersion: 2 };
}

function isXpStateV2(value: unknown): value is XpStateV2 {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 2) return false;
  if (typeof record.xp !== 'number' || !Number.isFinite(record.xp) || record.xp < 0) return false;
  if (typeof record.lastMrrAwardDate !== 'string' && record.lastMrrAwardDate !== null) return false;
  if (typeof record.lastSeenByModel !== 'object' || record.lastSeenByModel === null) return false;
  for (const cursor of Object.values(record.lastSeenByModel)) {
    if (typeof cursor !== 'number' || !Number.isFinite(cursor) || cursor < 0) return false;
  }
  return true;
}

function isXpStateV1(value: unknown): value is Omit<XpStateV1, 'schemaVersion'> & { schemaVersion?: number } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  // v1 files have no schemaVersion (or a non-2 value) and carry the old
  // single cursor. They must be migrated before the engine can ingest deltas.
  if (record.schemaVersion === 2) return false;
  if (typeof record.xp !== 'number' || !Number.isFinite(record.xp) || record.xp < 0) return false;
  if (typeof record.lastSeenLifetimeTokens !== 'number' || !Number.isFinite(record.lastSeenLifetimeTokens) || record.lastSeenLifetimeTokens < 0) return false;
  if (record.lastMrrAwardDate !== undefined && record.lastMrrAwardDate !== null && typeof record.lastMrrAwardDate !== 'string') return false;
  return true;
}

export function loadState(stateDir: string): XpState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (isXpStateV2(parsed)) return parsed;
    if (isXpStateV1(parsed)) {
      return {
        xp: parsed.xp,
        lastSeenLifetimeTokens: parsed.lastSeenLifetimeTokens,
        lastMrrAwardDate: parsed.lastMrrAwardDate ?? null,
        schemaVersion: 1,
      };
    }
    return freshV2State();
  } catch {
    return freshV2State();
  }
}

export async function saveState(stateDir: string, state: XpStateV2): Promise<void> {
  await atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
