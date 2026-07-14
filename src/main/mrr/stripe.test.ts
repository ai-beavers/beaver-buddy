import { describe, expect, it, vi } from 'vitest';
import { getStripeMrr } from './stripe';
import type { FetchResponseLike } from './https-allowlist';

function jsonResponse(body: unknown, status = 200): FetchResponseLike {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function subscription(id: string, items: Array<Record<string, unknown>>): Record<string, unknown> {
  return { id, items: { data: items } };
}

function item(amount: number, interval: string, quantity = 1, intervalCount = 1): Record<string, unknown> {
  return { plan: { amount, currency: 'usd', interval, interval_count: intervalCount }, quantity };
}

describe('getStripeMrr', () => {
  it('sums a monthly plan as-is, in dollars', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(2000, 'month')])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(20);
  });

  it('normalizes a yearly plan to monthly (amount / 12)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(120000, 'year')])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(100);
  });

  it('normalizes a weekly plan to monthly (amount * 4.33)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(1000, 'week')])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(43.3);
  });

  it('normalizes a daily plan to monthly (amount * 30)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(100, 'day')])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(30);
  });

  it('respects quantity', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(1000, 'month', 3)])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(30);
  });

  it('divides by interval_count for a quarterly plan', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: [subscription('sub_1', [item(3000, 'month', 1, 3)])], has_more: false }),
    );
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeCloseTo(10);
  });

  it('auto-paginates via starting_after until has_more is false', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [subscription('sub_1', [item(1000, 'month')])], has_more: true }))
      .mockResolvedValueOnce(jsonResponse({ data: [subscription('sub_2', [item(2000, 'month')])], has_more: false }));

    const result = await getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl });
    expect(result).toBeCloseTo(30);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const secondUrl = fetchImpl.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain('starting_after=sub_1');
  });

  it('sends the key only as a Bearer header, never in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [], has_more: false }));
    await getStripeMrr({ apiKey: 'sk_test_fake_DO_NOT_USE', fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).not.toContain('sk_test_fake_DO_NOT_USE');
    expect(init.headers.Authorization).toBe('Bearer sk_test_fake_DO_NOT_USE');
  });

  it('returns null on a non-2xx response and never leaks the key in logs', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getStripeMrr({ apiKey: 'sk_test_fake_DO_NOT_USE', fetchImpl })).resolves.toBeNull();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('sk_test_fake_DO_NOT_USE');
    spy.mockRestore();
  });

  it('returns null on a network error, redacted', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down: key was sk_test_fake_DO_NOT_USE'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getStripeMrr({ apiKey: 'sk_test_fake_DO_NOT_USE', fetchImpl })).resolves.toBeNull();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('sk_test_fake_DO_NOT_USE');
    spy.mockRestore();
  });

  it('returns null on an unexpected response schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ oops: true }));
    await expect(getStripeMrr({ apiKey: 'sk_test_fake', fetchImpl })).resolves.toBeNull();
  });
});
