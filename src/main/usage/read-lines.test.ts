import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBoundedLines, readPrefix } from './read-lines';
import { MAX_LINE_BYTES } from './config';

// Synthetic fixtures only, in a fresh temp dir per test.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-read-lines-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('readBoundedLines', () => {
  it('returns the lines of a normal multi-line file, skipping empties', () => {
    const file = write('normal.jsonl', 'line-one\n\nline-two\nline-three');
    expect(readBoundedLines(file)).toEqual(['line-one', 'line-two', 'line-three']);
  });

  it('never yields a line over the byte bound: multi-MB line is dropped, later lines survive', () => {
    // Giant line spans many read chunks — the reader must discard its bytes
    // as they stream past instead of accumulating them.
    const giant = 'x'.repeat(MAX_LINE_BYTES * 3);
    const file = write('giant-middle.jsonl', `before\n${giant}\nafter-1\nafter-2`);

    const lines = readBoundedLines(file);
    expect(lines).toEqual(['before', 'after-1', 'after-2']);
    for (const line of lines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(MAX_LINE_BYTES);
    }
  });

  it('drops a trailing unterminated giant line (no final newline)', () => {
    const giant = 'y'.repeat(MAX_LINE_BYTES * 2);
    const file = write('giant-tail.jsonl', `keep-me\n${giant}`);
    expect(readBoundedLines(file)).toEqual(['keep-me']);
  });

  it('keeps a trailing line without a final newline when within bounds', () => {
    const file = write('no-final-newline.jsonl', 'first\nlast-no-newline');
    expect(readBoundedLines(file)).toEqual(['first', 'last-no-newline']);
  });

  it('reassembles a line that spans multiple read chunks', () => {
    // Longer than the reader's internal chunk but under the line bound.
    const long = 'z'.repeat(200_000);
    const file = write('spans-chunks.jsonl', `${long}\ntiny`);
    expect(readBoundedLines(file)).toEqual([long, 'tiny']);
  });

  it('returns an empty array for a missing file', () => {
    expect(readBoundedLines(path.join(tmpDir, 'missing.jsonl'))).toEqual([]);
  });
});

describe('readPrefix', () => {
  it('reads at most the requested bytes from the start', () => {
    const file = write('prefix.jsonl', 'abcdefghij');
    expect(readPrefix(file, 4)).toBe('abcd');
    expect(readPrefix(file, 100)).toBe('abcdefghij');
  });

  it('returns an empty string for a missing file', () => {
    expect(readPrefix(path.join(tmpDir, 'missing.jsonl'), 16)).toBe('');
  });
});
