// Atomic JSON persistence for XP state in the app's single state directory
// (CLAUDE.md: one app-support dir; deleting it = factory reset). Missing or
// corrupt file is treated as fresh state — never crashes the app.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../atomic-file';

export interface XpState {
  readonly xp: number;
  readonly lastSeenLifetimeTokens: number;
}

const FILE_NAME = 'xp-state.json';

function freshState(): XpState {
  return { xp: 0, lastSeenLifetimeTokens: 0 };
}

function isValidState(value: unknown): value is XpState {
  if (typeof value !== 'object' || value === null) return false;
  const { xp, lastSeenLifetimeTokens } = value as Record<string, unknown>;
  return (
    typeof xp === 'number' &&
    Number.isFinite(xp) &&
    xp >= 0 &&
    typeof lastSeenLifetimeTokens === 'number' &&
    Number.isFinite(lastSeenLifetimeTokens) &&
    lastSeenLifetimeTokens >= 0
  );
}

export function loadState(stateDir: string): XpState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isValidState(parsed) ? parsed : freshState();
  } catch {
    return freshState();
  }
}

export function saveState(stateDir: string, state: XpState): void {
  atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
