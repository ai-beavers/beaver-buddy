// Renderer entry point, loaded as a native ES module (no bundler — ADR 001
// §Animation/roaming). Two clocks: a single rAF loop advances movement
// (roam.tick, real elapsed dt) and, inside the same callback, a dt
// accumulator advances the sprite-frame index at the fixed SPRITE_FPS
// cadence — the two are driven by separate math so render Hz and sprite fps
// are never conflated (CLAUDE.md "Overlay etiquette"). Draws only when
// something actually changed (dirty flag) and fully skips work while the
// document is hidden.

import { createRoamState, tick, type RoamState, type Bounds } from './roam.js';
import {
  BUBBLE_TAIL_SIZE_PX,
  EVOLUTION_SHAKE_JITTER_PX,
  HATCH_CORNER_MARGIN_PX,
  HATCH_LODGE_TILE_PX,
  HATCH_SHAKE_JITTER_MAX_PX,
  HATCH_SPARK_SPEED_PX_S,
  HATCH_BURST_DURATION_S,
  MAX_DT_S,
  PET_SCALE,
  SPRITE_FPS,
} from './pet-config.js';
import { loadSheet, loadLodgeSheet, drawFrame, type Sheet, type Stage } from './sprites.js';
import {
  isFlashVisible,
  shakeOffset,
  startEvolution,
  tickEvolution,
  type EvolutionState,
  type PetChangedPayload,
} from './evolution.js';
import { hatchShakeOffset, sparkOffsets, startHatch, tickHatch, type HatchState } from './hatch.js';
import { drawBubble, layoutBubble } from './bubble.js';

interface QuipChangedPayload {
  readonly text: string;
  readonly durationMs: number;
}

declare global {
  interface Window {
    beaverBuddy: {
      onPausedChanged(callback: (paused: boolean) => void): void;
      onPetChanged(callback: (pet: PetChangedPayload) => void): void;
      onHatchStart(callback: () => void): void;
      onQuip(callback: (quip: QuipChangedPayload) => void): void;
    };
    // Read-only diagnostic surface; nothing in the app reads it.
    __debugRoam?: RoamState;
    __debugPet?: { level: number; stage: Stage; evolving: boolean };
    __debugHatch?: { phase: HatchState['phase'] };
    __debugQuip?: string | null;
  }
}

// x/y/width/height rather than a square (roam/evolution/hatch draws) since
// the quip bubble is wider than it is tall and needs to union with the pet's
// square dirty rect.
interface DirtyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function unionRect(a: DirtyRect, b: DirtyRect): DirtyRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

const canvasEl = document.getElementById('stage');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('missing #stage canvas element');
}
const canvas: HTMLCanvasElement = canvasEl;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2d canvas context unavailable');
}
const ctx: CanvasRenderingContext2D = context;
ctx.imageSmoothingEnabled = false;

function bounds(): Bounds {
  return { width: canvas.width, height: canvas.height };
}

let paused = false;
let stage: Stage = 'baby';
let sheet: Sheet | null = null;
let roamState: RoamState = createRoamState(bounds(), Math.random);
let frameIndex = 0;
let frameAccumulatorS = 0;
let reactUntilMs: number | null = null;
let lastTimestampMs: number | null = null;
let needsDraw = true;
let petLevel = 1;
let evolutionState: EvolutionState | null = null;
let hatchState: HatchState | null = null;
let lodgeSheet: Sheet | null = null;
let hatchFrameIndex = 0;
let hatchFrameAccumulatorS = 0;
let quipState: { text: string; showUntilMs: number } | null = null;

function loadCurrentSheet(): void {
  loadSheet(stage)
    .then((loaded) => {
      sheet = loaded;
      needsDraw = true;
    })
    .catch((error: unknown) => console.error('Failed to load sprite sheet:', error));
}

// Exported for later evolution features: switches the active sprite sheet.
// Not wired to any UI yet — this is this module's API surface.
export function setStage(next: Stage): void {
  if (next === stage) {
    return;
  }
  stage = next;
  loadCurrentSheet();
}

// Exported for later evolution/quip features: one-shot react animation,
// not part of the random roam rotation. Overlays the drawn anim only —
// movement keeps roaming underneath.
export function celebrate(): void {
  if (!sheet) {
    return;
  }
  const reactRow = sheet.meta.rows.find((row) => row.name === 'react');
  const frames = reactRow ? reactRow.frames : 0;
  const durationMs = (frames / sheet.meta.fps) * 1000;
  reactUntilMs = performance.now() + durationMs;
  needsDraw = true;
}

