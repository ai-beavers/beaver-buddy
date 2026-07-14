// Shared tmp+rename atomic write for every persisted state file in the
// app's single state directory (CLAUDE.md: one app-support dir). Rename is
// atomic on the same filesystem, which app.getPath('userData') always is
// relative to its own directory — so readers (and a crash mid-write) never
// observe a partial file. Extracted from xp/store.ts so onboarding.ts (and
// any future state file) shares the exact same guarantee instead of
// re-implementing it.

import fs from 'node:fs';
import path from 'node:path';

export function atomicWriteFile(stateDir: string, fileName: string, contents: string): void {
  fs.mkdirSync(stateDir, { recursive: true });
  const filePath = path.join(stateDir, fileName);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    fs.writeFileSync(tmpPath, contents);
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch {
      // best-effort cleanup only — the write error itself is what matters
    }
    throw error;
  }
}
