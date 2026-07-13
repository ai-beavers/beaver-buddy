// One-off generator for assets/tray-iconTemplate.png — a 16x16 macOS
// "template image" (grayscale+alpha; macOS auto-tints black/opaque pixels
// for light/dark menu bars). Hand-rolled with Node's zlib + a small CRC32,
// no image/PNG dependency, so no asset-pipeline package is needed for one
// tiny glyph. Run once: `node scripts/generate-tray-icon.js`. Output is
// committed; this script does not run as part of the build.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 16;

// Simple filled circle (beaver head) + two small ear bumps. 1 = opaque black.
function buildMask() {
  const mask = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  const cx = 7.5;
  const cy = 8.5;
  const r = 6;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) mask[y][x] = 1;
    }
  }
  // ear bumps
  mask[1][3] = 1; mask[1][4] = 1; mask[2][3] = 1; mask[2][4] = 1;
  mask[1][11] = 1; mask[1][12] = 1; mask[2][11] = 1; mask[2][12] = 1;
  return mask;
}

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

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function buildPng(mask) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(SIZE, 0);
  ihdrData.writeUInt32BE(SIZE, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 4; // color type: grayscale + alpha
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  const raw = Buffer.alloc(SIZE * (1 + SIZE * 2));
  let offset = 0;
  for (let y = 0; y < SIZE; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < SIZE; x += 1) {
      raw[offset] = 0; // gray: black
      raw[offset + 1] = mask[y][x] ? 255 : 0; // alpha
      offset += 2;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const outPath = path.join(__dirname, '..', 'assets', 'tray-iconTemplate.png');
fs.writeFileSync(outPath, buildPng(buildMask()));
console.log(`wrote ${outPath}`);
