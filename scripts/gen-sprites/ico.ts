// ICO container encoder: ICONDIR header + ICONDIRENTRY table + the complete
// PNG streams as image data (Vista-style PNG-compressed entries — what
// Windows and electron-builder expect at every size we ship). Hand-rolled
// like the sibling PNG encoder (png.ts) — no image/ICO dependency.
// Container layout is little-endian throughout, unlike PNG's big-endian.

export interface IcoImage {
  /** Square edge length in pixels, 1..256 (256 is stored as byte 0). */
  readonly size: number;
  /** Complete PNG stream for this size. */
  readonly png: Buffer;
}

const HEADER_LEN = 6;
const ENTRY_LEN = 16;

export function encodeIco(images: readonly IcoImage[]): Buffer {
  if (images.length === 0) throw new Error('encodeIco needs at least one image');
  if (images.length > 0xffff) throw new Error(`entry count ${images.length} overflows the uint16 idCount field`);
  for (const { size, png } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) {
      throw new Error(`icon size must be an integer in 1..256, got ${size}`);
    }
    if (png.length === 0) throw new Error(`icon size ${size} has empty PNG data`);
  }

  // Ascending by size: the directory order consumers expect, and it makes
  // dwImageOffset values deterministic for the offset-walk test.
  const sorted = [...images].sort((a, b) => a.size - b.size);

  const header = Buffer.alloc(HEADER_LEN);
  header.writeUInt16LE(0, 0); // idReserved
  header.writeUInt16LE(1, 2); // idType: 1 = icon (2 = cursor)
  header.writeUInt16LE(sorted.length, 4); // idCount

  const entries: Buffer[] = [];
  let imageOffset = HEADER_LEN + ENTRY_LEN * sorted.length;
  for (const { size, png } of sorted) {
    const entry = Buffer.alloc(ENTRY_LEN);
    entry[0] = size === 256 ? 0 : size; // bWidth: 256 has no byte value, encodes as 0
    entry[1] = size === 256 ? 0 : size; // bHeight
    entry[2] = 0; // bColorCount: 0 = 256 or more colors
    entry[3] = 0; // bReserved
    entry.writeUInt16LE(1, 4); // wPlanes
    entry.writeUInt16LE(32, 6); // wBitCount: RGBA
    entry.writeUInt32LE(png.length, 8); // dwBytesInRes
    entry.writeUInt32LE(imageOffset, 12); // dwImageOffset
    entries.push(entry);
    imageOffset += png.length;
  }

  return Buffer.concat([header, ...entries, ...sorted.map(({ png }) => png)]);
}
