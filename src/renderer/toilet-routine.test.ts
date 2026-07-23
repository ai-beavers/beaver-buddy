import { describe, expect, it } from 'vitest';
import { SPRITE_FPS, TOILET_ROUTINE_STEP_DURATION_S } from './pet-config.js';
import {
  startToiletRoutine,
  tickToiletRoutine,
  toiletRoutineAnim,
  toiletRoutineFrameIndex,
} from './toilet-routine.js';

describe('toilet-routine sequencer', () => {
  it('starts on toilet-read', () => {
    const s = startToiletRoutine();
    expect(s.step).toBe('toilet-read');
    expect(toiletRoutineAnim(s)).toEqual({ anim: 'toilet-read', reverse: false });
  });

  it('advances toilet-read → flush → wave-away → wave-back → shake-dry → done', () => {
    let s = startToiletRoutine();
    const steps: string[] = [s.step];
    for (let i = 0; i < 5; i += 1) {
      s = tickToiletRoutine(s, TOILET_ROUTINE_STEP_DURATION_S);
      steps.push(s.step);
    }
    expect(steps).toEqual(['toilet-read', 'flush', 'wave-away', 'wave-back', 'shake-dry', 'done']);
    expect(toiletRoutineAnim(s)).toBeNull();
  });

  it('marks wave-back as reverse', () => {
    let s = startToiletRoutine();
    s = tickToiletRoutine(s, TOILET_ROUTINE_STEP_DURATION_S); // flush
    s = tickToiletRoutine(s, TOILET_ROUTINE_STEP_DURATION_S); // wave-away
    s = tickToiletRoutine(s, TOILET_ROUTINE_STEP_DURATION_S); // wave-back
    expect(toiletRoutineAnim(s)).toEqual({ anim: 'wave', reverse: true });
  });

  it('stays on done once finished', () => {
    let s = startToiletRoutine();
    for (let i = 0; i < 10; i += 1) {
      s = tickToiletRoutine(s, TOILET_ROUTINE_STEP_DURATION_S);
    }
    expect(s.step).toBe('done');
    expect(tickToiletRoutine(s, 1).step).toBe('done');
  });

  it('maps elapsed time to a clamped local frame index', () => {
    const s = { step: 'toilet-read' as const, elapsedS: 0 };
    expect(toiletRoutineFrameIndex(s, SPRITE_FPS, 8)).toBe(0);
    expect(toiletRoutineFrameIndex({ ...s, elapsedS: 3 / SPRITE_FPS }, SPRITE_FPS, 8)).toBe(3);
    expect(toiletRoutineFrameIndex({ ...s, elapsedS: 99 }, SPRITE_FPS, 8)).toBe(7);
  });
});
