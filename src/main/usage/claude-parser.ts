// Defensive per-line JSONL parse of a single Claude Code transcript file.
// Log content is treated as sensitive AND malformed-by-default (CLAUDE.md):
// bounded per-line reads, try/catch per line, missing fields default to
// zero rather than throwing. Only derived token counts leave this module —
// never raw line content.

import { readBoundedLines } from './read-lines';
import type { UsageEntry } from './totals';

interface RawClaudeLine {
  readonly timestamp?: string;
  readonly requestId?: string;
  readonly message?: {
    readonly id?: string;
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly cache_creation_input_tokens?: number;
      readonly cache_read_input_tokens?: number;
    };
  };
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// Reads and parses a single Claude Code JSONL file (a top-level session log
// or a `{session}/subagents/{subagent}.jsonl` file — both share this line
// format, so a subagent file is parsed the same way and its usage counted
// exactly once).
export function parseClaudeFile(filePath: string): UsageEntry[] {
  // keep-LAST dedup on (message.id, requestId): Claude Code sometimes logs
  // an intermediate usage snapshot before the final one under the same key
  // (ccusage #888) — keep-first would undercount output tokens, so later
  // lines in file order win.
  const byKey = new Map<string, UsageEntry>();

  // readBoundedLines enforces the MAX_LINE_BYTES bound — oversized lines
  // never reach this loop.
  for (const line of readBoundedLines(filePath)) {
    let parsed: RawClaudeLine;
    try {
      parsed = JSON.parse(line) as RawClaudeLine;
    } catch {
      continue;
    }

    const id = parsed.message?.id;
    const requestId = parsed.requestId;
    const usage = parsed.message?.usage;
    if (!id || !requestId || !usage || typeof usage !== 'object') continue;

    const timestampMs = parsed.timestamp ? Date.parse(parsed.timestamp) : NaN;
    if (!Number.isFinite(timestampMs)) continue;

    byKey.set(`${id}:${requestId}`, {
      timestampMs,
      inputTokens: toNumber(usage.input_tokens),
      outputTokens: toNumber(usage.output_tokens),
      cacheCreationTokens: toNumber(usage.cache_creation_input_tokens),
      cacheReadTokens: toNumber(usage.cache_read_input_tokens),
    });
  }

  return [...byKey.values()];
}
