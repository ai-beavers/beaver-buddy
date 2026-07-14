// Tuning module for the roam/animation system (CLAUDE.md "Code style" rule:
// tuning values live here, never as magic numbers in roam.ts/sprites.ts
// logic). Two clocks, two constants: SPRITE_FPS drives the sprite-frame
// accumulator; movement uses real elapsed time via rAF, not a fixed Hz.

// Matches the "fps" hint recorded in every assets/sprites/*.json sheet.
export const SPRITE_FPS = 10;

// Matches the tile size fixed by assets/STYLE.md.
export const BEAVER_TILE_PX = 48;

// Integer nearest-neighbor blit scale for every sprite tile (canvas has
// imageSmoothingEnabled=false) — must stay an integer or pixel art blurs.
// 48px art x2 -> 96px on screen (product-requested pet size).
export const PET_SCALE = 2;

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

// Hatch onboarding sequence tuning (lodge-idle -> shake -> burst ->
// baby-appear -> done). The hatch always plays in the bottom-left corner;
// the margin below is its only placement tuning.
export const HATCH_LODGE_TILE_PX = 48; // assets/STYLE.md: lodge + particles are 48x48 tiles
export const HATCH_CORNER_MARGIN_PX = 8; // gap from the screen edge the lodge/baby sits at

export const HATCH_LODGE_IDLE_DURATION_S = 0.8;

// Escalating shake: HATCH_SHAKE_BURST_COUNT bursts of active jitter, each
// separated by a pause that shrinks from *_PAUSE_START_S to *_PAUSE_END_S —
// the Pokemon hatch rhythm. Jitter amplitude ramps HATCH_SHAKE_JITTER_MIN_PX
// -> HATCH_SHAKE_JITTER_MAX_PX across the bursts, monotone non-decreasing.
export const HATCH_SHAKE_BURST_COUNT = 4;
export const HATCH_SHAKE_BURST_ACTIVE_S = 0.4;
export const HATCH_SHAKE_PAUSE_START_S = 0.6;
export const HATCH_SHAKE_PAUSE_END_S = 0.2;
export const HATCH_SHAKE_JITTER_MIN_PX = 1;
export const HATCH_SHAKE_JITTER_MAX_PX = 4;

export const HATCH_BURST_DURATION_S = 0.7;
// Sparks radiate outward from the lodge center on deterministic angles (no
// physics/particle system) — count is seeded per-run within this range.
export const HATCH_SPARK_COUNT_MIN = 4;
export const HATCH_SPARK_COUNT_MAX = 6;
export const HATCH_SPARK_SPEED_PX_S = 40;

export const HATCH_BABY_APPEAR_DURATION_S = 1.0;

// Quip speech-bubble tuning: a pixel-snapped rounded rect + tail
// drawn above the pet. BUBBLE_CHAR_WIDTH_PX is a fixed-width approximation
// of the monospace canvas font's glyph advance — bubble.ts's wrap/clamp
// layout math needs to stay pure (no canvas ctx.measureText access) so it's
// unit-testable, hence an approximated width instead of a measured one.
export const BUBBLE_FONT_PX = 8;
export const BUBBLE_CHAR_WIDTH_PX = 5;
export const BUBBLE_MAX_CHARS_PER_LINE = 24;
export const BUBBLE_LINE_HEIGHT_PX = 10;
export const BUBBLE_PADDING_PX = 4;
export const BUBBLE_TAIL_SIZE_PX = 3;
// Gap between the pet tile's top edge and the bubble's bottom edge (the tail
// occupies part of this gap).
export const BUBBLE_OFFSET_ABOVE_PET_PX = 6;
