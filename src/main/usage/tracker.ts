// Main-process-only tracker: refreshes on a coalesced timer, re-parses only
// files whose mtime changed since the last scan, and exposes a plain
// getTotals()/onChange() API for later items (BL-6/BL-8) to consume — no
// IPC/renderer wiring here (renderer never sees paths or log content).
//
// onChange fires only when a file actually changed; onTick fires on every
// refresh regardless. The quip idle detector needs a snapshot even when
// nothing changed (that's the definition of idle), so it rides onTick
// instead of a second polling loop.
//
// Coding-agent logs are discovered (directory listing only) before opt-in so
// Connect UI can show "logs found". File contents are parsed only after
// setEnabledSources enables that source — never before.

import fs from 'node:fs';
import os from 'node:os';
import { discoverPaths, type DiscoveredPaths, type PathEnv } from './paths';
import { parseClaudeFile } from './claude-parser';
import { dedupeCodexEntries, parseCodexFile } from './codex-parser';
import { parseGenericUsageFile } from './generic-parser';
import { emptyEnabledSources, USAGE_SOURCE_IDS, type UsageSourceId } from './sources';
import { aggregate, todayTotalTokens, type UsageEntry, type UsageTotals } from './totals';
import { USAGE_REFRESH_MS } from './config';

interface FileCacheEntry {
  readonly mtimeMs: number;
  readonly entries: readonly UsageEntry[];
}

export type EnabledSources = Partial<Record<UsageSourceId, boolean>>;

export interface SourceUsageSnapshot {
  readonly enabled: boolean;
  readonly logsFound: boolean;
  // True only when the user opted in AND logs were found — never auto.
  readonly connected: boolean;
  readonly lifetimeTokens: number;
  readonly todayTokens: number;
}

export type UsageSourcesSnapshot = Record<'claude' | 'codex', SourceUsageSnapshot> & {
  readonly pi?: SourceUsageSnapshot;
  readonly kimi?: SourceUsageSnapshot;
  readonly opencode?: SourceUsageSnapshot;
};

function emptyUsageTotals(): UsageTotals {
  return aggregate([]);
}

export class UsageTracker {
  private readonly env: PathEnv;
  private readonly home: string;
  private readonly fileCache = new Map<string, FileCacheEntry>();
  private readonly listeners = new Set<(totals: UsageTotals) => void>();
  private readonly tickListeners = new Set<(totals: UsageTotals) => void>();
  private totals: UsageTotals = emptyUsageTotals();
  private sourceTotals: Record<UsageSourceId, UsageTotals> = Object.fromEntries(
    USAGE_SOURCE_IDS.map((source) => [source, emptyUsageTotals()]),
  ) as Record<UsageSourceId, UsageTotals>;
  private logsFound: Record<UsageSourceId, boolean> = emptyEnabledSources();
  private enabled: Record<UsageSourceId, boolean> = emptyEnabledSources();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(env: PathEnv = process.env, home: string = os.homedir()) {
    this.env = env;
    this.home = home;
  }

  getTotals(): UsageTotals {
    return this.totals;
  }

  getSourcesSnapshot(nowMs: number = Date.now()): UsageSourcesSnapshot {
    return Object.fromEntries(
      USAGE_SOURCE_IDS.map((source) => {
        const totals = this.sourceTotals[source];
        return [
          source,
          {
            enabled: this.enabled[source],
            logsFound: this.logsFound[source],
            connected: this.enabled[source] && this.logsFound[source],
            lifetimeTokens: this.enabled[source] ? totals.lifetime.totalTokens : 0,
            todayTokens: this.enabled[source] ? todayTotalTokens(totals, nowMs) : 0,
          },
        ];
      }),
    ) as unknown as UsageSourcesSnapshot;
  }

  setEnabledSources(enabled: EnabledSources): void {
    const next = { ...this.enabled };
    for (const source of USAGE_SOURCE_IDS) {
      if (Object.prototype.hasOwnProperty.call(enabled, source)) next[source] = Boolean(enabled[source]);
    }
    if (USAGE_SOURCE_IDS.every((source) => this.enabled[source] === next[source])) return;
    this.enabled = next;
    this.refresh();
  }

