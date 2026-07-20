// Tuning module for the roam/animation system (CLAUDE.md "Code style" rule:
// tuning values live here, never as magic numbers in roam.ts/sprites.ts
// logic). Two clocks, two constants: SPRITE_FPS drives the sprite-frame
// accumulator; movement uses real elapsed time via rAF, not a fixed Hz.

// Matches the "fps" hint recorded in assets/sprites/beaver-{baby,teen}.json
// (BL-11: ingested from the user's own images). The lodge sheet still
// records its own fps:10 in lodge.json (untouched, BL-11 didn't touch the
// lodge pipeline) — SPRITE_FPS drives both sheets' frame-advance cadence in
// the renderer regardless (see renderer.ts), so lodge frames run a hair
// slower than lodge.json's hint implies. Both values are inside CLAUDE.md's
// 8-12fps sprite-cadence budget, so this is cosmetic, not a bug.
export const SPRITE_FPS = 8;

// Matches the tile size fixed by assets/STYLE.md.
export const BEAVER_TILE_PX = 96;

// Integer nearest-neighbor blit scale for every sprite tile (canvas has
// imageSmoothingEnabled=false) — must stay an integer or pixel art blurs.
// BL-11: ingested art ships at a 96px native tile (vs. the old 48px
// programmatic art), so PET_SCALE drops to 1x — same 96px on-screen size as
// before (48 * 2).
export const PET_SCALE = 1;

// The lodge/hatch-particle sheet is untouched by BL-11 and stayed at its
// original 48px native tile — this keeps its on-screen size matching the
// beaver's 96px despite PET_SCALE dropping to 1 (see sprites.ts's drawFrame,
// which takes scale as a parameter rather than assuming PET_SCALE).
export const LODGE_SCALE = 2;

export const WALK_SPEED_PX_S = 24;
export const CLIMB_SPEED_PX_S = 20;

// Per-tick dt is clamped to this before any movement/timer math runs, so a
// stalled or throttled rAF frame (window occluded, laptop woke from sleep)
// can never move the beaver more than a bounded step — no teleports.
export const MAX_DT_S = 0.25;

export const IDLE_PAUSE_MIN_S = 2;
export const IDLE_PAUSE_MAX_S = 6;

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

// Evolution sequence tuning (shake -> flash -> new stage; BL-11 dropped the
// trailing celebrate — no react row in the ingested sheets).
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
// Sized for Retina overlays: sub-10px canvas text reads as a blurry smudge
// once the window is composited; 12px + matching metrics stay legible.
export const BUBBLE_FONT_PX = 12;
export const BUBBLE_CHAR_WIDTH_PX = 7;
export const BUBBLE_MAX_CHARS_PER_LINE = 28;
export const BUBBLE_LINE_HEIGHT_PX = 15;
export const BUBBLE_PADDING_PX = 8;
export const BUBBLE_TAIL_SIZE_PX = 5;
// Gap between the pet tile's top edge and the bubble's bottom edge (the tail
// occupies part of this gap).
export const BUBBLE_OFFSET_ABOVE_PET_PX = 8;

// Grab interaction: number of clicks inside the window needed to grab the
// beaver, and the duration of that window in seconds.
export const CLICKS_TO_GRAB = 3;
export const CLICK_WINDOW_S = 4;
