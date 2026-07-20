import type { AnimRecipe } from '../keyframes.js';

// 4-frame walk cycle @ 8fps: opposite leg swing, gentle body bob, tail sway.
// Head follows the body automatically (parented in the rig).
export const walk: AnimRecipe = {
  name: 'walk',
  rig: 'beaver-baby',
  durationS: 0.5,
  tracks: [
    {
      part: 'legFront',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: -18 },
        { t: 0.25, rotation: 18 },
        { t: 0.5, rotation: -18 },
      ],
    },
    {
      part: 'legBack',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: 18 },
        { t: 0.25, rotation: -18 },
        { t: 0.5, rotation: 18 },
      ],
    },
    {
      part: 'body',
      easing: 'sineInOut',
      keys: [
        { t: 0, y: 66 },
        { t: 0.25, y: 64 },
        { t: 0.5, y: 66 },
      ],
    },
    {
      part: 'tail',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: -6 },
        { t: 0.25, rotation: 6 },
        { t: 0.5, rotation: -6 },
      ],
    },
  ],
};