window.beaverBuddy.onPausedChanged((nextPaused) => {
  paused = nextPaused;
  needsDraw = true;
});

window.beaverBuddy.onPetChanged((pet) => {
  petLevel = pet.level;
  if (pet.evolvingTo && !hatchState) {
    // A fresh page load always starts from the default 'baby' sheet, so a
    // launch that evolves immediately (e.g. persisted state already teen,
    // injected straight past adult) must sync to the pre-evolution stage
    // first — otherwise the shake/flash plays over the wrong sprite.
    if (pet.stage !== stage) {
      setStage(pet.stage);
    }
    // Renderer-local freeze only (CLAUDE.md: tray Pause must stay a pure
    // user control) — roaming resumes on its own once the sequence ends.
    evolutionState = startEvolution(pet.evolvingTo);
  } else if (pet.evolvingTo) {
    // Stage crossing while the hatch owns the screen: an animated evolution
    // would run invisibly behind the hatch (draw() renders only the hatch),
    // flip the sheet at an arbitrary mid-hatch moment, and have its
    // celebrate window swallowed. Skip the animation and sync straight to
    // the post-evolution stage so the appear phase shows the pet at its
    // true stage with no mid-sequence sprite flip. main.ts sends
    // state:hatch before the pet update, so hatchState is already set here
    // on a hatching launch.
    setStage(pet.evolvingTo);
  } else if (!evolutionState && pet.stage !== stage) {
    // No transition in flight: sync directly (e.g. a late listener attach
    // catching up to state that already changed).
    setStage(pet.stage);
  }
  needsDraw = true;
});

window.beaverBuddy.onQuip((quip) => {
  quipState = { text: quip.text, showUntilMs: performance.now() + quip.durationMs };
  needsDraw = true;
});

window.beaverBuddy.onHatchStart(() => {
  hatchState = startHatch();
  loadLodgeSheet()
    .then((loaded) => {
      lodgeSheet = loaded;
      needsDraw = true;
    })
    .catch((error: unknown) => console.error('Failed to load lodge sprite sheet:', error));
  needsDraw = true;
});

// The hatch always plays in the bottom-left corner; the margin constant is
// its only placement tuning. Both the margin and the lodge tile are scaled
// so the lodge's (bigger) drawn footprint still sits flush on the bottom
// edge instead of floating above it.
function hatchPosition(): { x: number; y: number } {
  return { x: HATCH_CORNER_MARGIN_PX * PET_SCALE, y: bounds().height - HATCH_LODGE_TILE_PX * PET_SCALE };
}

// Last cleared/drawn region. Clearing only this rect (instead of the whole
// 1728x1016 surface) keeps Chromium's damage rect — and therefore the
// WindowServer repaint of the transparent window behind it — sprite-sized
// (or sprite-plus-bubble-sized, when a quip is showing).
let dirtyRect: DirtyRect | null = null;

