import { describe, expect, it } from 'vitest';
import { BEAVER_TILE_PX, PET_SCALE } from './pet-config.js';
import {
  consumeInput,
  createInputQueue,
  determineCaptureMode,
  isPointOverPet,
  recordClickOnPet,
  recordDoubleClick,
  stageHasInteraction,
  updateCursor,
} from './input-capture.js';
import { createRoamState } from './roam.js';

const TILE = BEAVER_TILE_PX * PET_SCALE;

describe('input-capture queue', () => {
  it('starts with sentinel coordinates and no pending input', () => {
    const queue = createInputQueue();
    expect(queue).toEqual({ cursorX: -1, cursorY: -1, clicks: 0, doubleClick: false });
  });

  it('updates the cursor position', () => {
    const queue = createInputQueue();
    updateCursor(queue, 120, 340);
    expect(queue.cursorX).toBe(120);
    expect(queue.cursorY).toBe(340);
  });

  it('records a click only when it lands on the pet', () => {
    const queue = createInputQueue();
    recordClickOnPet(queue, 10, 10, 0, 0);
    expect(queue.clicks).toBe(1);

    recordClickOnPet(queue, TILE + 5, 10, 0, 0);
    expect(queue.clicks).toBe(1);
  });

  it('records a double-click', () => {
    const queue = createInputQueue();
    recordDoubleClick(queue);
    expect(queue.doubleClick).toBe(true);
  });

  it('consumeInput returns the current state and resets clicks/doubleClick but keeps cursor', () => {
    const queue = createInputQueue();
    updateCursor(queue, 10, 20);
    recordClickOnPet(queue, 10, 20, 0, 0);
    recordDoubleClick(queue);

    const input = consumeInput(queue);
    expect(input).toEqual({ cursorX: 10, cursorY: 20, clicks: 1, doubleClick: true });
    expect(queue.clicks).toBe(0);
    expect(queue.doubleClick).toBe(false);
    expect(queue.cursorX).toBe(10);
    expect(queue.cursorY).toBe(20);
  });
});

describe('stageHasInteraction', () => {
  it('is enabled for baby and adult (they ship the struggle/parachute-wind/land rows)', () => {
    expect(stageHasInteraction('baby')).toBe(true);
    expect(stageHasInteraction('adult')).toBe(true);
  });

  it('is disabled for teen (its sheet lacks the rows)', () => {
    expect(stageHasInteraction('teen')).toBe(false);
  });
});

describe('isPointOverPet', () => {
  it('returns true for a point inside the pet tile', () => {
    expect(isPointOverPet(0, 0, 0, 0)).toBe(true);
    expect(isPointOverPet(TILE - 1, TILE - 1, 0, 0)).toBe(true);
  });

  it('returns false for points outside the pet tile', () => {
    expect(isPointOverPet(TILE, 0, 0, 0)).toBe(false);
    expect(isPointOverPet(0, TILE, 0, 0)).toBe(false);
    expect(isPointOverPet(-1, 0, 0, 0)).toBe(false);
    expect(isPointOverPet(0, -1, 0, 0)).toBe(false);
  });
});

describe('determineCaptureMode', () => {
  it('returns full-capture while grabbed, regardless of cursor position', () => {
    const state = { ...createRoamState({ width: 1000, height: 1000 }, () => 0.5), phase: 'grabbed' as const };
    expect(determineCaptureMode(state, 500, 500, 0, 0)).toBe('full-capture');
  });

  it('returns full-capture when the cursor is over the pet during roaming', () => {
    const state = createRoamState({ width: 1000, height: 1000 }, () => 0.5);
    expect(determineCaptureMode(state, 50, 50, 0, 0)).toBe('full-capture');
  });

  it('returns hover-forward when the cursor is away from the pet', () => {
    const state = createRoamState({ width: 1000, height: 1000 }, () => 0.5);
    expect(determineCaptureMode(state, 500, 500, 0, 0)).toBe('hover-forward');
  });

  it('returns hover-forward for the sentinel cursor used on mouseleave', () => {
    const state = createRoamState({ width: 1000, height: 1000 }, () => 0.5);
    expect(determineCaptureMode(state, -1, -1, 0, 0)).toBe('hover-forward');
  });

  it('returns hover-forward during gliding even when the cursor is over the pet', () => {
    const state = { ...createRoamState({ width: 1000, height: 1000 }, () => 0.5), phase: 'gliding' as const };
    expect(determineCaptureMode(state, 50, 50, 0, 0)).toBe('hover-forward');
  });

  it('returns hover-forward during landing even when the cursor is over the pet', () => {
    const state = { ...createRoamState({ width: 1000, height: 1000 }, () => 0.5), phase: 'landing' as const };
    expect(determineCaptureMode(state, 50, 50, 0, 0)).toBe('hover-forward');
  });

  it('returns hover-forward everywhere when interaction is disabled, even grabbed or hovered', () => {
    const bounds = { width: 1000, height: 1000 };
    const roam = createRoamState(bounds, () => 0.5);
    const grabbed = { ...roam, phase: 'grabbed' as const };
    const gliding = { ...roam, phase: 'gliding' as const };
    const landing = { ...roam, phase: 'landing' as const };

    expect(determineCaptureMode(grabbed, 50, 50, 0, 0, false)).toBe('hover-forward');
    expect(determineCaptureMode(gliding, 50, 50, 0, 0, false)).toBe('hover-forward');
    expect(determineCaptureMode(landing, 50, 50, 0, 0, false)).toBe('hover-forward');
    // Cursor directly over the pet while roaming.
    expect(determineCaptureMode(roam, 50, 50, 0, 0, false)).toBe('hover-forward');
    // Cursor away from the pet.
    expect(determineCaptureMode(roam, 500, 500, 0, 0, false)).toBe('hover-forward');
  });
});
