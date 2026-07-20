// Shared tmp+rename atomic write for every persisted state file in the
// app's single state directory (CLAUDE.md: one app-support dir). Rename is
// atomic on the same filesystem, which app.getPath('userData') always is
// relative to its own directory — so readers (and a crash mid-write) never
// observe a partial file. Windows can transiently lock the temp file (virus
// scanners, indexers), so the rename is retried with a short backoff.

import fs from 'node:fs/promises';
import path from 'node:path';

// Four attempts: immediate, 10 ms, 50 ms, 100 ms. Total worst-case ~160 ms.
const RETRY_DELAYS_MS = [0, 10, 50, 100];

function isRetriableError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  // EPERM/EBUSY on rename are typically transient Windows locks.
  // EACCES is a permission problem and should not be retried.
  return code === 'EPERM' || code === 'EBUSY';
}

export async function atomicWriteFile(stateDir: string, fileName: string, contents: string | Buffer): Promise<void> {
  await fs.mkdir(stateDir, { recursive: true });
  const filePath = path.join(stateDir, fileName);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    await fs.writeFile(tmpPath, contents);

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      try {
        await fs.rename(tmpPath, filePath);
        return;
      } catch (error) {
        if (!isRetriableError(error) || attempt === RETRY_DELAYS_MS.length - 1) {
          throw error;
        }
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  } finally {
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {
      // best-effort cleanup only — the write error itself is what matters
    }
  }
}
