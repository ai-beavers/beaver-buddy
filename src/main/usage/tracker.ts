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
// Claude Code / Codex logs are discovered (directory listing only) before
// opt-in so Connect UI can show "logs found". File contents are parsed only
// after setEnabledSources enables that source — never before.

import fs from 'node:fs';
import os from 'node:os';
import { discoverPaths, type PathEnv } from './paths';
import { parseClaudeFile } from './claude-parser';
import { dedupeCodexEntries, parseCodexFile } from './codex-parser';
import { aggregate, todayTotalTokens, type UsageEntry, type UsageTotals } from './totals';
import { USAGE_REFRESH_MS } from './config';

interface FileCacheEntry {
  readonly mtimeMs: number;
  readonly entries: readonly UsageEntry[];
}

export interface EnabledSources {
  readonly claude: boolean;
  readonly codex: boolean;
}

export interface SourceUsageSnapshot {
  readonly enabled: boolean;
  readonly logsFound: boolean;
  // True only when the user opted in AND logs were found — never auto.
  readonly connected: boolean;
  readonly lifetimeTokens: number;
  readonly todayTokens: number;
}

export interface UsageSourcesSnapshot {
  readonly claude: SourceUsageSnapshot;
  readonly codex: SourceUsageSnapshot;
}

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
  private claudeTotals: UsageTotals = emptyUsageTotals();
  private codexTotals: UsageTotals = emptyUsageTotals();
  private claudeLogsFound = false;
  private codexLogsFound = false;
  private enabled: EnabledSources = { claude: false, codex: false };
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(env: PathEnv = process.env, home: string = os.homedir()) {
    this.env = env;
    this.home = home;
  }

  getTotals(): UsageTotals {
    return this.totals;
  }

  getSourcesSnapshot(nowMs: number = Date.now()): UsageSourcesSnapshot {
    return {
      claude: {
        enabled: this.enabled.claude,
        logsFound: this.claudeLogsFound,
        connected: this.enabled.claude && this.claudeLogsFound,
        lifetimeTokens: this.enabled.claude ? this.claudeTotals.lifetime.totalTokens : 0,
        todayTokens: this.enabled.claude ? todayTotalTokens(this.claudeTotals, nowMs) : 0,
      },
      codex: {
        enabled: this.enabled.codex,
        logsFound: this.codexLogsFound,
        connected: this.enabled.codex && this.codexLogsFound,
        lifetimeTokens: this.enabled.codex ? this.codexTotals.lifetime.totalTokens : 0,
        todayTokens: this.enabled.codex ? todayTotalTokens(this.codexTotals, nowMs) : 0,
      },
    };
  }

  setEnabledSources(enabled: EnabledSources): void {
    if (this.enabled.claude === enabled.claude && this.enabled.codex === enabled.codex) return;
    this.enabled = enabled;
    this.refresh();
  }

  // Returns an unsubscribe function.
  onChange(callback: (totals: UsageTotals) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Fires on every refresh tick, whether totals changed or not. Returns an
  // unsubscribe function.
  onTick(callback: (totals: UsageTotals) => void): () => void {
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
    const { claudeFiles, codexFiles } = discoverPaths(this.env, this.home);
    const liveFiles = new Set<string>();
    const claudeEntries: UsageEntry[] = [];
    const codexEntries: UsageEntry[] = [];
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

    // Parse only opted-in sources. Disabled sources contribute logsFound via
    // discovery alone; their cache entries fall out of liveFiles and evict.
    if (this.enabled.claude) {
      for (const filePath of claudeFiles) processFile(filePath, parseClaudeFile, claudeEntries);
    }
    if (this.enabled.codex) {
      for (const filePath of codexFiles) processFile(filePath, parseCodexFile, codexEntries);
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

    const nextClaudeLogs = claudeFiles.length > 0;
    const nextCodexLogs = codexFiles.length > 0;
    if (nextClaudeLogs !== this.claudeLogsFound || nextCodexLogs !== this.codexLogsFound) {
      this.claudeLogsFound = nextClaudeLogs;
      this.codexLogsFound = nextCodexLogs;
      changed = true;
    }

    const nextClaudeTotals = aggregate(claudeEntries);
    const nextCodexTotals = aggregate(dedupeCodexEntries(codexEntries));
    const combined: UsageEntry[] = [];
    if (this.enabled.claude) combined.push(...claudeEntries);
    if (this.enabled.codex) combined.push(...dedupeCodexEntries(codexEntries));
    const nextTotals = aggregate(combined);

    const totalsChanged =
      changed ||
      nextTotals.lifetime.totalTokens !== this.totals.lifetime.totalTokens ||
      nextClaudeTotals.lifetime.totalTokens !== this.claudeTotals.lifetime.totalTokens ||
      nextCodexTotals.lifetime.totalTokens !== this.codexTotals.lifetime.totalTokens;

    this.claudeTotals = nextClaudeTotals;
    this.codexTotals = nextCodexTotals;

    if (totalsChanged) {
      this.totals = nextTotals;
      for (const listener of this.listeners) listener(this.totals);
    }

    for (const listener of this.tickListeners) listener(this.totals);
  }
}
