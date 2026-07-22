import type { AnimRecipe } from '../keyframes.js';

// 12-frame gentle sway @ 8fps for the growing-tree idea. One part rotating
// around its trunk-base pivot, one recipe per growth-stage rig (rig names
// are per-stage: tree-stage-1/2/3 — see rigs/tree-stage-*.json). Amplitude is
// tuned per stage rather than shared: a thin sapling reads as stiff/dead at
// the grown tree's ±3°, so it gets more visible sway; the mature tree's
// heavier canopy reads as twitchy at the same amplitude, so it gets less.
function swayRecipe(rig: string, amplitudeDeg: number): AnimRecipe {
  return {
    name: 'sway',
    rig,
    durationS: 1.5,
    tracks: [
      {
        part: 'tree',
        easing: 'sineInOut',
        keys: [
          { t: 0, rotation: -amplitudeDeg },
          { t: 0.75, rotation: amplitudeDeg },
          { t: 1.5, rotation: -amplitudeDeg },
        ],
      },
    ],
  };
}

export const treeSwayStage1: AnimRecipe = swayRecipe('tree-stage-1', 5);
export const treeSwayStage2: AnimRecipe = swayRecipe('tree-stage-2', 3);
export const treeSwayStage3: AnimRecipe = swayRecipe('tree-stage-3', 2);
