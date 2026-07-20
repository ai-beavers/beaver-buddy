// Keyframe DSL for animation recipes. A recipe is pure data: named tracks of
// per-part keys over time. Sampling merges a track over the part's base pose
// (from rig.ts) — keys only override the fields they set, so a recipe touches
// exactly the motion it cares about and leaves the rest at rest pose.
//
// Pure module — no DOM/PixiJS access, so vitest can cover sampling math.

import type { Rig, RigPart } from './rig.js';
import { basePose } from './rig.js';

export type EasingName = 'linear' | 'sineInOut';

export interface PartKey {
  /** Time in seconds from animation start. */
  readonly t: number;
  readonly x?: number;
  readonly y?: number;
  /** Degrees (PixiJS applies radians; conversion happens at apply time). */
  readonly rotation?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  /** Step function: holds the previous key's value until the next key. */
  readonly visible?: boolean;
}

export interface Track {
  /** Part id from the rig. */
  readonly part: string;
  readonly easing?: EasingName;
  readonly keys: readonly PartKey[];
}

export interface AnimRecipe {
  readonly name: string;
  /** Which rig this recipe animates (must equal Rig.name). */
  readonly rig: string;
  readonly durationS: number;
  readonly tracks: readonly Track[];
}

export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly visible: boolean;
}

function applyEasing(easing: EasingName | undefined, f: number): number {
  if (easing === 'sineInOut') {
    return 0.5 - 0.5 * Math.cos(Math.PI * f);
  }
  return f;
}

function lerpField(base: number, prev: number | undefined, next: number | undefined, f: number): number {
  const a = prev ?? base;
  const b = next ?? base;
  return a + (b - a) * f;
}

// Samples one track at timeS. Keys are used defensively sorted by t; before
// the first key the first key holds, after the last key the last key holds
// (clamped). Numeric fields interpolate; visible is sticky: the most recent
// key that SET it holds until a later key changes it (falling back to base
// only when no earlier key set it — otherwise a mid-track key that only
// changes rotation would silently flip a part back to its default
// visibility, which is how the parachute canopy once vanished mid-loop).
export function sampleTrack(track: Track, base: Pose, timeS: number): Pose {
  const keys = [...track.keys].sort((a, b) => a.t - b.t);
  if (keys.length === 0) {
    return base;
  }

  let i = 0;
  while (i < keys.length && keys[i].t <= timeS) {
    i += 1;
  }
  const prev = i === 0 ? null : keys[i - 1];
  const next = i < keys.length ? keys[i] : null;

  const stickyVisible = (): boolean => {
    for (let k = Math.min(i, keys.length) - 1; k >= 0; k -= 1) {
      const v = keys[k].visible;
      if (v !== undefined) {
        return v;
      }
    }
    return base.visible;
  };

  if (prev === null) {
    const first = keys[0];
    return {
      x: first.x ?? base.x,
      y: first.y ?? base.y,
      rotation: first.rotation ?? base.rotation,
      scaleX: first.scaleX ?? base.scaleX,
      scaleY: first.scaleY ?? base.scaleY,
      visible: stickyVisible(),
    };
  }
  if (next === null) {
    return {
      x: prev.x ?? base.x,
      y: prev.y ?? base.y,
      rotation: prev.rotation ?? base.rotation,
      scaleX: prev.scaleX ?? base.scaleX,
      scaleY: prev.scaleY ?? base.scaleY,
      visible: stickyVisible(),
    };
  }

  const span = next.t - prev.t;
  const raw = span <= 0 ? 0 : (timeS - prev.t) / span;
  const f = applyEasing(track.easing, Math.min(1, Math.max(0, raw)));
  return {
    x: lerpField(base.x, prev.x, next.x, f),
    y: lerpField(base.y, prev.y, next.y, f),
    rotation: lerpField(base.rotation, prev.rotation, next.rotation, f),
    scaleX: lerpField(base.scaleX, prev.scaleX, next.scaleX, f),
    scaleY: lerpField(base.scaleY, prev.scaleY, next.scaleY, f),
    visible: stickyVisible(),
  };
}

// Samples a whole recipe at timeS: every rig part gets its track pose, or its
// base pose when the recipe has no track for it. Recipes therefore start from
// the rest pose on every sample — no state leaks between animations.
export function sampleRecipe(rig: Rig, recipe: AnimRecipe, timeS: number): Map<string, Pose> {
  const trackByPart = new Map(recipe.tracks.map((track) => [track.part, track]));
  const poses = new Map<string, Pose>();
  for (const part of rig.parts) {
    const base = basePose(part as RigPart);
    const track = trackByPart.get(part.id);
    poses.set(part.id, track ? sampleTrack(track, base, timeS) : base);
  }
  return poses;
}

// Frame count for a baked row: 8fps × 0.5s = 4 frames, never zero.
export function frameCount(recipe: AnimRecipe, fps: number): number {
  return Math.max(1, Math.round(recipe.durationS * fps));
}

// Validates a recipe against a rig: every track must reference a known part,
// durations/keys must be finite, keys must be within [0, durationS].
export function validateRecipe(rig: Rig, recipe: AnimRecipe): string[] {
  const errors: string[] = [];
  if (recipe.rig !== rig.name) {
    errors.push(`recipe "${recipe.name}" targets rig "${recipe.rig}", expected "${rig.name}"`);
  }
  if (!Number.isFinite(recipe.durationS) || recipe.durationS <= 0) {
    errors.push(`recipe "${recipe.name}": durationS must be a positive finite number`);
  }
  const partIds = new Set(rig.parts.map((part) => part.id));
  const seenParts = new Set<string>();
  for (const track of recipe.tracks) {
    if (!partIds.has(track.part)) {
      errors.push(`recipe "${recipe.name}": track references unknown part "${track.part}"`);
    }
    if (seenParts.has(track.part)) {
      errors.push(`recipe "${recipe.name}": duplicate track for part "${track.part}"`);
    }
    seenParts.add(track.part);
    if (track.keys.length === 0) {
      errors.push(`recipe "${recipe.name}": track "${track.part}" has no keys`);
    }
    for (const key of track.keys) {
      if (!Number.isFinite(key.t) || key.t < 0 || key.t > recipe.durationS) {
        errors.push(`recipe "${recipe.name}": track "${track.part}" has key outside [0, durationS]: t=${key.t}`);
      }
    }
  }
  return errors;
}
