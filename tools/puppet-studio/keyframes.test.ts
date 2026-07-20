import { describe, expect, it } from 'vitest';
import {
  frameCount,
  sampleRecipe,
  sampleTrack,
  validateRecipe,
  type AnimRecipe,
  type Pose,
  type Track,
} from './keyframes.js';
import type { Rig } from './rig.js';

const base: Pose = { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, visible: true };

describe('keyframes: sampleTrack', () => {
  it('holds the first key before it', () => {
    const track: Track = { part: 'p', keys: [{ t: 0.5, x: 99 }] };
    expect(sampleTrack(track, base, 0).x).toBe(99);
  });

  it('holds the last key after it', () => {
    const track: Track = { part: 'p', keys: [{ t: 0, x: 5 }, { t: 0.5, x: 15 }] };
    expect(sampleTrack(track, base, 1).x).toBe(15);
  });

  it('interpolates linearly at the midpoint', () => {
    const track: Track = { part: 'p', keys: [{ t: 0, x: 0 }, { t: 1, x: 10 }] };
    expect(sampleTrack(track, base, 0.5).x).toBe(5);
  });

  it('sineInOut easing passes through the midpoint but flattens the start', () => {
    const track: Track = { part: 'p', easing: 'sineInOut', keys: [{ t: 0, x: 0 }, { t: 1, x: 10 }] };
    expect(sampleTrack(track, base, 0.5).x).toBeCloseTo(5, 10);
    // At 25% linear would be 2.5; sineInOut gives 0.5 - 0.5*cos(PI/4) ≈ 0.146 of the span.
    expect(sampleTrack(track, base, 0.25).x).toBeCloseTo(10 * (0.5 - 0.5 * Math.cos(Math.PI * 0.25)), 10);
  });

  it('falls back to the base pose for fields no key sets', () => {
    const track: Track = { part: 'p', keys: [{ t: 0, x: 99 }, { t: 1, x: 99 }] };
    const pose = sampleTrack(track, base, 0.5);
    expect(pose.y).toBe(20);
    expect(pose.rotation).toBe(0);
    expect(pose.scaleX).toBe(1);
  });

  it('visible steps (holds previous key) instead of interpolating', () => {
    const track: Track = { part: 'p', keys: [{ t: 0, visible: true }, { t: 0.5, visible: false }, { t: 0.75, visible: true }] };
    expect(sampleTrack(track, base, 0.25).visible).toBe(true);
    expect(sampleTrack(track, base, 0.5).visible).toBe(false);
    expect(sampleTrack(track, base, 0.74).visible).toBe(false);
    expect(sampleTrack(track, base, 0.75).visible).toBe(true);
  });

  it('visible is sticky: keys without a visible field keep the last set value', () => {
    // Regression: the parachute canopy vanished mid-loop because a rotation-
    // only key fell back to the rig default (hidden) instead of holding the
    // previously set visible: true.
    const hiddenBase: Pose = { ...base, visible: false };
    const track: Track = {
      part: 'p',
      keys: [
        { t: 0, visible: true, rotation: -12 },
        { t: 0.5, rotation: 12 },
        { t: 1, rotation: -12 },
      ],
    };
    expect(sampleTrack(track, hiddenBase, 0).visible).toBe(true);
    expect(sampleTrack(track, hiddenBase, 0.5).visible).toBe(true);
    expect(sampleTrack(track, hiddenBase, 0.875).visible).toBe(true);
    // Without any key ever setting visible, the base default still applies.
    expect(sampleTrack({ part: 'p', keys: [{ t: 0, rotation: 5 }] }, hiddenBase, 0.5).visible).toBe(false);
  });

  it('tolerates unsorted keys', () => {
    const track: Track = { part: 'p', keys: [{ t: 1, x: 10 }, { t: 0, x: 0 }] };
    expect(sampleTrack(track, base, 0.5).x).toBe(5);
  });
});

describe('keyframes: sampleRecipe / frameCount', () => {
  const rig: Rig = {
    name: 'r',
    tile: 96,
    parts: [
      { id: 'a', src: 'a.png', pivot: [0, 0], pos: [1, 2], z: 1, parent: null },
      { id: 'b', src: 'b.png', pivot: [0, 0], pos: [3, 4], z: 2, parent: null },
    ],
  };
  const recipe: AnimRecipe = {
    name: 'anim',
    rig: 'r',
    durationS: 1,
    tracks: [{ part: 'a', keys: [{ t: 0, x: 50 }, { t: 1, x: 60 }] }],
  };

  it('poses untracked parts at base pose', () => {
    const poses = sampleRecipe(rig, recipe, 0.5);
    expect(poses.get('a')?.x).toBe(55);
    expect(poses.get('b')).toEqual({ x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1, visible: true });
  });

  it('frameCount rounds duration × fps and never returns zero', () => {
    expect(frameCount(recipe, 8)).toBe(8);
    expect(frameCount({ ...recipe, durationS: 0.5 }, 8)).toBe(4);
    expect(frameCount({ ...recipe, durationS: 0.01 }, 8)).toBe(1);
  });
});

describe('keyframes: validateRecipe', () => {
  const rig: Rig = {
    name: 'r',
    tile: 96,
    parts: [{ id: 'a', src: 'a.png', pivot: [0, 0], pos: [0, 0], z: 1, parent: null }],
  };

  it('accepts a valid recipe', () => {
    const recipe: AnimRecipe = { name: 'ok', rig: 'r', durationS: 1, tracks: [{ part: 'a', keys: [{ t: 0, x: 1 }] }] };
    expect(validateRecipe(rig, recipe)).toEqual([]);
  });

  it('rejects tracks for unknown parts and out-of-range keys', () => {
    const recipe: AnimRecipe = {
      name: 'bad',
      rig: 'r',
      durationS: 1,
      tracks: [{ part: 'ghost', keys: [{ t: 2, x: 1 }] }],
    };
    const errors = validateRecipe(rig, recipe);
    expect(errors.some((e) => e.includes('unknown part "ghost"'))).toBe(true);
    expect(errors.some((e) => e.includes('outside [0, durationS]'))).toBe(true);
  });
});
