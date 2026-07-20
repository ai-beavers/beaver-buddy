import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { basePose, validateRig, type Rig } from './rig.js';

const validRig: Rig = {
  name: 'test-rig',
  tile: 96,
  parts: [
    { id: 'body', src: 'body.png', pivot: [20, 15], pos: [48, 66], z: 30, parent: null },
    { id: 'head', src: 'head.png', pivot: [14, 20], pos: [18, -12], z: 50, parent: 'body' },
    { id: 'eye', src: 'eye.png', pivot: [3, 3], pos: [16, -10], z: 60, parent: 'head', visibleByDefault: false },
  ],
};

describe('rig: validateRig', () => {
  it('accepts a valid rig', () => {
    expect(validateRig(validRig)).toEqual([]);
  });

  it('rejects duplicate part ids', () => {
    const rig: Rig = { ...validRig, parts: [...validRig.parts, { ...validRig.parts[0] }] };
    expect(validateRig(rig)).toContain('duplicate part id: body');
  });

  it('rejects unknown parents', () => {
    const rig: Rig = {
      ...validRig,
      parts: [{ ...validRig.parts[0], parent: 'ghost' }],
    };
    expect(validateRig(rig)).toContain('part body: unknown parent "ghost"');
  });

  it('rejects self-parenting', () => {
    const rig: Rig = {
      ...validRig,
      parts: [{ ...validRig.parts[0], parent: 'body' }],
    };
    expect(validateRig(rig)).toContain('part body: part cannot parent itself');
  });

  it('rejects parent cycles', () => {
    const rig: Rig = {
      name: 'cycle',
      tile: 96,
      parts: [
        { id: 'a', src: 'a.png', pivot: [0, 0], pos: [0, 0], z: 1, parent: 'b' },
        { id: 'b', src: 'b.png', pivot: [0, 0], pos: [0, 0], z: 2, parent: 'a' },
      ],
    };
    const errors = validateRig(rig);
    expect(errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('rejects a bad tile size', () => {
    expect(validateRig({ ...validRig, tile: 0 })).toContain('tile must be a positive integer, got: 0');
  });

  it('rejects bad pivot/pos shapes', () => {
    const rig: Rig = {
      ...validRig,
      parts: [{ ...validRig.parts[0], pivot: [Number.NaN, 1] as [number, number] }],
    };
    expect(validateRig(rig)).toContain('part body: pivot must be [x, y] finite numbers');
  });

  it('every rig shipped in rigs/ validates clean', () => {
    const rigsDir = fileURLToPath(new URL('./rigs', import.meta.url));
    const names = fs.readdirSync(rigsDir).filter((f) => f.endsWith('.json'));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const rig = JSON.parse(fs.readFileSync(`${rigsDir}/${name}`, 'utf-8')) as Rig;
      expect(validateRig(rig), `${name}: ${validateRig(rig).join('; ')}`).toEqual([]);
    }
  });
});

describe('rig: basePose', () => {
  it('uses the rig pos, zero rotation, unit scale, default visibility', () => {
    expect(basePose(validRig.parts[0])).toEqual({ x: 48, y: 66, rotation: 0, scaleX: 1, scaleY: 1, visible: true });
  });

  it('honors visibleByDefault: false', () => {
    expect(basePose(validRig.parts[2]).visible).toBe(false);
  });
});
