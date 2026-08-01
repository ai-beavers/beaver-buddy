// Stage-capabilities mapping: what each life stage can do. This is the
// single source of truth for stage-dependent behaviour — when Vlady's M5
// pipeline later adds animation rows to the young-baby / older-teen / adult
// sheets, flipping a capability here is all the renderer needs.
//
// The module is pure data (no canvas/DOM); the renderer queries it at
// runtime instead of hard-coding stage names.

import type { Stage } from './sprites.js';

export interface StageCapabilities {
  readonly stage: Stage;
  // Can the user grab the beaver and trigger the parachute-drop interaction?
  readonly canGrab: boolean;
  // Does this stage have a 'type' animation row (coding/working)?
  readonly canType: boolean;
  // Does this stage have the toilet+newspaper+recovery gag rows?
  readonly canToiletRoutine: boolean;
  // Movement pace multiplier (1.0 = normal). baby moves slower, older-teen / adult faster.
  readonly roamPace: number;
}

const CAPABILITIES: Record<Stage, StageCapabilities> = {
  baby:       { stage: 'baby',        canGrab: true,  canType: false, canToiletRoutine: false, roamPace: 0.7 },
  'young-baby': { stage: 'young-baby',  canGrab: false, canType: false, canToiletRoutine: false, roamPace: 0.85 },
  teen:       { stage: 'teen',        canGrab: false, canType: false, canToiletRoutine: false, roamPace: 1.0 },
  'older-teen': { stage: 'older-teen',  canGrab: false, canType: false, canToiletRoutine: false, roamPace: 1.15 },
  adult:      { stage: 'adult',       canGrab: true,  canType: true,  canToiletRoutine: true,  roamPace: 1.25 },
};

export function capabilities(stage: Stage): StageCapabilities {
  return CAPABILITIES[stage];
}
