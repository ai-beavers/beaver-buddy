import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageTracker } from './tracker';
import { USAGE_REFRESH_MS } from './config';

let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-tracker-'));
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  vi.useRealTimers();
});

function writeClaudeSession(homeDir: string, project: string, session: string, tokens: { input: number; output: number }): void {
  const filePath = path.join(homeDir, '.claude', 'projects', project, `${session}.jsonl`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId: `req-${session}`,
    message: { id: `msg-${session}`, usage: { input_tokens: tokens.input, output_tokens: tokens.output } },
  });
  fs.writeFileSync(filePath, `${line}\n`);
}

describe('UsageTracker', () => {
  it('reports zero totals when no log dirs exist (missing-logs graceful degradation)', () => {
    const tracker = new UsageTracker({}, home);
    tracker.refresh();
    const totals = tracker.getTotals();
    expect(totals.lifetime.totalTokens).toBe(0);
    expect(totals.daily.size).toBe(0);
  });

  it('picks up a new log file on refresh and fires onChange', () => {
    const tracker = new UsageTracker({}, home);
    tracker.setEnabledSources({ claude: true, codex: false });
    tracker.refresh();

    const changes: number[] = [];
    tracker.onChange((totals) => changes.push(totals.lifetime.totalTokens));

    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    tracker.refresh();

    expect(changes).toEqual([15]);
    expect(tracker.getTotals().lifetime.totalTokens).toBe(15);
  });

  it('does not fire onChange when nothing changed between refreshes', () => {
    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    const tracker = new UsageTracker({}, home);
    tracker.setEnabledSources({ claude: true, codex: false });
    tracker.refresh();

    const changes: unknown[] = [];
    tracker.onChange((totals) => changes.push(totals));
    tracker.refresh();

    expect(changes).toEqual([]);
  });

  it('evicts a deleted log file from the totals on the next refresh', () => {
    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    const tracker = new UsageTracker({}, home);
    tracker.setEnabledSources({ claude: true, codex: false });
    tracker.refresh();
    expect(tracker.getTotals().lifetime.totalTokens).toBe(15);

    fs.rmSync(path.join(home, '.claude', 'projects', 'project-a', 'session-1.jsonl'));
    tracker.refresh();
    expect(tracker.getTotals().lifetime.totalTokens).toBe(0);
  });

  it('fires onTick on every refresh, changed or not, unlike onChange', () => {
    const tracker = new UsageTracker({}, home);
    tracker.setEnabledSources({ claude: true, codex: false });
    tracker.refresh();

    const ticks: number[] = [];
    const changes: number[] = [];
    tracker.onTick((totals) => ticks.push(totals.lifetime.totalTokens));
    tracker.onChange((totals) => changes.push(totals.lifetime.totalTokens));

    tracker.refresh(); // nothing changed
    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    tracker.refresh(); // changed

    expect(ticks).toEqual([0, 15]);
    expect(changes).toEqual([15]);
  });

  it('ignores logs until the user opts in via setEnabledSources', () => {
    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    const tracker = new UsageTracker({}, home);
    tracker.refresh();
    expect(tracker.getTotals().lifetime.totalTokens).toBe(0);
    expect(tracker.getSourcesSnapshot().claude).toMatchObject({
      enabled: false,
      logsFound: true,
      connected: false,
      lifetimeTokens: 0,
    });

    tracker.setEnabledSources({ claude: true, codex: false });
    expect(tracker.getTotals().lifetime.totalTokens).toBe(15);
    expect(tracker.getSourcesSnapshot().claude).toMatchObject({
      enabled: true,
      connected: true,
      lifetimeTokens: 15,
    });
  });

  it('does not read log file contents until the user opts in', () => {
    writeClaudeSession(home, 'project-a', 'session-1', { input: 10, output: 5 });
    const openSpy = vi.spyOn(fs, 'openSync');
    const tracker = new UsageTracker({}, home);
    tracker.refresh();

    const jsonlOpens = () =>
      openSpy.mock.calls.filter(([p]) => String(p).includes('.jsonl'));
    expect(jsonlOpens()).toEqual([]);
    expect(tracker.getSourcesSnapshot().claude.logsFound).toBe(true);

    tracker.setEnabledSources({ claude: true, codex: false });
    expect(jsonlOpens().length).toBeGreaterThan(0);
    expect(tracker.getTotals().lifetime.totalTokens).toBe(15);
    openSpy.mockRestore();
  });

  it('coalesces refreshes onto a single timer interval (fake timers)', () => {
    vi.useFakeTimers();
    const tracker = new UsageTracker({}, home);
    const refreshSpy = vi.spyOn(tracker, 'refresh');

    tracker.start();
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(USAGE_REFRESH_MS);
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(USAGE_REFRESH_MS * 2);
    expect(refreshSpy).toHaveBeenCalledTimes(4);

    tracker.stop();
    vi.advanceTimersByTime(USAGE_REFRESH_MS * 5);
    expect(refreshSpy).toHaveBeenCalledTimes(4); // stopped — no further ticks
  });
});
