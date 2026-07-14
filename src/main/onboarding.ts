// Tracks whether the one-time hatch onboarding sequence has already run,
// persisted in the app's single state directory (CLAUDE.md: one app-support
// dir; deleting it = factory reset). Missing or corrupt file is treated as
// not-yet-hatched — never crashes the app. Same shape/atomic-write
// discipline as xp/store.ts, sharing the tmp+rename helper.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-file';

export interface OnboardingState {
  readonly hatched: boolean;
}

const FILE_NAME = 'onboarding-state.json';

function freshState(): OnboardingState {
  return { hatched: false };
}

function isValidState(value: unknown): value is OnboardingState {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).hatched === 'boolean';
}

export function loadOnboardingState(stateDir: string): OnboardingState {
  const filePath = path.join(stateDir, FILE_NAME);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isValidState(parsed) ? parsed : freshState();
  } catch {
    return freshState();
  }
}

export function saveOnboardingState(stateDir: string, state: OnboardingState): void {
  atomicWriteFile(stateDir, FILE_NAME, JSON.stringify(state));
}
