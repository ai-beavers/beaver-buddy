import type { AnimRecipe } from '../keyframes.js';
import { idle } from './idle.js';
import { parachute } from './parachute.js';
import { treeSway } from './tree-sway.js';
import { walk } from './walk.js';

// Every recipe the studio can play/bake, in bake-row order (row order defines
// the sheet layout). Keep this list in sync when adding recipes.
export const recipes: readonly AnimRecipe[] = [idle, walk, parachute, treeSway];

export function recipesForRig(rigName: string): readonly AnimRecipe[] {
  return recipes.filter((recipe) => recipe.rig === rigName);
}
