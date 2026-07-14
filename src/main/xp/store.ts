// Atomic JSON persistence for XP state in the app's single state directory
// (CLAUDE.md: one app-support dir; deleting it = factory reset). Missing or
// corrupt file is treated as fresh state — never crashes the app.

import fs from 'node:fs';
import path from 'node:path';

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

// tmp+rename so readers (and a crash mid-write) never observe a partial
// file — rename is atomic on the same filesystem, which app.getPath
// ('userData') always is relative to its own directory.
export function saveState(stateDir: string, state: XpState): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = path.join(stateDir, FILE_NAME);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state));
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // best-effort cleanup only — the write error itself is what matters
    }
    throw error;
  }
}
