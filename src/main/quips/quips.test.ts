import { describe, expect, it } from 'vitest';
import { QUIP_POOLS } from './quips';

// Data invariants the copy-tone review depends on (plan: "no emoji, no
// exclamation spam, <=60 chars each"). Catches a regression the next time
// someone edits the pools by hand.
describe('quip pools: copy invariants', () => {
  for (const [trigger, pool] of Object.entries(QUIP_POOLS)) {
    it(`${trigger}: has at least two lines (so no-immediate-repeat is meaningful)`, () => {
      expect(pool.length).toBeGreaterThanOrEqual(2);
    });

    it(`${trigger}: every line is <=60 chars (worst-case {stage} substitution)`, () => {
      for (const line of pool) {
        expect(line.replace('{stage}', 'adult').length).toBeLessThanOrEqual(60);
      }
    });

    it(`${trigger}: no emoji or exclamation marks`, () => {
      for (const line of pool) {
        expect(line).not.toMatch(/!/);
        expect(line).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      }
    });
  }
});
