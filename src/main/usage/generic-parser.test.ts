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
      model: 'kimi-k3',
      token_usage: { input_other: 100, output: 30, input_cache_read: 40, input_cache_creation: 10 },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T10:00:00.000Z'), model: 'kimi-k3', inputTokens: 100, outputTokens: 30, cacheCreationTokens: 10, cacheReadTokens: 40 },
  ]);
});

it('falls back to modelName when model is absent', () => {
  const file = path.join(tmpDir, 'modelname.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      timestamp: '2026-07-22T10:00:00.000Z',
      modelName: 'some-model',
      usage: { inputTokens: 10, outputTokens: 5 },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T10:00:00.000Z'), model: 'some-model', inputTokens: 10, outputTokens: 5, cacheCreationTokens: 0, cacheReadTokens: 0 },
  ]);
});

it('sets model to undefined when neither model nor modelName is present', () => {
  const file = path.join(tmpDir, 'nomodel.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      timestamp: '2026-07-22T10:00:00.000Z',
      usage: { inputTokens: 10, outputTokens: 5 },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    { timestampMs: Date.parse('2026-07-22T10:00:00.000Z'), model: undefined, inputTokens: 10, outputTokens: 5, cacheCreationTokens: 0, cacheReadTokens: 0 },
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

it('parses pi-agent nested message.usage with model in message', () => {
  const file = path.join(tmpDir, 'pi-session.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      type: 'message',
      timestamp: '2026-07-23T17:44:17.902Z',
      message: {
        role: 'assistant',
        model: 'deepseek-v4-pro',
        usage: { input: 7216, output: 89, cacheRead: 0, cacheWrite: 0, reasoning: 19, totalTokens: 7305 },
      },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    {
      timestampMs: Date.parse('2026-07-23T17:44:17.902Z'),
      model: 'deepseek-v4-pro',
      inputTokens: 7216,
      outputTokens: 89,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    },
  ]);
});

it('treats pi-agent input as already-fresh when cacheRead field is present', () => {
  const file = path.join(tmpDir, 'pi-cache.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      type: 'message',
      timestamp: '2026-07-23T17:44:21.534Z',
      message: {
        role: 'assistant',
        model: 'deepseek-v4-pro',
        usage: { input: 1490, output: 255, cacheRead: 7296, cacheWrite: 0, reasoning: 123, totalTokens: 9041 },
      },
    })}\n`,
  );

  // Pi's input is net — already excludes cache. inputAlreadyFresh must be
  // true so the parser does not compute input − cacheRead (1490 − 7296 = <0).
  expect(parseGenericUsageFile(file)).toEqual([
    {
      timestampMs: Date.parse('2026-07-23T17:44:21.534Z'),
      model: 'deepseek-v4-pro',
      inputTokens: 1490,
      outputTokens: 255,
      cacheCreationTokens: 0,
      cacheReadTokens: 7296,
    },
  ]);
});

it('falls back to message.modelName for pi-agent nested format', () => {
  const file = path.join(tmpDir, 'pi-modelname.jsonl');
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      type: 'message',
      timestamp: '2026-07-23T18:00:00.000Z',
      message: {
        role: 'assistant',
        modelName: 'deepseek-v4-pro',
        usage: { input: 100, output: 50 },
      },
    })}\n`,
  );

  expect(parseGenericUsageFile(file)).toEqual([
    {
      timestampMs: Date.parse('2026-07-23T18:00:00.000Z'),
      model: 'deepseek-v4-pro',
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    },
  ]);
});

it('skips non-assistant pi messages (user, toolResult, model_change)', () => {
  const file = path.join(tmpDir, 'pi-mixed.jsonl');
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ type: 'session', timestamp: '2026-07-23T17:44:08.285Z' }),
      JSON.stringify({ type: 'model_change', timestamp: '2026-07-23T17:44:10.210Z' }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-07-23T17:44:15.559Z',
        message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-07-23T17:44:17.902Z',
        message: { role: 'assistant', model: 'deepseek-v4-pro', usage: { input: 500, output: 30 } },
      }),
    ].join('\n') + '\n',
  );

  const entries = parseGenericUsageFile(file);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ inputTokens: 500, outputTokens: 30, model: 'deepseek-v4-pro' });
});
