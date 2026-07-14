// Defensive per-line JSONL parse of a single Codex rollout file. Codex logs
// cumulative `total_token_usage` per `token_count` event, so per-turn usage
// comes from `last_token_usage` when present (it IS the per-turn delta) or
// from saturating subtraction against the previous cumulative reading.
// Same defensive-by-default rules as the Claude parser: bounded reads,
// try/catch per line, missing fields -> 0.
//
// `input_tokens` is the FULL input for a snapshot and `cached_input_tokens`
// is a subset of it (cache-served, not additional) — fresh input and
// cache-read are split so `inputTokens + cacheReadTokens` reconstructs the
// raw total without double-counting the cached portion.

import { CODEX_REPLAY_SNIFF_BYTES } from './config';
import { readBoundedLines, readPrefix } from './read-lines';
import type { UsageEntry } from './totals';

interface RawCodexLine {
  readonly timestamp?: string;
  readonly type?: string;
  readonly payload?: {
    readonly type?: string;
    readonly info?: {
      readonly total_token_usage?: Record<string, unknown>;
      readonly last_token_usage?: Record<string, unknown>;
    };
  };
}

interface NormalizedUsage {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cached: number;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstNumber(u: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    if (key in u) return toNumber(u[key]);
  }
  return 0;
}

// Field names drift across Codex releases — accept the known aliases.
function normalizeUsage(u: unknown): NormalizedUsage | null {
  if (!u || typeof u !== 'object') return null;
  const rec = u as Record<string, unknown>;
  const input = firstNumber(rec, ['input_tokens', 'prompt_tokens', 'input']);
  const output = firstNumber(rec, ['output_tokens', 'completion_tokens', 'output']);
  const reasoning = firstNumber(rec, ['reasoning_output_tokens', 'reasoning_tokens']);
  // Cached is a SUBSET of input, never additional — clamp to input.
  const cached = Math.min(firstNumber(rec, ['cached_input_tokens', 'cache_read_input_tokens', 'cached_tokens']), input);
  return { input, output, reasoning, cached };
}

interface TokenEvent {
  readonly timestamp: string;
  readonly timestampMs: number;
  readonly total: NormalizedUsage | null;
  readonly last: NormalizedUsage | null;
}

// readBoundedLines enforces the MAX_LINE_BYTES bound — oversized lines
// never reach this loop.
function readTokenEvents(filePath: string): TokenEvent[] {
  const events: TokenEvent[] = [];
  for (const line of readBoundedLines(filePath)) {
    let parsed: RawCodexLine;
    try {
      parsed = JSON.parse(line) as RawCodexLine;
    } catch {
      continue;
    }

    if (parsed.type !== 'event_msg' || parsed.payload?.type !== 'token_count') continue;
    const info = parsed.payload.info;
    if (!info || typeof info !== 'object') continue;

    const timestamp = typeof parsed.timestamp === 'string' ? parsed.timestamp : '';
    const timestampMs = timestamp ? Date.parse(timestamp) : NaN;
    if (!Number.isFinite(timestampMs)) continue;

    const total = normalizeUsage(info.total_token_usage);
    const last = normalizeUsage(info.last_token_usage);
    if (!total && !last) continue;

    events.push({ timestamp, timestampMs, total, last });
  }
  return events;
}

// ISO timestamp truncated to whole seconds — the replay-burst grouping key.
function second(timestamp: string): string {
  return timestamp.slice(0, 19);
}

export function parseCodexFile(filePath: string): UsageEntry[] {
  const events = readTokenEvents(filePath);

  // A forked/spawned thread replays its parent's history into its own
  // rollout file: the inherited token_count events land as a burst sharing
  // one timestamp-second at the top of the file. Counting them would
  // double-count the parent's usage — so events in that leading burst are
  // elided, but their cumulative totals still seed the baseline, and the
  // first event outside the burst permanently ends the elision. A file
  // whose first two events do NOT share a second has no replay prefix.
  const sniff = readPrefix(filePath, CODEX_REPLAY_SNIFF_BYTES);
  const replayPossible = sniff.includes('thread_spawn') || sniff.includes('forked_from_id');
  const replaySecond =
    replayPossible && events.length >= 2 && second(events[0].timestamp) === second(events[1].timestamp)
      ? second(events[0].timestamp)
      : null;

  const entries: UsageEntry[] = [];
  let baseline: NormalizedUsage = { input: 0, output: 0, reasoning: 0, cached: 0 };
  let skipping = replaySecond !== null;

  for (const event of events) {
    if (skipping) {
      if (second(event.timestamp) === replaySecond) {
        if (event.total) baseline = event.total;
        continue;
      }
      skipping = false;
    }

    let input: number;
    let output: number;
    let reasoning: number;
    let cached: number;
    if (event.last) {
      ({ input, output, reasoning, cached } = event.last);
    } else if (event.total) {
      // Saturating subtraction: a field that went down clamps to 0 (no
      // other reset detection); the lower cumulative still becomes the new
      // baseline below.
      input = Math.max(0, event.total.input - baseline.input);
      output = Math.max(0, event.total.output - baseline.output);
      reasoning = Math.max(0, event.total.reasoning - baseline.reasoning);
      cached = Math.max(0, event.total.cached - baseline.cached);
    } else {
      continue;
    }

    if (event.total) baseline = event.total;

    if (input === 0 && output === 0 && reasoning === 0 && cached === 0) continue;

    cached = Math.min(cached, input);
    entries.push({
      timestampMs: event.timestampMs,
      inputTokens: input - cached,
      outputTokens: output,
      cacheCreationTokens: 0,
      cacheReadTokens: cached,
    });
  }

  return entries;
}

// Forked threads can also duplicate individual events verbatim across
// files — drop exact copies by (timestamp, input, cached, output), keeping
// the first. Run over the combined entries of ALL Codex files.
export function dedupeCodexEntries(entries: readonly UsageEntry[]): UsageEntry[] {
  const seen = new Set<string>();
  const out: UsageEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.timestampMs}:${entry.inputTokens}:${entry.cacheReadTokens}:${entry.outputTokens}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