  // Returns an unsubscribe function.
  onChange(callback: (totals: UsageTotals) => void | Promise<void>): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Fires on every refresh tick, whether totals changed or not. Returns an
  // unsubscribe function.
  onTick(callback: (totals: UsageTotals) => void | Promise<void>): () => void {
    this.tickListeners.add(callback);
    return () => {
      this.tickListeners.delete(callback);
    };
  }

  start(): void {
    this.refresh();
    if (this.timer) return;
    this.timer = setInterval(() => this.refresh(), USAGE_REFRESH_MS);
    // Never keep the process alive just to poll usage logs.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // Missing dirs/files produce empty discovery results, not errors, so this
  // never throws and never retries — a single scan per call is enough.
  refresh(): void {
    const discovered = discoverPaths(this.env, this.home);
    const liveFiles = new Set<string>();
    const sourceEntries = Object.fromEntries(USAGE_SOURCE_IDS.map((source) => [source, []])) as unknown as Record<UsageSourceId, UsageEntry[]>;
    let changed = false;

    const processFile = (filePath: string, parse: (f: string) => UsageEntry[], sink: UsageEntry[]): void => {
      liveFiles.add(filePath);

      let mtimeMs: number;
      try {
        mtimeMs = fs.statSync(filePath).mtimeMs;
      } catch {
        return; // vanished between discovery and stat; treat as absent this pass
      }

      const cached = this.fileCache.get(filePath);
      if (!cached || cached.mtimeMs !== mtimeMs) {
        const entries = parse(filePath);
        this.fileCache.set(filePath, { mtimeMs, entries });
        changed = true;
      }

      sink.push(...(this.fileCache.get(filePath)?.entries ?? []));
    };

    const filesFor = (paths: DiscoveredPaths, source: UsageSourceId): readonly string[] => paths[`${source}Files` as keyof DiscoveredPaths];

    for (const source of USAGE_SOURCE_IDS) {
      if (!this.enabled[source]) continue;
      const parse = source === 'claude' ? parseClaudeFile : source === 'codex' ? parseCodexFile : parseGenericUsageFile;
      for (const filePath of filesFor(discovered, source)) processFile(filePath, parse, sourceEntries[source]);
    }

    // Drop cache entries for files that no longer show up among enabled
    // sources (rotated/deleted logs, or user disconnected) so they stop
    // contributing to totals and are not re-read while disabled.
    for (const cachedPath of this.fileCache.keys()) {
      if (!liveFiles.has(cachedPath)) {
        this.fileCache.delete(cachedPath);
        changed = true;
      }
    }

    for (const source of USAGE_SOURCE_IDS) {
      const nextLogsFound = filesFor(discovered, source).length > 0;
      if (nextLogsFound !== this.logsFound[source]) {
        this.logsFound[source] = nextLogsFound;
        changed = true;
      }
    }

    const nextSourceTotals = Object.fromEntries(
      USAGE_SOURCE_IDS.map((source) => {
        const entries = source === 'codex' ? dedupeCodexEntries(sourceEntries.codex) : sourceEntries[source];
        return [source, aggregate(entries)];
      }),
    ) as Record<UsageSourceId, UsageTotals>;

    const combined = USAGE_SOURCE_IDS.flatMap((source) => {
      if (!this.enabled[source]) return [];
      return source === 'codex' ? dedupeCodexEntries(sourceEntries.codex) : sourceEntries[source];
    });
    const nextTotals = aggregate(combined);

    const totalsChanged =
      changed ||
      nextTotals.lifetime.totalTokens !== this.totals.lifetime.totalTokens ||
      USAGE_SOURCE_IDS.some(
        (source) => nextSourceTotals[source].lifetime.totalTokens !== this.sourceTotals[source].lifetime.totalTokens,
      );

    this.sourceTotals = nextSourceTotals;

    if (totalsChanged) {
      this.totals = nextTotals;
      for (const listener of this.listeners) {
        Promise.resolve(listener(this.totals)).catch((error: unknown) => {
          console.error('UsageTracker onChange callback failed:', error);
        });
      }
    }

    for (const listener of this.tickListeners) {
      Promise.resolve(listener(this.totals)).catch((error: unknown) => {
        console.error('UsageTracker onTick callback failed:', error);
      });
    }
  }
}
