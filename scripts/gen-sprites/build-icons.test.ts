import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from './ingest-images.mjs';
import { buildIcons, ICON_SIZES, TRAY_SIZE } from './build-icons.ts';

// The committed sprite sheet is the only input — unlike ingest-images.test.ts
// there is no gitignored assets-src/ dependency, so this suite runs on every
// checkout (a fresh clone can always regenerate its icons).

const ICO_URL = new URL('../../assets/icon.ico', import.meta.url);
const TRAY_URL = new URL('../../assets/tray-icon.png', import.meta.url);

describe('buildIcons', () => {
  it('is deterministic: two runs produce byte-identical output', () => {
    const a = buildIcons();
    const b = buildIcons();
    expect(a.ico.equals(b.ico)).toBe(true);
    expect(a.trayPng.equals(b.trayPng)).toBe(true);
  });

  // Guards against stale or hand-edited committed assets. Fails => run
  // `npm run assets:icons` and commit.
  it('committed icon.ico and tray-icon.png match the generator byte-for-byte', () => {
    const { ico, trayPng } = buildIcons();
    expect(fs.readFileSync(ICO_URL).equals(ico)).toBe(true);
    expect(fs.readFileSync(TRAY_URL).equals(trayPng)).toBe(true);
  });

  it('embeds every required size, each decoding back to its stated dimensions', () => {
    const { ico } = buildIcons();
    expect(ico.readUInt16LE(4)).toBe(ICON_SIZES.length);
    for (let i = 0; i < ICON_SIZES.length; i += 1) {
      const base = 6 + i * 16;
      const size = ico[base] === 0 ? 256 : ico[base];
      expect(size).toBe(ICON_SIZES[i]); // entries ascending
      const imageOffset = ico.readUInt32LE(base + 12);
      const bytesInRes = ico.readUInt32LE(base + 8);
      const decoded = decodePng(ico.subarray(imageOffset, imageOffset + bytesInRes));
      expect(decoded.width).toBe(size);
      expect(decoded.height).toBe(size);
    }
  });

  it('every icon size keeps opaque content (bbox survived the scaling)', () => {
    const { ico } = buildIcons();
    for (let i = 0; i < ICON_SIZES.length; i += 1) {
      const base = 6 + i * 16;
      const imageOffset = ico.readUInt32LE(base + 12);
      const bytesInRes = ico.readUInt32LE(base + 8);
      const decoded = decodePng(ico.subarray(imageOffset, imageOffset + bytesInRes));
      let opaque = 0;
      for (let p = 3; p < decoded.data.length; p += 4) {
        if (decoded.data[p] > 0) opaque += 1;
      }
      expect(opaque, `icon size ${decoded.width} has no opaque pixels`).toBeGreaterThan(0);
    }
  });

  it('tray icon is a 32x32 RGBA PNG with opaque content', () => {
    const { trayPng } = buildIcons();
    const decoded = decodePng(trayPng);
    expect(decoded.width).toBe(TRAY_SIZE);
    expect(decoded.height).toBe(TRAY_SIZE);
    let opaque = 0;
    for (let p = 3; p < decoded.data.length; p += 4) {
      if (decoded.data[p] > 0) opaque += 1;
    }
    expect(opaque).toBeGreaterThan(0);
  });
});
