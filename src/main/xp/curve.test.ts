import { describe, expect, it } from 'vitest';
import { LEVEL_XP_THRESHOLDS, levelForXp, stageForLevel, xpForLevel, XP_PER_1K_TOKENS } from './curve';

describe('curve: level/xp boundaries', () => {
  it('level 1 starts at 0 xp', () => {
    expect(levelForXp(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it('level exactly on a threshold maps back to the same level', () => {
    for (const level of [1, 2, 5, 15, 16, 25, 32]) {
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
  it('levels 1–4 are baby', () => {
    expect(stageForLevel(1)).toBe('baby');
    expect(stageForLevel(4)).toBe('baby');
  });

  it('levels 5–8 are young-baby', () => {
    expect(stageForLevel(5)).toBe('young-baby');
    expect(stageForLevel(8)).toBe('young-baby');
  });

  it('levels 9–16 are teen', () => {
    expect(stageForLevel(9)).toBe('teen');
    expect(stageForLevel(16)).toBe('teen');
  });

  it('levels 17–24 are older-teen', () => {
    expect(stageForLevel(17)).toBe('older-teen');
    expect(stageForLevel(24)).toBe('older-teen');
  });

  it('levels 25–32 are adult', () => {
    expect(stageForLevel(25)).toBe('adult');
    expect(stageForLevel(32)).toBe('adult');
  });

  it('crosses stage boundaries at the spec anchors', () => {
    expect(stageForLevel(4)).toBe('baby');
    expect(stageForLevel(5)).toBe('young-baby');
    expect(stageForLevel(8)).toBe('young-baby');
    expect(stageForLevel(9)).toBe('teen');
    expect(stageForLevel(16)).toBe('teen');
    expect(stageForLevel(17)).toBe('older-teen');
    expect(stageForLevel(24)).toBe('older-teen');
    expect(stageForLevel(25)).toBe('adult');
  });
});

describe('curve: no cap — formula extends past L32', () => {
  it('levels extend beyond 32 via the quadratic formula', () => {
    expect(levelForXp(200_000)).toBeGreaterThan(32);
    expect(levelForXp(1_000_000)).toBeGreaterThan(32);
    expect(levelForXp(1_761_203)).toBeGreaterThan(100);
  });

  it('levelForXp is consistent with xpForLevel roundtrip past 32', () => {
    for (const level of [33, 50, 100, 200]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
    }
  });

  it('xpForLevel has no upper cap — grows with level', () => {
    const l32 = xpForLevel(32);
    const l50 = xpForLevel(50);
    const l100 = xpForLevel(100);
    expect(l50).toBeGreaterThan(l32);
    expect(l100).toBeGreaterThan(l50);
  });

  it('each successive level is progressively harder (quadratic)', () => {
    const delta31_32 = xpForLevel(32) - xpForLevel(31);
    const delta1_4 = xpForLevel(4) - xpForLevel(1);
    expect(delta31_32).toBeGreaterThan(delta1_4);
  });

  it('table (L1-L32 reference) is strictly increasing', () => {
    for (let i = 1; i < LEVEL_XP_THRESHOLDS.length; i += 1) {
      expect(LEVEL_XP_THRESHOLDS[i]).toBeGreaterThan(LEVEL_XP_THRESHOLDS[i - 1]);
    }
  });

  it('table matches the derived formula for every level', () => {
    expect(LEVEL_XP_THRESHOLDS[0]).toBe(0);
    for (let level = 2; level <= 32; level += 1) {
      const expected = Math.round((120_000 * level * level) / (32 * 32));
      expect(LEVEL_XP_THRESHOLDS[level - 1]).toBe(expected);
    }
  });

  it('has 32 entries with the spec total at index 31', () => {
    expect(LEVEL_XP_THRESHOLDS).toHaveLength(32);
    expect(LEVEL_XP_THRESHOLDS[31]).toBe(120_000);
  });
});

describe('curve: monotonicity', () => {
  it('levelForXp never decreases as xp grows', () => {
    let prev = levelForXp(0);
    for (let xp = 0; xp <= 200_000; xp += 113) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('xpForLevel never decreases as level grows', () => {
    let prev = xpForLevel(1);
    for (let level = 1; level <= 40; level += 1) {
      const xp = xpForLevel(level);
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });

  it('stageForLevel never regresses to an earlier stage as level grows', () => {
    const rank: Record<string, number> = { baby: 0, 'young-baby': 1, teen: 2, 'older-teen': 3, adult: 4 };
    let prev = 0;
    for (let level = 1; level <= 100; level += 1) {
      const r = rank[stageForLevel(level)];
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});

describe('curve: XP-per-token constant', () => {
  it('XP_PER_1K_TOKENS is defined exactly once and equals 5', () => {
    expect(XP_PER_1K_TOKENS).toBe(5);
  });
});
