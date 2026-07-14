// Growth-mode settings persisted in the app's single state directory
// (CLAUDE.md: one app-support dir). Mode and connected-flags are NOT
// secrets — only key material goes to Keychain (see keychain.ts). Missing
// or corrupt file is treated as fresh (tokens mode, nothing connected) —
// never crashes the app. Same shape/atomic-write discipline as xp/store.ts.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../atomic-file';

export type Mode = 'tokens' | 'mrr';

export interface SettingsState {
  readonly mode: Mode;
  readonly stripeConnected: boolean;
  readonly revenuecatConnected: boolean;
}

const FILE_NAME = 'growth-settings.json';

function freshState(): SettingsState {
  return { mode: 'tokens', stripeConnected: false, revenuecatConnected: false };
}

function isValidState(value: unknown): value is SettingsState {
  if (typeof value !== 'object' || value === null) return false;
  const { mode, stripeConnected, revenuecatConnected } = value as Record<string, unknown>;
  return (
    (mode === 'tokens' || mode === 'mrr') &&
    typeof stripeConnected === 'boolean' &&
    typeof revenuecatConnected === 'boolean'
  );
}

export function loadSettingsState(stateDir: string): SettingsState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isValidState(parsed) ? parsed : freshState();
  } catch {
    return freshState();
  }
}

export function saveSettingsState(stateDir: string, state: SettingsState): void {
  atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
