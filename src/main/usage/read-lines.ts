// Bounded synchronous file reading for usage logs (CLAUDE.md "bounded
// reads"): a whole log file is never materialized as one string, so a
// pathological single giant line (no newline) can never occupy more than
// MAX_LINE_BYTES + one chunk of memory — its bytes are discarded as they
// stream past and reading resumes at the next newline. Kept synchronous so
// the tracker's refresh stays non-overlapping.

import fs from 'node:fs';
import { MAX_LINE_BYTES } from './config';

const CHUNK_BYTES = 64 * 1024;

// Returns the complete lines of the file, each at most maxLineBytes long;
// oversized lines are dropped entirely (never assembled in memory). Empty
// lines are omitted. Unreadable file -> empty array.
export function readBoundedLines(filePath: string, maxLineBytes: number = MAX_LINE_BYTES): string[] {
  let fd: number;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return [];
  }

  const lines: string[] = [];
  const chunk = Buffer.allocUnsafe(CHUNK_BYTES);
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let discardingOversized = false;

  try {
    for (;;) {
      const bytesRead = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (bytesRead <= 0) break;

      let start = 0;
      while (start < bytesRead) {
        // Splitting on the raw 0x0A byte is UTF-8-safe: it never occurs
        // inside a multi-byte sequence.
        const newline = chunk.indexOf(0x0a, start);

        if (newline === -1 || newline >= bytesRead) {
          const restBytes = bytesRead - start;
          if (!discardingOversized) {
            if (pendingBytes + restBytes > maxLineBytes) {
              pending = [];
              pendingBytes = 0;
              discardingOversized = true;
            } else {
              pending.push(Buffer.from(chunk.subarray(start, bytesRead)));
              pendingBytes += restBytes;
            }
          }
          break;
        }

        if (discardingOversized) {
          // The oversized line just ended — resume normal accumulation.
          discardingOversized = false;
        } else {
          const segmentBytes = newline - start;
          if (pendingBytes + segmentBytes > maxLineBytes) {
            // Oversized line fully contained in buffered chunks — drop it.
          } else if (pendingBytes > 0) {
            pending.push(Buffer.from(chunk.subarray(start, newline)));
            lines.push(Buffer.concat(pending).toString('utf8'));
          } else if (segmentBytes > 0) {
            lines.push(chunk.subarray(start, newline).toString('utf8'));
          }
          pending = [];
          pendingBytes = 0;
        }

        start = newline + 1;
      }
    }

    // Trailing line without a final newline.
    if (!discardingOversized && pendingBytes > 0) {
      lines.push(Buffer.concat(pending).toString('utf8'));
    }
  } finally {
    fs.closeSync(fd);
  }

  return lines;
}

// Reads at most maxBytes from the start of the file (for marker sniffing).
// Unreadable file -> empty string.
export function readPrefix(filePath: string, maxBytes: number): string {
  let fd: number;
  try {
    fd = fs.openSync(filePath, 'r');
  } catch {
    return '';
  }
  try {
    const buffer = Buffer.allocUnsafe(maxBytes);
    const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, Math.max(0, bytesRead)).toString('utf8');
  } catch {
    return '';
  } finally {
    fs.closeSync(fd);
  }
}
