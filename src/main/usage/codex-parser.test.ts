import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dedupeCodexEntries, parseCodexFile } from './codex-parser';

// Synthetic fixtures only, written to a fresh temp dir per test (CLAUDE.md:
// never the operator's real ~/.codex). Fake token counts and ids only.

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-codex-parser-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, lines: readonly string[]): string {
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
  return filePath;
}

interface UsageFields {
  readonly input_tokens?: number;
  readonly cached_input_tokens?: number;
  readonly output_tokens?: number;
  readonly reasoning_output_tokens?: number;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

function tokenCountLine(timestamp: string, total: UsageFields, last?: UsageFields, model?: string): string {
  return JSON.stringify({
    timestamp,
    type: 'event_msg',
    payload: { type: 'token_count', info: { total_token_usage: total, ...(last ? { last_token_usage: last } : {}), ...(model ? { model } : {}) } },
  });
}

describe('parseCodexFile', () => {
  it('takes deltas between consecutive cumulative snapshots', () => {
    const file = writeFixture('rollout-1.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 }),
      tokenCountLine('2026-07-13T09:05:00.000Z', { input_tokens: 250, output_tokens: 60 }),
    ]);

    const entries = parseCodexFile(file);
    expect(entries).toEqual([
      { timestampMs: Date.parse('2026-07-13T09:00:00.000Z'), model: undefined, inputTokens: 100, outputTokens: 20, cacheCreationTokens: 0, cacheReadTokens: 0 },
      { timestampMs: Date.parse('2026-07-13T09:05:00.000Z'), model: undefined, inputTokens: 150, outputTokens: 40, cacheCreationTokens: 0, cacheReadTokens: 0 },
    ]);
  });

  it('extracts the model from the token_count info when present', () => {
    const file = writeFixture('rollout-model.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 }, undefined, 'codex-model-1'),
    ]);
    const entries = parseCodexFile(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ inputTokens: 100, outputTokens: 20, model: 'codex-model-1' });
  });

  it('leaves model undefined when the token_count info has no model field', () => {
    const file = writeFixture('rollout-no-model.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 }),
    ]);
    const entries = parseCodexFile(file);
    expect(entries[0]).toMatchObject({ inputTokens: 100, outputTokens: 20, model: undefined });
  });

  it('sums deltas across multiple sessions independently (fresh baseline per file)', () => {
    const fileA = writeFixture('rollout-a.jsonl', [tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 })]);
    const fileB = writeFixture('rollout-b.jsonl', [tokenCountLine('2026-07-13T10:00:00.000Z', { input_tokens: 40, output_tokens: 10 })]);

    expect(parseCodexFile(fileA)[0]).toMatchObject({ inputTokens: 100, outputTokens: 20 });
    expect(parseCodexFile(fileB)[0]).toMatchObject({ inputTokens: 40, outputTokens: 10 });
  });

  it('prefers last_token_usage (the per-turn delta) over cumulative subtraction', () => {
    const file = writeFixture('rollout-last.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 }, { input_tokens: 100, output_tokens: 20 }),
      // cumulative jumped by 400/80 but last says the turn was 150/30 — last wins.
      tokenCountLine('2026-07-13T09:05:00.000Z', { input_tokens: 500, output_tokens: 100 }, { input_tokens: 150, output_tokens: 30 }),
    ]);

    const entries = parseCodexFile(file);
    expect(entries[1]).toMatchObject({ inputTokens: 150, outputTokens: 30 });
  });

  it('clamps a dropped cumulative to zero via saturating subtraction and rebaselines', () => {
    const file = writeFixture('rollout-restart.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 500, output_tokens: 200 }),
      tokenCountLine('2026-07-13T09:10:00.000Z', { input_tokens: 30, output_tokens: 10 }), // dropped below baseline
      tokenCountLine('2026-07-13T09:15:00.000Z', { input_tokens: 80, output_tokens: 25 }), // grows from the NEW (lower) baseline
    ]);

    const entries = parseCodexFile(file);
    // Event 2 saturates to all-zero and is dropped; event 3 counts against 30/10.
    expect(entries).toEqual([
      expect.objectContaining({ inputTokens: 500, outputTokens: 200 }),
      expect.objectContaining({ inputTokens: 50, outputTokens: 15 }),
    ]);
  });

  it('drops events whose usage fields are all zero', () => {
    const file = writeFixture('rollout-zero.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }),
      tokenCountLine('2026-07-13T09:01:00.000Z', { input_tokens: 10, output_tokens: 5 }),
    ]);
    expect(parseCodexFile(file)).toHaveLength(1);
  });

  it('splits cached_input_tokens out of input_tokens (cached is a subset, not additive)', () => {
    const file = writeFixture('rollout-cached.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 1000, cached_input_tokens: 700, output_tokens: 300 }),
    ]);
    const entries = parseCodexFile(file);
    expect(entries).toHaveLength(1);
    // fresh input = 1000 - 700 cached; cacheReadTokens carries the cached portion.
    expect(entries[0]).toMatchObject({ inputTokens: 300, cacheReadTokens: 700, outputTokens: 300 });
  });

  it('accepts field-name aliases (prompt_tokens/completion_tokens)', () => {
    const file = writeFixture('rollout-alias.jsonl', [
      tokenCountLine('2026-07-13T09:00:00.000Z', { prompt_tokens: 120, completion_tokens: 40 }),
    ]);
    expect(parseCodexFile(file)[0]).toMatchObject({ inputTokens: 120, outputTokens: 40 });
  });

  it("elides a forked file's same-second replay burst but inherits its baseline", () => {
    // A forked thread replays inherited events as a burst sharing one
    // timestamp-second; the real turns follow in later seconds.
    const metaLine = JSON.stringify({
      timestamp: '2026-07-13T09:00:00.000Z',
      type: 'session_meta',
      payload: { session_id: 'sess-fork-1', forked_from_id: 'sess-parent-1' },
    });
    const file = writeFixture('rollout-fork.jsonl', [
      metaLine,
      tokenCountLine('2026-07-13T09:00:00.100Z', { input_tokens: 400, output_tokens: 90 }),
      tokenCountLine('2026-07-13T09:00:00.900Z', { input_tokens: 800, output_tokens: 150 }),
      // First event outside the burst: counts against the inherited 800/150 baseline.
      tokenCountLine('2026-07-13T09:02:00.000Z', { input_tokens: 950, output_tokens: 180 }),
      tokenCountLine('2026-07-13T09:03:00.000Z', { input_tokens: 1000, output_tokens: 200 }),
    ]);

    const entries = parseCodexFile(file);
    expect(entries).toEqual([
      expect.objectContaining({ inputTokens: 150, outputTokens: 30 }),
      expect.objectContaining({ inputTokens: 50, outputTokens: 20 }),
    ]);
  });

  it('does not elide a forked file whose first two events are in different seconds', () => {
    const metaLine = JSON.stringify({
      timestamp: '2026-07-13T09:00:00.000Z',
      type: 'session_meta',
      payload: { session_id: 'sess-fork-2', forked_from_id: 'sess-parent-2' },
    });
    const file = writeFixture('rollout-fork-noreplay.jsonl', [
      metaLine,
      tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 100, output_tokens: 20 }),
      tokenCountLine('2026-07-13T09:00:05.000Z', { input_tokens: 250, output_tokens: 60 }),
    ]);

    const entries = parseCodexFile(file);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ inputTokens: 100, outputTokens: 20 });
  });

  it('ignores non-token_count event lines', () => {
    const file = writeFixture('rollout-mixed.jsonl', [
      JSON.stringify({ timestamp: '2026-07-13T09:00:00.000Z', type: 'event_msg', payload: { type: 'agent_message' } }),
      tokenCountLine('2026-07-13T09:01:00.000Z', { input_tokens: 10, output_tokens: 5 }),
    ]);
    expect(parseCodexFile(file)).toHaveLength(1);
  });

  it('skips malformed JSON lines without throwing', () => {
    const file = writeFixture('rollout-bad.jsonl', ['{broken', tokenCountLine('2026-07-13T09:00:00.000Z', { input_tokens: 10, output_tokens: 5 })]);
    expect(parseCodexFile(file)).toHaveLength(1);
  });

  it('returns an empty array for a missing file', () => {
    expect(parseCodexFile(path.join(tmpDir, 'missing.jsonl'))).toEqual([]);
  });
});

describe('dedupeCodexEntries', () => {
  it('drops identical events across files, keeping the first', () => {
    const entry = { timestampMs: 1000, inputTokens: 10, outputTokens: 5, cacheCreationTokens: 0, cacheReadTokens: 3 };
    const different = { ...entry, outputTokens: 6 };
    expect(dedupeCodexEntries([entry, { ...entry }, different])).toEqual([entry, different]);
  });
});
