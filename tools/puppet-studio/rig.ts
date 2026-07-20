// Rig definition: which parts a character is made of, where each part's
// pivot sits inside its image, where that pivot lands in the parent space
// (root parts: tile space, i.e. the baked frame's 96×96 coordinate system),
// and how parts nest (a head follows the body's bob without its own track).
//
// Pure module — no DOM/PixiJS access, so vitest can cover validation.

export interface RigPart {
  /** Unique part identifier, referenced by animation tracks. */
  readonly id: string;
  /** Image filename inside assets-src/parts/<rigName>/. */
  readonly src: string;
  /** [x, y] pixel inside the part image that rotation/scale centers on. */
  readonly pivot: readonly [number, number];
  /** [x, y] where the pivot lands, in parent space (root parts: tile space). */
  readonly pos: readonly [number, number];
  /** Draw order within the rig (higher draws on top). */
  readonly z: number;
  /** Parent part id, or null for root parts. Children inherit parent motion. */
  readonly parent: string | null;
  /** Initial visibility; defaults to true (e.g. eye-closed starts hidden). */
  readonly visibleByDefault?: boolean;
}

export interface Rig {
  readonly name: string;
  /** Bake tile size in px; matches the app's sheet tile (96). */
  readonly tile: number;
  readonly parts: readonly RigPart[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec2(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);
}

// Returns a list of human-readable validation errors; empty means the rig is
// usable. A list (not throw-on-first) so a broken rig surfaces all its
// problems in one test run.
export function validateRig(rig: Rig): string[] {
  const errors: string[] = [];

  if (typeof rig.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(rig.name)) {
    errors.push(`rig name must be kebab-case ([a-z0-9-]), got: ${String(rig.name)}`);
  }
  if (!Number.isInteger(rig.tile) || rig.tile <= 0) {
    errors.push(`tile must be a positive integer, got: ${String(rig.tile)}`);
  }
  if (!Array.isArray(rig.parts) || rig.parts.length === 0) {
    errors.push('rig must contain at least one part');
    return errors;
  }

  const ids = new Set<string>();
  for (const part of rig.parts) {
    if (ids.has(part.id)) {
      errors.push(`duplicate part id: ${part.id}`);
    }
    ids.add(part.id);
  }

  for (const part of rig.parts) {
    if (typeof part.id !== 'string' || part.id.length === 0) {
      errors.push('part id must be a non-empty string');
    }
    if (typeof part.src !== 'string' || part.src.length === 0) {
      errors.push(`part ${part.id}: src must be a non-empty string`);
    }
    if (!isVec2(part.pivot)) {
      errors.push(`part ${part.id}: pivot must be [x, y] finite numbers`);
    }
    if (!isVec2(part.pos)) {
      errors.push(`part ${part.id}: pos must be [x, y] finite numbers`);
    }
    if (!isFiniteNumber(part.z)) {
      errors.push(`part ${part.id}: z must be a finite number`);
    }
    if (part.parent !== null && part.parent !== undefined && !ids.has(part.parent)) {
      errors.push(`part ${part.id}: unknown parent "${String(part.parent)}"`);
    }
    if (part.parent === part.id) {
      errors.push(`part ${part.id}: part cannot parent itself`);
    }
  }

  // Cycle detection over the parent chain.
  const parentOf = new Map(rig.parts.map((part) => [part.id, part.parent ?? null]));
  for (const part of rig.parts) {
    const seen = new Set<string>([part.id]);
    let cursor = parentOf.get(part.id) ?? null;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        errors.push(`part ${part.id}: parent chain contains a cycle (${cursor})`);
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  return errors;
}

// Base (rest) pose of one part, as animation tracks override it field by
// field. Position is the rig's pos; rotation 0; scale 1.
export function basePose(part: RigPart): {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
} {
  return {
    x: part.pos[0],
    y: part.pos[1],
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    visible: part.visibleByDefault ?? true,
  };
}