// Renders the lodge-idle/shake/burst/spark/baby-appear visuals in place of
// the normal roam draw while a hatch sequence is active.
function drawHatch(state: HatchState): void {
  const { x, y } = hatchPosition();

  if (state.phase === 'baby-appear') {
    if (!sheet) {
      // Sheet not loaded: nothing drawn, but keep the dirty rect bounded to
      // the hatch area — a null rect would make every hatch frame clear the
      // full canvas (hatch redraws every frame), regressing the sprite-sized
      // damage-rect discipline.
      const pad = Math.ceil((HATCH_LODGE_TILE_PX * PET_SCALE) / 2);
      const size = HATCH_LODGE_TILE_PX * PET_SCALE + 2 * pad;
      dirtyRect = { x: x - pad, y: y - pad, width: size, height: size };
      return;
    }
    // Bottom-aligned with the (larger) lodge tile so there's no visual jump
    // between the lodge and the baby appearing at the handoff.
    const babyTile = sheet.meta.tile * PET_SCALE;
    const babyY = bounds().height - babyTile;
    drawFrame(ctx, sheet, 'react', hatchFrameIndex, x, babyY, { mirror: false, rotationDeg: 0 });
    const pad = Math.ceil(babyTile / 2);
    const size = babyTile + 2 * pad;
    dirtyRect = { x: x - pad, y: babyY - pad, width: size, height: size };
    return;
  }

  if (!lodgeSheet) {
    // Lodge sheet still loading (or failed): same bounded-rect rule as above
    // so a load failure can never reintroduce per-frame full-canvas clears.
    const pad = Math.ceil((HATCH_LODGE_TILE_PX * PET_SCALE) / 2) + HATCH_SHAKE_JITTER_MAX_PX;
    const size = HATCH_LODGE_TILE_PX * PET_SCALE + 2 * pad;
    dirtyRect = { x: x - pad, y: y - pad, width: size, height: size };
    return;
  }

  const anim = state.phase === 'lodge-idle' ? 'idle' : state.phase === 'shake' ? 'shake' : 'burst';
  const shake = state.phase === 'shake' ? hatchShakeOffset(state, Math.random) : { dx: 0, dy: 0 };
  const drawX = Math.round(x + shake.dx);
  const drawY = Math.round(y + shake.dy);
  drawFrame(ctx, lodgeSheet, anim, hatchFrameIndex, drawX, drawY, { mirror: false, rotationDeg: 0 });

  const tile = lodgeSheet.meta.tile * PET_SCALE;
  let pad = Math.ceil(tile / 2) + HATCH_SHAKE_JITTER_MAX_PX;

  if (state.phase === 'burst') {
    for (const offset of sparkOffsets(state)) {
      const sparkX = Math.round(drawX + offset.dx * PET_SCALE);
      const sparkY = Math.round(drawY + offset.dy * PET_SCALE);
      drawFrame(ctx, lodgeSheet, 'spark', hatchFrameIndex, sparkX, sparkY, { mirror: false, rotationDeg: 0 });
    }
    // Sparks radiate outward for the whole burst duration — pad the dirty
    // rect to the max travel distance so trailing sparks never smear.
    pad += HATCH_SPARK_SPEED_PX_S * HATCH_BURST_DURATION_S * PET_SCALE;
  }

  const size = tile + 2 * pad;
  dirtyRect = { x: drawX - pad, y: drawY - pad, width: size, height: size };
}

function draw(): void {
  if (dirtyRect) {
    ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (hatchState) {
    drawHatch(hatchState);
    return;
  }
  if (!sheet) {
    dirtyRect = null;
    return;
  }
  const anim = reactUntilMs !== null ? 'react' : roamState.anim;
  const shake = evolutionState ? shakeOffset(evolutionState, Math.random) : { dx: 0, dy: 0 };
  // Integer pixel positions: pixel art must land on whole pixels, and the
  // rounding also means sub-pixel movement between rAF ticks doesn't count
  // as "moved" (see the moved check in frame()).
  const drawX = Math.round(roamState.x + shake.dx);
  const drawY = Math.round(roamState.y + shake.dy);
  drawFrame(ctx, sheet, anim, frameIndex, drawX, drawY, {
    mirror: roamState.facing === 'left',
    rotationDeg: roamState.rotation,
  });
  // A tile rotated about its center sweeps sqrt(2)x its size; half-tile
  // padding on each side covers any rotation, plus shake jitter so the
  // dirty rect fully covers the jittered draw position too. Sized off the
  // drawn (scaled) tile, not the raw art tile.
  const tile = sheet.meta.tile * PET_SCALE;
  const pad = Math.ceil(tile / 2) + EVOLUTION_SHAKE_JITTER_PX;
  if (evolutionState && isFlashVisible(evolutionState)) {
    // White-silhouette blink: 'source-in' keeps the fill only where the
    // sprite we just drew was opaque, and clears everything else within
    // this call's affected region (which the dirty-rect discipline already
    // scopes to just-drawn pixels).
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(drawX - pad, drawY - pad, tile + 2 * pad, tile + 2 * pad);
    ctx.restore();
  }

  const petSize = tile + 2 * pad;
  let unionedRect: DirtyRect = { x: drawX - pad, y: drawY - pad, width: petSize, height: petSize };

  if (quipState) {
    const layout = layoutBubble(quipState.text, drawX, drawY, tile, bounds());
    drawBubble(ctx, layout);
    unionedRect = unionRect(unionedRect, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      // + tail + 1: the tail triangle draws BUBBLE_TAIL_SIZE_PX below the
      // bubble's bottom edge, and its 1px outline stroke (drawn on the +0.5
      // pixel center) bleeds one more pixel past the fill — without the +1
      // the clear pass leaves a stroke-residue line behind.
      height: layout.height + BUBBLE_TAIL_SIZE_PX + 1,
    });
  }
  dirtyRect = unionedRect;
}

