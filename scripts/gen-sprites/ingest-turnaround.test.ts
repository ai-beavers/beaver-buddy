import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from './ingest-images.mjs';
import {
  buildTurnaround,
  composeRow,
  dropStrayFragments,
  FIGURES,
  MIRROR_SOURCES,
  VIEW_ORDER,
  mirrorTile,
} from './ingest-turnaround.mjs';

function solidTile(size: number, rgba: readonly [number, number, number, number]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width: size, height: size, data };
}

describe('mirrorTile', () => {
  it('flips horizontally: column x maps to column width-1-x', () => {
    const img = { width: 3, height: 1, data: new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255]) };
    const out = mirrorTile(img);
    expect([out.data[0], out.data[4], out.data[8]]).toEqual([3, 2, 1]);
  });

  it('is its own inverse — mirroring twice restores the original', () => {
    const img = { width: 4, height: 2, data: new Uint8ClampedArray(32).map((_, i) => i * 3) };
    expect(Array.from(mirrorTile(mirrorTile(img)).data)).toEqual(Array.from(img.data));
  });
});

describe('composeRow', () => {
  it('lays tiles out left to right at tile-width offsets', () => {
    const row = composeRow([solidTile(2, [10, 0, 0, 255]), solidTile(2, [20, 0, 0, 255])]);
    // composeRow always emits 96px-tall tiles; only check the geometry contract.
    expect(row.width).toBe(2 * 96);
    expect(row.height).toBe(96);
  });
});

describe('dropStrayFragments', () => {
  it('removes a small detached blob and keeps the large one', () => {
    const size = 30;
    const img = solidTile(size, [0, 0, 0, 0]);
    const setOpaque = (x: number, y: number) => {
      img.data[(y * size + x) * 4 + 3] = 255;
    };
    // Main component 20x20 = 400px; stray is a single pixel far away, i.e.
    // 0.25% of it — comfortably under the 1% default, not on the boundary.
    for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) setOpaque(x, y);
    setOpaque(28, 28);

    const out = dropStrayFragments(img);
    expect(out.data[(28 * size + 28) * 4 + 3]).toBe(0);
    expect(out.data[(5 * size + 5) * 4 + 3]).toBe(255);
  });

  // The threshold is strictly-less-than, so a fragment sitting exactly at
  // minFraction survives. Pinned because it is the kind of boundary that is
  // easy to flip by accident later.
  it('keeps a fragment exactly at the threshold', () => {
    const size = 30;
    const img = solidTile(size, [0, 0, 0, 0]);
    const setOpaque = (x: number, y: number) => {
      img.data[(y * size + x) * 4 + 3] = 255;
    };
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < 10; x += 1) setOpaque(x, y);
    setOpaque(28, 28); // 1px against 100px == exactly 1%

    expect(dropStrayFragments(img, 0.01).data[(28 * size + 28) * 4 + 3]).toBe(255);
  });

  it('leaves a single-component image untouched', () => {
    const img = solidTile(4, [0, 0, 0, 255]);
    expect(dropStrayFragments(img)).toBe(img);
  });
});

describe('committed turnaround sheets', () => {
  describe.each(FIGURES)('$name', (figure) => {
    const pngPath = fileURLToPath(
      new URL(`../../assets-src/reference/turnaround/${figure.name}-turnaround.png`, import.meta.url),
    );
    const metaPath = pngPath.replace(/\.png$/, '.json');

    it('sheet dimensions agree with its manifest', () => {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const decoded = decodePng(fs.readFileSync(pngPath));
      expect(decoded.width).toBe(meta.sheetWidth);
      expect(decoded.height).toBe(meta.sheetHeight);
      expect(meta.sheetWidth).toBe(meta.rows[0].frames * meta.tile);
      expect(meta.sheetHeight).toBe(meta.tile);
      expect(meta.views).toEqual([...VIEW_ORDER]);
      // fps 0 marks it as a static reference sheet, not a playable row —
      // nothing in src/ should ever animate this.
      expect(meta.fps).toBe(0);
    });

    it('every view has opaque content', () => {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const sheet = decodePng(fs.readFileSync(pngPath));
      for (let view = 0; view < meta.rows[0].frames; view += 1) {
        let opaque = 0;
        for (let y = 0; y < meta.tile; y += 1) {
          for (let x = 0; x < meta.tile; x += 1) {
            if (sheet.data[((y * sheet.width) + view * meta.tile + x) * 4 + 3] > 8) opaque += 1;
          }
        }
        expect(opaque, `view ${meta.views[view]} is empty`).toBeGreaterThan(0);
      }
    });

    // The mirror contract is the reason the left half costs nothing. If it
    // ever silently breaks, the sheet quietly stops being a turnaround.
    it('mirrored views are exact horizontal mirrors of their source views', () => {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const sheet = decodePng(fs.readFileSync(pngPath));
      const tileAt = (index: number) => {
        const data = new Uint8ClampedArray(meta.tile * meta.tile * 4);
        for (let y = 0; y < meta.tile; y += 1) {
          const src = (y * sheet.width + index * meta.tile) * 4;
          data.set(sheet.data.subarray(src, src + meta.tile * 4), y * meta.tile * 4);
        }
        return { width: meta.tile, height: meta.tile, data };
      };

      expect(meta.mirrored).toEqual(Object.keys(MIRROR_SOURCES).map(Number));
      for (const [target, source] of Object.entries(MIRROR_SOURCES)) {
        const expected = mirrorTile(tileAt(source as number));
        const actual = tileAt(Number(target));
        expect(Array.from(actual.data), `view ${meta.views[Number(target)]}`).toEqual(
          Array.from(expected.data),
        );
      }
    });
  });
});

// The raw Comfy dumps under assets-src/comfyui/ are gitignored, so a fresh
// clone cannot rebuild — these skip rather than fail there.
describe('rebuild from source', () => {
  describe.each(FIGURES)('$name', (figure) => {
    const sourcePath = fileURLToPath(new URL(`../../${figure.source}`, import.meta.url));
    const hasSource = fs.existsSync(sourcePath);

    it.skipIf(!hasSource)('is deterministic and matches the committed sheet byte-for-byte', () => {
      const a = buildTurnaround(figure);
      const b = buildTurnaround(figure);
      expect(a.png.equals(b.png)).toBe(true);

      const committed = fs.readFileSync(
        fileURLToPath(
          new URL(`../../assets-src/reference/turnaround/${figure.name}-turnaround.png`, import.meta.url),
        ),
      );
      expect(committed.equals(a.png)).toBe(true);
    });
  });
});
