// PixiJS-side rig assembly: builds the container tree for a rig and applies
// sampled poses to it. This is the only module besides studio.ts/bake.ts that
// imports pixi.js — everything testable lives in rig.ts/keyframes.ts/sheet.ts.

import { Container, Sprite, Texture } from 'pixi.js';
import { sampleRecipe, type AnimRecipe } from './keyframes.js';
import type { Rig } from './rig.js';

export interface RigStage {
  readonly root: Container;
  readonly parts: Map<string, Container>;
}

// Builds a container per part (pivot + position from the rig), nests them by
// parent, sorts by z, and anchors each part's sprite so the container's pivot
// maps onto the part image's pivot pixel. Root sits at (0,0) — bake renders
// the canvas as the full tile, so tile space is canvas space.
export function buildRigStage(rig: Rig, textures: Map<string, Texture>): RigStage {
  const root = new Container();
  const parts = new Map<string, Container>();

  const sorted = [...rig.parts].sort((a, b) => a.z - b.z);
  for (const part of sorted) {
    const texture = textures.get(part.id);
    if (!texture) {
      throw new Error(`missing texture for part "${part.id}" (${part.src})`);
    }
    texture.source.scaleMode = 'nearest';

    const sprite = new Sprite(texture);
    // Sprite top-left lands at (-pivot) so the pivot pixel sits on the
    // container origin; rotation/scale then center on the pivot.
    sprite.position.set(-part.pivot[0], -part.pivot[1]);

    const container = new Container();
    container.addChild(sprite);
    container.position.set(part.pos[0], part.pos[1]);
    container.visible = part.visibleByDefault ?? true;
    parts.set(part.id, container);
  }

  // Nest children into parents; root parts hang off the root container.
  for (const part of sorted) {
    const container = parts.get(part.id);
    if (!container) {
      continue;
    }
    const parent = part.parent ? parts.get(part.parent) : undefined;
    (parent ?? root).addChild(container);
  }

  return { root, parts };
}

// Applies one sampled frame: absolute pose values from sampleRecipe, rotation
// converted degrees → radians. Parts untouched by the recipe sit at base pose
// (sampleRecipe already merged them), so animations never leak state.
export function applyPose(stage: RigStage, rig: Rig, recipe: AnimRecipe, timeS: number): void {
  const poses = sampleRecipe(rig, recipe, timeS);
  for (const [partId, pose] of poses) {
    const container = stage.parts.get(partId);
    if (!container) {
      continue;
    }
    container.position.set(pose.x, pose.y);
    container.rotation = (pose.rotation * Math.PI) / 180;
    container.scale.set(pose.scaleX, pose.scaleY);
    container.visible = pose.visible;
  }
}
