// Bake: steps recipes at the app's sprite cadence (SPRITE_FPS = 8) and renders
// each frame into the app's exact sheet format — one row per animation, one
// tile per frame — plus a SheetMeta-compatible JSON. Output is handed to
// serve.mjs, which writes it under assets-src/baked/ for review and intake
// through scripts/gen-sprites.

import type { Application } from 'pixi.js';
import { frameCount, type AnimRecipe } from './keyframes.js';
import { applyPose, type RigStage } from './puppet.js';
import { layoutSheet, type SheetLayout } from './sheet.js';
import type { Rig } from './rig.js';

export const BAKE_FPS = 8;

export interface BakedOutput {
  readonly sheetDataUrl: string;
  readonly meta: SheetLayout;
  /** Per animation name, the individual tile-sized frames as PNG data URLs. */
  readonly frames: Record<string, string[]>;
}

// Renders every recipe for the rig into one sheet. The app canvas itself is
// exactly one tile, so each rendered frame is blitted straight into its sheet
// cell — no extraction/cropping step, and resolution stays 1 so baked pixels
// are native-resolution (nearest-neighbor, never smoothed).
export function bakeRecipes(
  app: Application,
  rig: Rig,
  stage: RigStage,
  recipes: readonly AnimRecipe[],
): BakedOutput {
  const rows = recipes.map((recipe) => ({ name: recipe.name, frames: frameCount(recipe, BAKE_FPS) }));
  const meta = layoutSheet(rows, rig.tile, BAKE_FPS);

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = meta.sheetWidth;
  sheetCanvas.height = meta.sheetHeight;
  const sheetCtx = sheetCanvas.getContext('2d');
  if (!sheetCtx) {
    throw new Error('2d canvas context unavailable for sheet bake');
  }
  sheetCtx.imageSmoothingEnabled = false;

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = rig.tile;
  frameCanvas.height = rig.tile;
  const frameCtx = frameCanvas.getContext('2d');
  if (!frameCtx) {
    throw new Error('2d canvas context unavailable for frame bake');
  }
  frameCtx.imageSmoothingEnabled = false;

  const frames: Record<string, string[]> = {};

  // No app.stop()/start() dance here: the studio pauses playback before
  // baking, so the ticker never mutates poses mid-bake, and the loop below is
  // fully synchronous (applyPose → render → blit) — nothing can interleave.
  // Stopping the ticker previously left the preview dead after the first
  // bake (play no longer animated) with the last baked frame frozen on stage.
  recipes.forEach((recipe, rowIndex) => {
    const count = frameCount(recipe, BAKE_FPS);
    const dataUrls: string[] = [];
    for (let frame = 0; frame < count; frame += 1) {
      applyPose(stage, rig, recipe, frame / BAKE_FPS);
      app.render();
      frameCtx.clearRect(0, 0, rig.tile, rig.tile);
      frameCtx.drawImage(app.canvas, 0, 0);
      dataUrls.push(frameCanvas.toDataURL('image/png'));
      sheetCtx.drawImage(app.canvas, frame * rig.tile, rowIndex * rig.tile);
    }
    frames[recipe.name] = dataUrls;
  });

  return { sheetDataUrl: sheetCanvas.toDataURL('image/png'), meta, frames };
}
