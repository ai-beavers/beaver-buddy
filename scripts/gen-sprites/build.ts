// CLI entry for `npm run assets:build`. Run directly with Node's built-in
// TypeScript support (Node 24 strips types with no flag/deps needed) —
// this file is never imported by anything else, so it's safe for it to
// have side effects (writing PNGs/JSON) at module scope.
//
// Phase 1 (this item) generates the baby stage only. Teen/adult/lodge come
// after the phase-1 design gate (see the BL-3 plan).

import fs from 'node:fs';
import path from 'node:path';
import { encodeIndexedPng } from './png.ts';
import { buildSheet } from './sheet.ts';
import { buildContactSheet } from './contact-sheet.ts';
import { ANIMATIONS, ANIMATION_ORDER } from './pixel-maps/baby.ts';

const TILE = 32;
const FPS = 10;
const CONTACT_SCALE = 8;

const repoRoot = path.join(import.meta.dirname, '..', '..');

function writeFileEnsuringDir(filePath: string, data: Buffer | string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

const { image, meta } = buildSheet(ANIMATIONS, ANIMATION_ORDER, TILE, FPS);
const sheetPath = path.join(repoRoot, 'assets', 'sprites', 'beaver-baby.png');
const metaPath = path.join(repoRoot, 'assets', 'sprites', 'beaver-baby.json');
writeFileEnsuringDir(sheetPath, encodeIndexedPng(image));
writeFileEnsuringDir(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`wrote ${sheetPath} (${image.width}x${image.height})`);
console.log(`wrote ${metaPath}`);

const contact = buildContactSheet(ANIMATIONS, ANIMATION_ORDER, TILE, CONTACT_SCALE);
const contactPath = path.join(repoRoot, 'docs', 'design-reviews', 'BL-3-contact-baby.png');
writeFileEnsuringDir(contactPath, encodeIndexedPng(contact));
console.log(`wrote ${contactPath} (${contact.width}x${contact.height})`);
