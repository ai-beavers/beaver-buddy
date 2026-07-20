import type { AnimRecipe } from '../keyframes.js';

// 12-frame gentle sway @ 8fps for the growing-tree idea. One part rotating
// ±3° around its trunk-base pivot — the tree's growth stages are separate
// images (generated per stage), this loop is the same for every stage.
export const treeSway: AnimRecipe = {
  name: 'sway',
  rig: 'tree',
  durationS: 1.5,
  tracks: [
    {
      part: 'tree',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: -3 },
        { t: 0.75, rotation: 3 },
        { t: 1.5, rotation: -3 },
      ],
    },
  ],
};
