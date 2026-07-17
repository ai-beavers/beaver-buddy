// Atomic JSON persistence for XP state in the app's single state directory
// (CLAUDE.md: one app-support dir; deleting it = factory reset). Missing or
// corrupt file is treated as fresh state — never crashes the app.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../atomic-file';

export interface XpState {
  readonly xp: number;
  readonly lastSeenLifetimeTokens: number;
  // Local date ("YYYY-MM-DD") the MRR growth mode last awarded XP, or null
  // if it never has. Persists across mode switches so tokens<->mrr can
  // never re-award the same day's MRR twice (see mrr-engine.ts).
  readonly lastMrrAwardDate: string | null;
}

const FILE_NAME = 'xp-state.json';

function freshState(): XpState {
  return { xp: 0, lastSeenLifetimeTokens: 0, lastMrrAwardDate: null };
}

// Old files predate lastMrrAwardDate; missing means "never awarded", not
// "invalid" — the field is optional on read and always written back below.
function isValidState(value: unknown): value is Omit<XpState, 'lastMrrAwardDate'> & { lastMrrAwardDate?: string | null } {
  if (typeof value !== 'object' || value === null) return false;
  const { xp, lastSeenLifetimeTokens, lastMrrAwardDate } = value as Record<string, unknown>;
  return (
    typeof xp === 'number' &&
    Number.isFinite(xp) &&
    xp >= 0 &&
    typeof lastSeenLifetimeTokens === 'number' &&
    Number.isFinite(lastSeenLifetimeTokens) &&
    lastSeenLifetimeTokens >= 0 &&
    (lastMrrAwardDate === undefined || lastMrrAwardDate === null || typeof lastMrrAwardDate === 'string')
  );
}

export function loadState(stateDir: string): XpState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isValidState(parsed)) return freshState();
    return { xp: parsed.xp, lastSeenLifetimeTokens: parsed.lastSeenLifetimeTokens, lastMrrAwardDate: parsed.lastMrrAwardDate ?? null };
  } catch {
    return freshState();
  }
}

export async function saveState(stateDir: string, state: XpState): Promise<void> {
  await atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
