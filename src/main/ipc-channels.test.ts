import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAUSE_CHANGED_CHANNEL } from './ipc-channels';

// preload.ts runs sandboxed and cannot require sibling modules, so it carries
// a hand-synced copy of the channel literal instead of importing it. The
// preload also can't be imported under vitest (it needs Electron's
// contextBridge), so the honest check is a source-text assertion: this test
// fails if the two literals ever drift.
describe('ipc-channels drift guard', () => {
  it('preload.ts hand-synced channel literal matches PAUSE_CHANGED_CHANNEL', () => {
    const source = readFileSync('src/main/preload.ts', 'utf8');
    const match = source.match(/const PAUSE_CHANGED_CHANNEL = '([^']*)'/);
    expect(match?.[1]).toBe(PAUSE_CHANGED_CHANNEL);
  });
});
