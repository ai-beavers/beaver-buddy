import { describe, expect, it } from 'vitest';
import { encodeIco } from './ico.ts';

// encodeIco treats image data as opaque bytes, so tests use small fake
// "PNG" payloads (real signature + a fill byte per size) and check the
// container structure only — pixel content is png.ts's business.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const fakePng = (fill: number, len: number): Buffer => Buffer.concat([PNG_SIG, Buffer.alloc(len, fill)]);

const IMAGES = [
  { size: 32, png: fakePng(0x32, 100) },
  { size: 16, png: fakePng(0x16, 50) },
  { size: 256, png: fakePng(0xff, 200) },
];
const SORTED_SIZES = [16, 32, 256];
const entryBase = (i: number): number => 6 + i * 16;

describe('encodeIco', () => {
  const ico = encodeIco(IMAGES);

  it('writes a little-endian ICONDIR header', () => {
    expect(ico.readUInt16LE(0)).toBe(0); // idReserved
    expect(ico.readUInt16LE(2)).toBe(1); // idType: 1 = icon
    expect(ico.readUInt16LE(4)).toBe(IMAGES.length); // idCount
  });

  it('sorts entries ascending by size regardless of input order', () => {
    const sizes = SORTED_SIZES.map((_, i) => {
      const b = ico[entryBase(i)];
      return b === 0 ? 256 : b;
    });
    expect(sizes).toEqual(SORTED_SIZES);
  });

  it('encodes 256px as byte 0, every other size literally', () => {
    expect(ico[entryBase(0)]).toBe(16); // bWidth of the 16px entry
    expect(ico[entryBase(0) + 1]).toBe(16); // bHeight
    expect(ico[entryBase(2)]).toBe(0); // 256 -> 0
    expect(ico[entryBase(2) + 1]).toBe(0);
  });

  it('writes the fixed entry fields (color count, reserved, planes, bit count)', () => {
    for (let i = 0; i < IMAGES.length; i += 1) {
      const base = entryBase(i);
      expect(ico[base + 2]).toBe(0); // bColorCount
      expect(ico[base + 3]).toBe(0); // bReserved
      expect(ico.readUInt16LE(base + 4)).toBe(1); // wPlanes
      expect(ico.readUInt16LE(base + 6)).toBe(32); // wBitCount: RGBA
    }
  });

  it('offsets walk the image data exactly, reconstructing every embedded PNG', () => {
    const bySize = new Map(IMAGES.map((img) => [img.size, img.png]));
    let offset = 6 + 16 * IMAGES.length;
    for (let i = 0; i < IMAGES.length; i += 1) {
      const base = entryBase(i);
      const sizeByte = ico[base];
      const size = sizeByte === 0 ? 256 : sizeByte;
      const bytesInRes = ico.readUInt32LE(base + 8);
      const imageOffset = ico.readUInt32LE(base + 12);
      expect(imageOffset).toBe(offset);
      const embedded = ico.subarray(imageOffset, imageOffset + bytesInRes);
      expect(embedded.subarray(0, 8).equals(PNG_SIG)).toBe(true);
      const expected = bySize.get(size);
      if (!expected) throw new Error(`test setup: no image for size ${size}`);
      expect(embedded.equals(expected)).toBe(true);
      offset += bytesInRes;
    }
    expect(offset).toBe(ico.length); // entries + images cover the file, no trailing bytes
  });

  it('rejects an empty image list, out-of-range sizes, and empty image data', () => {
    expect(() => encodeIco([])).toThrow(/at least one/);
    expect(() => encodeIco([{ size: 0, png: fakePng(1, 10) }])).toThrow(/1\.\.256/);
    expect(() => encodeIco([{ size: 300, png: fakePng(1, 10) }])).toThrow(/1\.\.256/);
    expect(() => encodeIco([{ size: 16.5, png: fakePng(1, 10) }])).toThrow(/1\.\.256/);
    expect(() => encodeIco([{ size: 16, png: Buffer.alloc(0) }])).toThrow(/empty/);
  });
});
