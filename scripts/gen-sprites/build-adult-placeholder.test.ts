import { describe, expect, it } from 'vitest';
import { buildAdultPlaceholder } from './build-adult-placeholder.ts';

// The committed teen sheet is the only input — like build-icons.test.ts
// there is no gitignored assets-src/ dependency, so this suite runs on
// every checkout (a fresh clone can always regenerate the placeholder).
//
// Unlike the pre-BL-18 version of this suite, this does NOT assert the
// generator's output equals the committed beaver-adult.png/.json: BL-18
// appends reference-matched anim rows (struggle/parachute-wind/land) on top
// of this placeholder's idle/walk via ingest-animation-frames.mjs, so the
// committed sheet is 5 rows while this generator only ever produces 2
// (idle/walk). The committed-sheet shape is covered by
// ingest-animation-frames.test.ts instead.

describe('buildAdultPlaceholder', () => {
  it('is deterministic: two runs produce byte-identical output', () => {
    const a = buildAdultPlaceholder();
    const b = buildAdultPlaceholder();
    expect(a.png.equals(b.png)).toBe(true);
    expect(a.meta).toEqual(b.meta);
  });

  it('produces idle and walk rows', () => {
    const { meta } = buildAdultPlaceholder();
    expect(meta.rows.map((row) => row.name)).toEqual(['idle', 'walk']);
    expect(meta.rows[0].frames).toBe(1);
    expect(meta.rows[1].frames).toBe(2);
  });
});
