// Shared cool-toned palette for all beaver sprites (assets/STYLE.md pins this
// once it's written). One char in a pixel-map string = one key here; '.' is
// always transparent and never appears in this table. Kept to only the
// colors actually used — extend when a later stage needs a new tone, don't
// pre-allocate unused slots.
//
// Cap is 16 colors (design-gate rule); we're at 10.

export type PaletteChar = keyof typeof PALETTE;

export const PALETTE = {
  k: [0x2c, 0x31, 0x38], // outline — cool slate (deliberately not pure black)
  '1': [0x5c, 0x4f, 0x47], // fur shadow — cool taupe-brown, dark
  '2': [0x7c, 0x6b, 0x5e], // fur mid — cool taupe-brown
  '3': [0xa0, 0x8d, 0x7a], // fur highlight — cool taupe-brown, light
  '5': [0x8f, 0xad, 0xa9], // belly / muzzle — teal-gray
  '6': [0x33, 0x3c, 0x46], // tail — dark slate
  '7': [0x4b, 0x58, 0x66], // tail highlight / scute lines — lighter slate
  '8': [0xee, 0xf2, 0xee], // teeth — cool off-white
  '9': [0x4f, 0xb8, 0xb0], // accent — cyan/teal eye-shine
  '0': [0xcf, 0xe0, 0xdd], // eye white — pale cool teal-gray
} as const satisfies Record<string, readonly [number, number, number]>;

export const TRANSPARENT = '.';

export interface PaletteTable {
  /** char -> PNG palette index (index 0 is always the transparent slot). */
  readonly indexOf: Readonly<Record<string, number>>;
  /** PNG PLTE entries, index-aligned; index 0 is a transparent placeholder. */
  readonly colors: readonly (readonly [number, number, number])[];
}

/**
 * Palette + PNG index table, index 0 reserved for transparency. `extra`
 * lets callers (e.g. the contact sheet) append more colors — like a
 * checkerboard background — under their own char keys without touching the
 * sprite palette itself.
 */
export function buildPaletteTable(extra: Record<string, readonly [number, number, number]> = {}): PaletteTable {
  const indexOf: Record<string, number> = {};
  const colors: (readonly [number, number, number])[] = [[0, 0, 0]];
  for (const [ch, rgb] of [...Object.entries(PALETTE), ...Object.entries(extra)]) {
    indexOf[ch] = colors.length;
    colors.push(rgb);
  }
  return { indexOf, colors };
}
