// CLI entry for `npm run assets:build`. Run directly with Node's built-in
// TypeScript support (Node 24 strips types with no flag/deps needed) —
// this file is never imported by anything else, so it's safe for it to
// have side effects (writing PNGs/JSON) at module scope.

// Beaver stages are no longer generated here (BL-11): they're ingested from
// the user's own images by ingest-images.mjs. This script now only builds
// the hand-authored lodge sheet, which stays on the programmatic
// pixel-map pipeline.

import fs from 'node:fs';
import path from 'node:path';
import { encodeIndexedPng } from './png.ts';
import { buildSheet, type Frame } from './sheet.ts';
import { buildContactSheet } from './contact-sheet.ts';
import { LODGE_ANIMATIONS, LODGE_ANIMATION_ORDER } from './pixel-maps/lodge.ts';

const FPS = 10;
const CONTACT_SCALE = 8;
const LODGE_NOTE =
  'spark frames are 8x8 particles drawn centered in the 48x48 tile (rows/cols 20-27)';

const repoRoot = path.join(import.meta.dirname, '..', '..');

function writeFileEnsuringDir(filePath: string, data: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

interface SheetSpec {
  readonly name: string;
  readonly animations: Readonly<Record<string, readonly Frame[]>>;
  readonly order: readonly string[];
  readonly tile: number;
  readonly note?: string;
}

const SHEETS: readonly SheetSpec[] = [
  { name: 'lodge', animations: LODGE_ANIMATIONS, order: LODGE_ANIMATION_ORDER, tile: 48, note: LODGE_NOTE },
];

for (const spec of SHEETS) {
  const { image, meta } = buildSheet(spec.animations, spec.order, spec.tile, FPS, spec.note);
  const sheetPath = path.join(repoRoot, 'assets', 'sprites', `${spec.name}.png`);
  const metaPath = path.join(repoRoot, 'assets', 'sprites', `${spec.name}.json`);
  writeFileEnsuringDir(sheetPath, encodeIndexedPng(image));
  writeFileEnsuringDir(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${sheetPath} (${image.width}x${image.height})`);

  const contactName = spec.name.replace('beaver-', '');
  const contact = buildContactSheet(spec.animations, spec.order, spec.tile, CONTACT_SCALE);
  const contactPath = path.join(repoRoot, 'docs', 'design-reviews', `BL-3-contact-${contactName}.png`);
  writeFileEnsuringDir(contactPath, encodeIndexedPng(contact));
  console.log(`wrote ${contactPath} (${contact.width}x${contact.height})`);
}
