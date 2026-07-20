import type { AnimRecipe } from '../keyframes.js';

// 8-frame parachute glide @ 8fps (for the planned drag-and-drop parachute
// interaction — runtime behavior is a separate task; this bakes the loop it
// will play). Canopy pendulums over the beaver; the beaver hangs with legs
// dropped and a slight counter-sway. Canopy is hidden by default in the rig,
// so the first key flips it visible.
export const parachute: AnimRecipe = {
  name: 'parachute',
  rig: 'beaver-baby',
  durationS: 1,
  tracks: [
    {
      part: 'canopy',
      easing: 'sineInOut',
      keys: [
        { t: 0, visible: true, rotation: -12 },
        { t: 0.5, rotation: 12 },
        { t: 1, rotation: -12 },
      ],
    },
    {
      part: 'body',
      easing: 'sineInOut',
      keys: [
        { t: 0, x: 44, rotation: -4 },
        { t: 0.5, x: 52, rotation: 4 },
        { t: 1, x: 44, rotation: -4 },
      ],
    },
    {
      part: 'legFront',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: 70 },
        { t: 0.5, rotation: 80 },
        { t: 1, rotation: 70 },
      ],
    },
    {
      part: 'legBack',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: 80 },
        { t: 0.5, rotation: 70 },
        { t: 1, rotation: 80 },
      ],
    },
    {
      part: 'tail',
      easing: 'sineInOut',
      keys: [
        { t: 0, rotation: 14 },
        { t: 0.5, rotation: 22 },
        { t: 1, rotation: 14 },
      ],
    },
  ],
};
