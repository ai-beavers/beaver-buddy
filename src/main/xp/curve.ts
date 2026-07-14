// THE one constants file for the level curve — no other file holds curve
// numbers. Level cost is linear (XP_PER_LEVEL per level);
// stage boundaries are separate anchors on top of that curve so tuning one
// never silently moves the other.

export type Stage = 'baby' | 'teen' | 'adult';

// Tokens consumed per 1 XP earned — the only conversion from the usage
// tracker's raw lifetime token total into this module's XP currency.
export const TOKENS_PER_XP = 100;

// XP cost per level, flat across the whole curve.
export const XP_PER_LEVEL = 100;

// Level at which each currently-implemented stage begins.
const STAGE_ANCHORS: ReadonlyArray<{ readonly level: number; readonly stage: Stage }> = [
  { level: 1, stage: 'baby' },
  { level: 16, stage: 'teen' },
  { level: 32, stage: 'adult' },
];

// Levels where future stages beyond adult would begin, doubling onward.
// No Stage value exists for these yet (sprites.ts only defines baby/teen/
// adult) — stageForLevel caps at 'adult' until a new stage is added, but the
// level curve keeps growing so these levels stay meaningful once it is.
export const FUTURE_STAGE_LEVELS = [64, 128, 256] as const;

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

export function xpForLevel(level: number): number {
  return Math.max(0, (Math.max(1, level) - 1) * XP_PER_LEVEL);
}

export function stageForLevel(level: number): Stage {
  let stage: Stage = STAGE_ANCHORS[0].stage;
  for (const anchor of STAGE_ANCHORS) {
    if (level >= anchor.level) stage = anchor.stage;
  }
  return stage;
}
