// Installs the committed agent skills from skills/ into the local, gitignored
// install location .agents/skills/ so agents pick them up in their context.
//
// Existing skill directories are skipped by default: local edits in
// .agents/skills/ are work-in-progress and must never be clobbered.
// Pass --force to overwrite a skill with the committed version.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, 'skills');
const targetDir = join(repoRoot, '.agents', 'skills');
const force = process.argv.includes('--force');

if (!existsSync(sourceDir)) {
  console.error('skills/ directory not found — run from a full repo checkout.');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

const skills = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

let installed = 0;
let skipped = 0;
let overwritten = 0;

for (const skill of skills) {
  const target = join(targetDir, skill);
  if (existsSync(target)) {
    if (!force) {
      console.log(`skip  ${skill} (already installed; use --force to overwrite)`);
      skipped += 1;
      continue;
    }
    rmSync(target, { recursive: true, force: true });
    overwritten += 1;
  }
  cpSync(join(sourceDir, skill), target, { recursive: true });
  console.log(`copy  ${skill}`);
  installed += 1;
}

console.log(
  `\n${installed} skill(s) copied to .agents/skills/` +
    (skipped ? `, ${skipped} skipped` : '') +
    (overwritten ? ` (${overwritten} overwritten via --force)` : ''),
);
