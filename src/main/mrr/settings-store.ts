// Growth-mode settings persisted in the app's single state directory
// (CLAUDE.md: one app-support dir). Mode and connected-flags are NOT
// secrets — only key material goes to Keychain (see keychain.ts). Missing
// or corrupt file is treated as fresh (tokens mode, nothing connected) —
// never crashes the app. Same shape/atomic-write discipline as xp/store.ts.
//
// claudeEnabled / codexEnabled are explicit opt-ins: local logs may exist,
// but a source only counts (and shows as connected) after the user clicks
// Connect. Defaults false — never auto-connect on first launch.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from '../atomic-file';

export type Mode = 'tokens' | 'mrr';

export interface SettingsState {
  readonly mode: Mode;
  readonly stripeConnected: boolean;
  readonly revenuecatConnected: boolean;
  readonly claudeEnabled: boolean;
  readonly codexEnabled: boolean;
}

const FILE_NAME = 'growth-settings.json';

export function freshState(): SettingsState {
  return {
    mode: 'tokens',
    stripeConnected: false,
    revenuecatConnected: false,
    claudeEnabled: false,
    codexEnabled: false,
  };
}

function isValidState(value: unknown): value is SettingsState {
  if (typeof value !== 'object' || value === null) return false;
  const { mode, stripeConnected, revenuecatConnected, claudeEnabled, codexEnabled } = value as Record<
    string,
    unknown
  >;
  return (
    (mode === 'tokens' || mode === 'mrr') &&
    typeof stripeConnected === 'boolean' &&
    typeof revenuecatConnected === 'boolean' &&
    typeof claudeEnabled === 'boolean' &&
    typeof codexEnabled === 'boolean'
  );
}

// Older growth-settings.json files lack the opt-in flags — migrate in place
// as disabled (never treat pre-existing logs as already connected).
function migrateState(value: unknown): SettingsState | null {
  if (typeof value !== 'object' || value === null) return null;
  const obj = value as Record<string, unknown>;
  if (obj.mode !== 'tokens' && obj.mode !== 'mrr') return null;
  if (typeof obj.stripeConnected !== 'boolean' || typeof obj.revenuecatConnected !== 'boolean') return null;
  return {
    mode: obj.mode,
    stripeConnected: obj.stripeConnected,
    revenuecatConnected: obj.revenuecatConnected,
    claudeEnabled: typeof obj.claudeEnabled === 'boolean' ? obj.claudeEnabled : false,
    codexEnabled: typeof obj.codexEnabled === 'boolean' ? obj.codexEnabled : false,
  };
}

export function loadSettingsState(stateDir: string): SettingsState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (isValidState(parsed)) return parsed;
    const migrated = migrateState(parsed);
    if (migrated) {
      saveSettingsState(stateDir, migrated);
      return migrated;
    }
    return freshState();
  } catch {
    return freshState();
  }
}

export function saveSettingsState(stateDir: string, state: SettingsState): void {
  atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
