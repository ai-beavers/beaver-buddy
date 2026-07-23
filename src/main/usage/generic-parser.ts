// Defensive parser for coding-agent JSON/JSONL logs that already store
// finalized token usage in common `usage` / `token_usage` objects. This is a
// narrow fallback for sources with ccusage-observed local token metadata
// (Kimi, Pi, OpenCode) until each source gets a bespoke parser.

import fs from 'node:fs';
import { MAX_LINE_BYTES } from './config';
import { readBoundedLines } from './read-lines';
import type { UsageEntry } from './totals';

interface NormalizedUsage {
  readonly input: number;
  readonly inputAlreadyFresh: boolean;
  readonly output: number;
  readonly cacheCreation: number;
  readonly cacheRead: number;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstNumber(record: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    if (key in record) return toNumber(record[key]);
  }
  return 0;
}

function normalizeUsage(value: unknown): NormalizedUsage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const inputAlreadyFresh = 'input_other' in record || 'inputOther' in record;
  const input = firstNumber(record, ['input_other', 'inputOther', 'input_tokens', 'prompt_tokens', 'inputTokens', 'input']);
  const output = firstNumber(record, ['output', 'output_tokens', 'completion_tokens', 'outputTokens']);
  const cacheRead = Math.min(
    firstNumber(record, ['input_cache_read', 'inputCacheRead', 'cache_read_input_tokens', 'cacheReadTokens']),
    input,
  );
  const cacheCreation = firstNumber(record, [
    'input_cache_creation',
    'inputCacheCreation',
    'cache_creation_input_tokens',
    'cacheCreationTokens',
  ]);
  if (input === 0 && output === 0 && cacheRead === 0 && cacheCreation === 0) return null;
  return { input, inputAlreadyFresh, output, cacheCreation, cacheRead };
}

function findUsageObject(value: unknown): { readonly usage: NormalizedUsage | null; readonly model: string | undefined } {
  if (!value || typeof value !== 'object') return { usage: null, model: undefined };
  const record = value as Record<string, unknown>;
  const model = typeof record.model === 'string' ? record.model : typeof record.modelName === 'string' ? record.modelName : undefined;
  return { usage: normalizeUsage(record.usage) ?? normalizeUsage(record.token_usage) ?? normalizeUsage(record.tokenUsage), model };
}

function timestampMs(value: unknown): number {
  if (!value || typeof value !== 'object') return NaN;
  const record = value as Record<string, unknown>;
  const raw = record.timestamp ?? record.created_at ?? record.createdAt ?? record.time;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 10_000_000_000 ? raw * 1000 : raw;
  return typeof raw === 'string' ? Date.parse(raw) : NaN;
}


function parseJsonObject(value: unknown): UsageEntry[] {
  const found = findUsageObject(value);
  const ts = timestampMs(value);
  if (!found.usage || !Number.isFinite(ts)) return [];
  return [{
    timestampMs: ts,
    model: found.model,
    inputTokens: found.usage.inputAlreadyFresh ? found.usage.input : found.usage.input - found.usage.cacheRead,
    outputTokens: found.usage.output,
    cacheCreationTokens: found.usage.cacheCreation,
    cacheReadTokens: found.usage.cacheRead,
  }];
}

function parseWholeJsonFile(filePath: string): UsageEntry[] | null {
  if (!filePath.endsWith('.json')) return null;
  try {
    if (fs.statSync(filePath).size > MAX_LINE_BYTES) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (Array.isArray(parsed)) return parsed.flatMap(parseJsonObject);
    return parseJsonObject(parsed);
  } catch {
    return [];
  }
}

export function parseGenericUsageFile(filePath: string): UsageEntry[] {
  const wholeJsonEntries = parseWholeJsonFile(filePath);
  if (wholeJsonEntries) return wholeJsonEntries;

  const entries: UsageEntry[] = [];
  for (const line of readBoundedLines(filePath)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const found = findUsageObject(parsed);
    const ts = timestampMs(parsed);
    if (!found.usage || !Number.isFinite(ts)) continue;
    entries.push({
      timestampMs: ts,
      model: found.model,
      inputTokens: found.usage.inputAlreadyFresh ? found.usage.input : found.usage.input - found.usage.cacheRead,
      outputTokens: found.usage.output,
      cacheCreationTokens: found.usage.cacheCreation,
      cacheReadTokens: found.usage.cacheRead,
    });
  }
  return entries;
}
