import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseClaudeFile } from './claude-parser';

// Synthetic fixtures only, written to a fresh temp dir per test (CLAUDE.md:
// never the operator's real ~/.claude). Fake project slugs / message ids.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-claude-parser-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, lines: readonly string[]): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
  return filePath;
}

function usageLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2026-07-13T10:00:00.000Z',
    requestId: 'req-1',
    message: {
      id: 'msg-1',
      model: 'claude-3-5-sonnet-20240620',
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 5 },
    },
    ...overrides,
  });
}

describe('parseClaudeFile', () => {
  it('parses a valid usage line', () => {
    const file = writeFixture('session-a.jsonl', [usageLine()]);
    const entries = parseClaudeFile(file);
    expect(entries).toEqual([
      { timestampMs: Date.parse('2026-07-13T10:00:00.000Z'), model: 'claude-3-5-sonnet-20240620', inputTokens: 100, outputTokens: 50, cacheCreationTokens: 10, cacheReadTokens: 5 },
    ]);
  });

  it('skips malformed JSON lines without throwing', () => {
    const file = writeFixture('session-b.jsonl', ['{not json', usageLine()]);
    const entries = parseClaudeFile(file);
    expect(entries).toHaveLength(1);
  });

  it('skips an oversized line', () => {
    const hugeLine = JSON.stringify({
      requestId: 'req-huge',
      timestamp: '2026-07-13T10:00:00.000Z',
      message: { id: 'msg-huge', usage: { input_tokens: 1 }, padding: 'x'.repeat(2_000_000) },
    });
    const file = writeFixture('session-c.jsonl', [hugeLine, usageLine()]);
    const entries = parseClaudeFile(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.inputTokens).toBe(100);
  });

  it('keeps the LAST snapshot when an intermediate one precedes it under the same key', () => {
    const intermediate = usageLine({ message: { id: 'msg-1', usage: { input_tokens: 10, output_tokens: 5 } } });
    const final = usageLine({ message: { id: 'msg-1', usage: { input_tokens: 100, output_tokens: 80 } } });
    const file = writeFixture('session-d.jsonl', [intermediate, final]);

    const entries = parseClaudeFile(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ inputTokens: 100, outputTokens: 80 });
  });

  it('counts a subagent/sidechain-tagged line the same as a normal line, once', () => {
    const file = writeFixture('subagent-a.jsonl', [usageLine({ isSidechain: true, requestId: 'req-sub', message: { id: 'msg-sub', usage: { input_tokens: 30, output_tokens: 20 } } })]);
    const entries = parseClaudeFile(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ inputTokens: 30, outputTokens: 20 });
  });

  it('defaults missing usage token fields to zero and preserves the model', () => {
    const file = writeFixture('session-e.jsonl', [usageLine({ message: { id: 'msg-1', model: 'claude-opus-4', usage: { input_tokens: 42 } } })]);
    const entries = parseClaudeFile(file);
    expect(entries[0]).toMatchObject({ inputTokens: 42, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, model: 'claude-opus-4' });
  });

  it('falls back to undefined model when the message has no model field', () => {
    const file = writeFixture('session-no-model.jsonl', [usageLine({ message: { id: 'msg-1', usage: { input_tokens: 10 } } })]);
    const entries = parseClaudeFile(file);
    expect(entries[0]).toMatchObject({ inputTokens: 10, model: undefined });
  });

  it('skips lines with no usage object at all (e.g. user messages)', () => {
    const file = writeFixture('session-f.jsonl', [JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }), usageLine()]);
    const entries = parseClaudeFile(file);
    expect(entries).toHaveLength(1);
  });

  it('returns an empty array for a missing file', () => {
    expect(parseClaudeFile(path.join(tmpDir, 'does-not-exist.jsonl'))).toEqual([]);
  });

  it('ignores blank lines', () => {
    const file = writeFixture('session-g.jsonl', ['', usageLine(), '']);
    expect(parseClaudeFile(file)).toHaveLength(1);
  });
});
