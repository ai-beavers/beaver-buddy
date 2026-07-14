import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAUSE_CHANGED_CHANNEL, PET_CHANGED_CHANNEL } from './ipc-channels';

// preload.ts runs sandboxed and cannot require sibling modules, so it carries
// a hand-synced copy of each channel literal instead of importing them. The
// preload also can't be imported under vitest (it needs Electron's
// contextBridge), so the honest check is a source-text assertion: this test
// fails if any literal ever drifts.
describe('ipc-channels drift guard', () => {
  const source = readFileSync('src/main/preload.ts', 'utf8');

  it('preload.ts hand-synced channel literal matches PAUSE_CHANGED_CHANNEL', () => {
    const match = source.match(/const PAUSE_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(PAUSE_CHANGED_CHANNEL);
  });

  it('preload.ts hand-synced channel literal matches PET_CHANGED_CHANNEL', () => {
    const match = source.match(/const PET_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(PET_CHANGED_CHANNEL);
  });
});
