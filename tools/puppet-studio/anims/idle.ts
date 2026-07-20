import type { AnimRecipe } from '../keyframes.js';

// 8-frame idle @ 8fps: breathing scale on the body (head rides along via
// parenting) plus one blink near the end (eye part swap via visible steps).
export const idle: AnimRecipe = {
  name: 'idle',
  rig: 'beaver-baby',
  durationS: 1,
  tracks: [
    {
      part: 'body',
      easing: 'sineInOut',
      keys: [
        { t: 0, scaleY: 1 },
        { t: 0.5, scaleY: 1.04 },
        { t: 1, scaleY: 1 },
      ],
    },
    {
      part: 'eyeOpen',
      keys: [
        { t: 0, visible: true },
        { t: 0.75, visible: false },
        { t: 0.875, visible: true },
      ],
    },
    {
      part: 'eyeClosed',
      keys: [
        { t: 0, visible: false },
        { t: 0.75, visible: true },
        { t: 0.875, visible: false },
      ],
    },
  ],
};