function frame(timestampMs: number): void {
  requestAnimationFrame(frame);

  if (document.hidden) {
    // Fully skip: no movement, no frame advance, no draw. Reset the clock
    // baseline so the next visible frame doesn't see a huge stale dt.
    lastTimestampMs = null;
    return;
  }

  if (lastTimestampMs === null) {
    lastTimestampMs = timestampMs;
  }
  const dtSeconds = Math.min((timestampMs - lastTimestampMs) / 1000, MAX_DT_S);
  lastTimestampMs = timestampMs;

  const prev = roamState;
  // Roaming freezes locally during an evolution or hatch sequence — this
  // never touches the main-process pause state, so tray Pause stays a pure
  // user control (see evolution.ts).
  roamState = tick(roamState, dtSeconds, bounds(), paused || evolutionState !== null || hatchState !== null, Math.random);
  window.__debugRoam = roamState;
  // Compare rounded positions: the sprite is drawn on whole pixels, so
  // sub-pixel movement between rAF ticks changes nothing on screen — this
  // caps movement-driven redraws at (speed px/s) per second instead of one
  // per display refresh.
  const moved =
    Math.round(roamState.x) !== Math.round(prev.x) ||
    Math.round(roamState.y) !== Math.round(prev.y) ||
    roamState.anim !== prev.anim ||
    roamState.rotation !== prev.rotation ||
    roamState.facing !== prev.facing;

  let frameAdvanced = false;
  if (!roamState.frameHold) {
    frameAccumulatorS += dtSeconds;
    const frameIntervalS = 1 / SPRITE_FPS;
    while (frameAccumulatorS >= frameIntervalS) {
      frameAccumulatorS -= frameIntervalS;
      frameIndex += 1;
      frameAdvanced = true;
    }
  }

  if (reactUntilMs !== null && timestampMs >= reactUntilMs) {
    reactUntilMs = null;
    frameAdvanced = true;
  }

  let evolutionActive = false;
  if (evolutionState) {
    evolutionState = tickEvolution(evolutionState, dtSeconds);
    evolutionActive = true; // flash blinking needs a redraw every frame
    if (evolutionState.phase === 'done') {
      const targetStage = evolutionState.targetStage;
      evolutionState = null;
      setStage(targetStage);
      celebrate();
    }
  }
  window.__debugPet = { level: petLevel, stage, evolving: evolutionState !== null };

  let hatchActive = false;
  if (hatchState) {
    hatchState = tickHatch(hatchState, dtSeconds, Math.random);
    hatchActive = true;
    // Lodge/burst/spark/baby-appear frames run on the same fps accumulator
    // as roam sprites (CLAUDE.md: one sprite-fps cadence, never conflated
    // with render Hz) — a separate index because it's a different sheet.
    hatchFrameAccumulatorS += dtSeconds;
    const hatchFrameIntervalS = 1 / SPRITE_FPS;
    while (hatchFrameAccumulatorS >= hatchFrameIntervalS) {
      hatchFrameAccumulatorS -= hatchFrameIntervalS;
      hatchFrameIndex += 1;
    }
    window.__debugHatch = { phase: hatchState.phase };
    if (hatchState.phase === 'done') {
      hatchState = null;
      // Hand off to the roam machine: y is already ground (set at
      // createRoamState init and untouched while frozen) — only x needs
      // repositioning to the hatch corner (same scaled margin hatchPosition
      // draws the lodge at, so there's no pop at the handoff).
      roamState = { ...roamState, x: HATCH_CORNER_MARGIN_PX * PET_SCALE, frameHold: false };
    }
  }

  let quipExpired = false;
  if (quipState && timestampMs >= quipState.showUntilMs) {
    quipState = null;
    quipExpired = true;
  }
  window.__debugQuip = quipState ? quipState.text : null;

  if (moved || frameAdvanced || needsDraw || evolutionActive || hatchActive || quipExpired) {
    draw();
    needsDraw = false;
  }
}

loadCurrentSheet();
requestAnimationFrame(frame);
