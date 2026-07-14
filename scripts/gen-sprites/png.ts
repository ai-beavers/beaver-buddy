// Hand-rolled indexed-color PNG encoder (node:zlib deflate + a small CRC32
// table) — no image/PNG dependency. Same technique as the BL-2 tray-icon
// generator (git history: scripts/generate-tray-icon.js), generalized to an
// indexed palette with one transparent index. Indexed color is a natural fit
// here: it makes "every pixel is a palette color or transparent" a property
// of the file format itself, not just a convention.

import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  /** One palette index per pixel, row-major, length === width * height. */
  readonly pixels: Uint8Array;
  /** RGB triples, index-aligned with the values that appear in `pixels`. */
  readonly palette: readonly (readonly [number, number, number])[];
  /** Palette index that renders fully transparent. */
  readonly transparentIndex: number;
}

export function encodeIndexedPng(image: IndexedImage): Buffer {
  const { width, height, pixels, palette, transparentIndex } = image;
  if (pixels.length !== width * height) {
    throw new Error(`pixel count ${pixels.length} !== ${width}x${height}`);
  }
  if (palette.length > 256) throw new Error('palette too large for indexed PNG');

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 3; // color type: indexed
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  const plteData = Buffer.alloc(palette.length * 3);
  palette.forEach(([r, g, b], i) => {
    plteData[i * 3] = r;
    plteData[i * 3 + 1] = g;
    plteData[i * 3 + 2] = b;
  });
  const plte = chunk('PLTE', plteData);

  const trnsData = Buffer.alloc(transparentIndex + 1, 255);
  trnsData[transparentIndex] = 0;
  const trns = chunk('tRNS', trnsData);

  const raw = Buffer.alloc(height * (1 + width));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      raw[offset] = pixels[y * width + x];
      offset += 1;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, plte, trns, idat, iend]);
}

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** 4 bytes (R,G,B,A) per pixel, row-major, length === width * height * 4. */
  readonly data: Uint8Array | Uint8ClampedArray;
}

// Truecolor-with-alpha encoder (PNG color type 6) — used for the ingested
// beaver sheets (BL-11), which ship the user's own colors as-is with no
// palette quantization, unlike the indexed encoder above (still used for the
// hand-authored lodge sheet). Shares the chunk/crc32 helpers above.
export function encodeRgbaPng(image: RgbaImage): Buffer {
  const { width, height, data } = image;
  if (data.length !== width * height * 4) {
    throw new Error(`pixel data length ${data.length} !== ${width}x${height}x4`);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: truecolor + alpha
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < stride; x += 1) {
      raw[offset] = data[y * stride + x];
      offset += 1;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}
