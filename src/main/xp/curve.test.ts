import { describe, expect, it } from 'vitest';
import { FUTURE_STAGE_LEVELS, levelForXp, stageForLevel, xpForLevel, XP_PER_LEVEL } from './curve';

describe('curve: level/xp boundaries', () => {
  it('level 1 starts at 0 xp', () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it('level exactly on a threshold maps back to the same xp', () => {
    for (const level of [1, 5, 15, 16, 31, 32, 50]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
    }
  });

  it('one xp short of a level threshold stays at the lower level', () => {
    const threshold = xpForLevel(16);
    expect(levelForXp(threshold - 1)).toBe(15);
    expect(levelForXp(threshold)).toBe(16);
  });
});

describe('curve: stage anchors', () => {
  it('15 -> 16 crosses baby -> teen', () => {
    expect(stageForLevel(15)).toBe('baby');
    expect(stageForLevel(16)).toBe('teen');
  });

  it('31 -> 32 crosses teen -> adult', () => {
    expect(stageForLevel(31)).toBe('teen');
    expect(stageForLevel(32)).toBe('adult');
  });

  it('level 1 is baby', () => {
    expect(stageForLevel(1)).toBe('baby');
  });

  it('stays adult beyond 32 — no further Stage values exist yet', () => {
    expect(stageForLevel(63)).toBe('adult');
    expect(stageForLevel(64)).toBe('adult');
    expect(stageForLevel(1000)).toBe('adult');
  });
});

describe('curve: doubling beyond 32', () => {
  it('future stage levels double', () => {
    expect(FUTURE_STAGE_LEVELS[0]).toBe(64);
    expect(FUTURE_STAGE_LEVELS[1]).toBe(FUTURE_STAGE_LEVELS[0] * 2);
    expect(FUTURE_STAGE_LEVELS[2]).toBe(FUTURE_STAGE_LEVELS[1] * 2);
  });
});

describe('curve: monotonicity', () => {
  it('levelForXp never decreases as xp grows', () => {
    let prev = levelForXp(0);
    for (let xp = 0; xp <= XP_PER_LEVEL * 40; xp += 7) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('xpForLevel never decreases as level grows', () => {
    let prev = xpForLevel(1);
    for (let level = 1; level <= 40; level++) {
      const xp = xpForLevel(level);
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });

  it('stageForLevel never regresses to an earlier stage as level grows', () => {
    const rank: Record<string, number> = { baby: 0, teen: 1, adult: 2 };
    let prev = 0;
    for (let level = 1; level <= 100; level++) {
      const r = rank[stageForLevel(level)];
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});
