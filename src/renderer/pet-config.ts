// Tuning module for the roam/animation system (CLAUDE.md "Code style" rule:
// tuning values live here, never as magic numbers in roam.ts/sprites.ts
// logic). Two clocks, two constants: SPRITE_FPS drives the sprite-frame
// accumulator; movement uses real elapsed time via rAF, not a fixed Hz.

// Matches the "fps" hint recorded in every assets/sprites/*.json sheet.
export const SPRITE_FPS = 10;

// Matches the tile size fixed by assets/STYLE.md.
export const BEAVER_TILE_PX = 32;

export const WALK_SPEED_PX_S = 24;
export const RUN_SPEED_PX_S = 64;
export const CLIMB_SPEED_PX_S = 20;

// Per-tick dt is clamped to this before any movement/timer math runs, so a
// stalled or throttled rAF frame (window occluded, laptop woke from sleep)
// can never move the beaver more than a bounded step — no teleports.
export const MAX_DT_S = 0.25;

export const IDLE_PAUSE_MIN_S = 2;
export const IDLE_PAUSE_MAX_S = 6;

export const SLEEP_PAUSE_MIN_S = 8;
export const SLEEP_PAUSE_MAX_S = 20;
export const SLEEP_PROBABILITY = 0.08;

export const RUN_PROBABILITY = 0.25;

export const EDGE_THRESHOLD_PX = 4;
export const EDGE_TARGET_PROBABILITY = 0.3;
export const CLIMB_PROBABILITY = 0.35;
export const CLIMB_HEIGHT_MIN_PX = 40;
export const CLIMB_HEIGHT_MAX_PX = 160;
export const CLIMB_PAUSE_MIN_S = 1;
export const CLIMB_PAUSE_MAX_S = 3;

// "Close enough" to a walk/run/climb target to call it arrived.
export const TARGET_EPSILON_PX = 1;

export const ROTATION_LEFT_CLIMB_DEG = 90;
export const ROTATION_RIGHT_CLIMB_DEG = -90;

// Evolution sequence tuning (shake -> flash -> new stage -> celebrate).
export const EVOLUTION_SHAKE_DURATION_S = 1.2;
export const EVOLUTION_SHAKE_JITTER_PX = 2;
export const EVOLUTION_FLASH_BLINK_COUNT = 3;
// Duration of one full on/off blink cycle; the white silhouette is visible
// for the first half of each cycle.
export const EVOLUTION_FLASH_BLINK_DURATION_S = 0.2;
