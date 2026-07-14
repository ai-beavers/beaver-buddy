import { describe, expect, it, vi } from 'vitest';
import { getRevenueCatMrr } from './revenuecat';
import type { FetchResponseLike } from './https-allowlist';

function jsonResponse(body: unknown, status = 200): FetchResponseLike {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const OVERVIEW_BODY = {
  object: 'overview_metrics',
  metrics: [
    { object: 'overview_metric', id: 'active_trials', name: 'Active Trials', unit: '#', value: 12 },
    { object: 'overview_metric', id: 'mrr', name: 'MRR', unit: '$', value: 456.78 },
  ],
  currency: 'USD',
};

describe('getRevenueCatMrr', () => {
  it('extracts the mrr metric value (already dollars)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OVERVIEW_BODY));
    await expect(getRevenueCatMrr({ apiKey: 'rc_fake', projectId: 'proj1', fetchImpl })).resolves.toBeCloseTo(456.78);
  });

  it('requests the correct project-scoped path', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OVERVIEW_BODY));
    await getRevenueCatMrr({ apiKey: 'rc_fake', projectId: 'proj with space', fetchImpl });
    const url = fetchImpl.mock.calls[0]?.[0] as string;
    expect(url).toBe('https://api.revenuecat.com/v2/projects/proj%20with%20space/metrics/overview');
  });

  it('sends the key only as a Bearer header, never in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OVERVIEW_BODY));
    await getRevenueCatMrr({ apiKey: 'rc_fake_DO_NOT_USE', projectId: 'proj1', fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).not.toContain('rc_fake_DO_NOT_USE');
    expect(init.headers.Authorization).toBe('Bearer rc_fake_DO_NOT_USE');
  });

  it('returns null when the metrics array has no mrr entry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ metrics: [{ id: 'active_trials', value: 1 }] }));
    await expect(getRevenueCatMrr({ apiKey: 'rc_fake', projectId: 'proj1', fetchImpl })).resolves.toBeNull();
  });

  it('returns null on an unexpected schema (no metrics array)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ oops: true }));
    await expect(getRevenueCatMrr({ apiKey: 'rc_fake', projectId: 'proj1', fetchImpl })).resolves.toBeNull();
  });

  it('returns null on a non-2xx response and never leaks the key in logs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getRevenueCatMrr({ apiKey: 'rc_fake_DO_NOT_USE', projectId: 'proj1', fetchImpl })).resolves.toBeNull();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('rc_fake_DO_NOT_USE');
    spy.mockRestore();
  });

  it('returns null on a network error, redacted', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom rc_fake_DO_NOT_USE'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getRevenueCatMrr({ apiKey: 'rc_fake_DO_NOT_USE', projectId: 'proj1', fetchImpl })).resolves.toBeNull();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('rc_fake_DO_NOT_USE');
    spy.mockRestore();
  });
});
