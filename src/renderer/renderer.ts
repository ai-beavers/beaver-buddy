// Renderer entry point, loaded as a native ES module (no bundler — ADR 001
// §Animation/roaming). Two clocks: a single rAF loop advances movement
// (roam.tick, real elapsed dt) and, inside the same callback, a dt
// accumulator advances the sprite-frame index at the fixed SPRITE_FPS
// cadence — the two are driven by separate math so render Hz and sprite fps
// are never conflated (CLAUDE.md "Overlay etiquette"). Draws only when
// something actually changed (dirty flag) and fully skips work while the
// document is hidden.

import { createRoamState, tick, type RoamState, type Bounds } from './roam.js';
import { EVOLUTION_SHAKE_JITTER_PX, MAX_DT_S, SPRITE_FPS } from './pet-config.js';
import { loadSheet, drawFrame, type Sheet, type Stage } from './sprites.js';
import {
  isFlashVisible,
  shakeOffset,
  startEvolution,
  tickEvolution,
  type EvolutionState,
  type PetChangedPayload,
} from './evolution.js';

declare global {
  interface Window {
    beaverBuddy: {
      onPausedChanged(callback: (paused: boolean) => void): void;
      onPetChanged(callback: (pet: PetChangedPayload) => void): void;
    };
    // Read-only diagnostic surface; nothing in the app reads it.
    __debugRoam?: RoamState;
    __debugPet?: { level: number; stage: Stage; evolving: boolean };
  }
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
  if (pet.evolvingTo) {
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
  } else if (!evolutionState && pet.stage !== stage) {
    // No transition in flight: sync directly (e.g. a late listener attach
    // catching up to state that already changed).
    setStage(pet.stage);
  }
  needsDraw = true;
});

// Last cleared/drawn region. Clearing only this rect (instead of the whole
// 1728x1016 surface) keeps Chromium's damage rect — and therefore the
// WindowServer repaint of the transparent window behind it — sprite-sized.
let dirtyRect: { x: number; y: number; size: number } | null = null;

function draw(): void {
  if (dirtyRect) {
    ctx.clearRect(dirtyRect.x, dirtyRect.y, dirtyRect.size, dirtyRect.size);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  // dirty rect fully covers the jittered draw position too.
  const tile = sheet.meta.tile;
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
  dirtyRect = { x: drawX - pad, y: drawY - pad, size: tile + 2 * pad };
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
  // Roaming freezes locally during an evolution sequence — this never
  // touches the main-process pause state, so tray Pause stays a pure user
  // control (see evolution.ts).
  roamState = tick(roamState, dtSeconds, bounds(), paused || evolutionState !== null, Math.random);
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

  if (moved || frameAdvanced || needsDraw || evolutionActive) {
    draw();
    needsDraw = false;
  }
}

loadCurrentSheet();
requestAnimationFrame(frame);
