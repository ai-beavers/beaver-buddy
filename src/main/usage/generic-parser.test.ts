import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { parseGenericUsageFile } from './generic-parser';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-generic-parser-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

it('maps Kimi wire token_usage fields without counting cache reads twice', () => {
  const file = path.join(tmpDir, 'wire.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      timestamp: '2026-07-22T10:00:00.000Z',
      token_usage: { input_other: 100, output: 30, input_cache_read: 40, input_cache_creation: 10 },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T10:00:00.000Z'), inputTokens: 100, outputTokens: 30, cacheCreationTokens: 10, cacheReadTokens: 40 },
  ]);
});

it('maps camelCase usage fields used by JSON session logs', () => {
  const file = path.join(tmpDir, 'session.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      createdAt: '2026-07-22T11:00:00.000Z',
      usage: { inputTokens: 20, outputTokens: 7, cacheReadTokens: 5, cacheCreationTokens: 3 },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T11:00:00.000Z'), inputTokens: 15, outputTokens: 7, cacheCreationTokens: 3, cacheReadTokens: 5 },
  ]);
});


it('accepts numeric timestamps in Unix seconds', () => {
  const file = path.join(tmpDir, 'seconds.jsonl');
  fs.writeFileSync(file, `${JSON.stringify({ created_at: 1_785_241_200, usage: { inputTokens: 10 } })}\n`);
  expect(parseGenericUsageFile(file)[0]?.timestampMs).toBe(1_785_241_200_000);
});

it('parses pretty-printed JSON message files', () => {
  const file = path.join(tmpDir, 'message.json');
  fs.writeFileSync(file, JSON.stringify({ timestamp: '2026-07-22T12:00:00.000Z', usage: { inputTokens: 12, outputTokens: 4 } }, null, 2));
  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T12:00:00.000Z'), inputTokens: 12, outputTokens: 4, cacheCreationTokens: 0, cacheReadTokens: 0 },
  ]);
});
