// getSecret is mocked so this suite never touches the real secret store;
// stripe/revenuecat fetch calls go through an injected fetchImpl so it never
// touches the real network either.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MrrEngine } from './mrr-engine';
import type { FetchResponseLike } from './https-allowlist';

const getSecretMock = vi.fn<(storeDir: string, service: string, account: string) => Promise<string | null>>();
vi.mock('./secrets', () => ({ getSecret: (...args: [string, string, string]) => getSecretMock(...args) }));

function jsonResponse(body: unknown, status = 200): FetchResponseLike {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stripeSubscriptionsResponse(monthlyDollars: number): FetchResponseLike {
  return jsonResponse({
    data: [{ id: 'sub_1', items: { data: [{ plan: { amount: monthlyDollars * 100, currency: 'usd', interval: 'month' }, quantity: 1 }] } }],
    has_more: false,
  });
}

// Minimal fake standing in for XpEngine's award surface — MrrEngineDeps only
// needs getLastMrrAwardDate/awardMrr (Pick<XpEngine, ...>), so no real
// XpEngine/state-dir/Electron needed here.
class FakeXp {
  lastMrrAwardDate: string | null = null;
  awarded: Array<{ xp: number; date: string }> = [];
  getLastMrrAwardDate(): string | null {
    return this.lastMrrAwardDate;
  }
  async awardMrr(xp: number, date: string): Promise<void> {
    this.awarded.push({ xp, date });
    this.lastMrrAwardDate = date;
  }
}

beforeEach(() => {
  getSecretMock.mockReset();
});

function engineDeps(overrides: Partial<ConstructorParameters<typeof MrrEngine>[0]> = {}) {
  return {
    xpEngine: new FakeXp(),
    getMode: () => 'mrr' as const,
    getSecretStoreDir: () => '/state',
    getKeychainService: () => 'svc',
    getConnected: () => ({ stripe: true, revenuecat: false }),
    ...overrides,
  };
}

describe('MrrEngine.pollNow', () => {
  it('does nothing when mode is tokens', async () => {
    const xp = new FakeXp();
    const fetchImpl = vi.fn();
    const engine = new MrrEngine(engineDeps({ xpEngine: xp, getMode: () => 'tokens', fetchImpl }));
    await engine.pollNow();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(xp.awarded).toHaveLength(0);
  });

  it('does nothing when mrr mode but nothing connected', async () => {
    const xp = new FakeXp();
    const engine = new MrrEngine(engineDeps({ xpEngine: xp, getConnected: () => ({ stripe: false, revenuecat: false }) }));
    await engine.pollNow();
    expect(xp.awarded).toHaveLength(0);
  });

  it('awards floor(mrr * rate) once, through xpEngine.awardMrr, on a successful poll', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake');
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(50)); // $50/mo -> 500 XP at rate 10
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => new Date('2026-07-13T10:00:00'),
    });
    await engine.pollNow();
    expect(xp.awarded).toEqual([{ xp: 500, date: '2026-07-13' }]);
  });

  it('once-per-local-date: a second poll the same day awards nothing more', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake');
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(50));
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => new Date('2026-07-13T10:00:00'),
    });
    await engine.pollNow();
    await engine.pollNow();
    expect(xp.awarded).toHaveLength(1);
  });

  it('awards again after local-date midnight rollover', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake');
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(10));
    const xp = new FakeXp();
    let now = new Date('2026-07-13T23:59:00');
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => now,
    });
    await engine.pollNow();
    now = new Date('2026-07-14T00:01:00');
    await engine.pollNow();
    expect(xp.awarded.map((a) => a.date)).toEqual(['2026-07-13', '2026-07-14']);
  });

  it('a 401 from Stripe awards nothing and does not throw', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake_DO_NOT_USE');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    const xp = new FakeXp();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
    });
    await expect(engine.pollNow()).resolves.toBeUndefined();
    expect(xp.awarded).toHaveLength(0);
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('sk_test_fake_DO_NOT_USE');
    spy.mockRestore();
  });

  it('connected flag true but secret store has no key -> no award, no throw', async () => {
    getSecretMock.mockResolvedValue(null);
    const fetchImpl = vi.fn();
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
    });
    await engine.pollNow();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(xp.awarded).toHaveLength(0);
  });

  it('mode-switch no-double-count: mrr award today, then switch to tokens and back to mrr same day awards nothing more', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake');
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(50));
    const xp = new FakeXp();
    let mode: 'tokens' | 'mrr' = 'mrr';
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => mode,
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => new Date('2026-07-13T10:00:00'),
    });
    await engine.pollNow();
    mode = 'tokens';
    await engine.pollNow(); // no-op, mode is tokens
    mode = 'mrr';
    await engine.pollNow(); // same local date already awarded -> no-op
    expect(xp.awarded).toHaveLength(1);
  });

  it('clock rolled backwards past the last award date awards nothing (no re-award)', async () => {
    getSecretMock.mockResolvedValue('sk_test_fake');
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(10));
    const xp = new FakeXp();
    let now = new Date('2026-07-14T10:00:00');
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => now,
    });
    await engine.pollNow(); // awards for 2026-07-14
    now = new Date('2026-07-13T10:00:00'); // clock rollback
    await engine.pollNow();
    expect(xp.awarded).toEqual([{ xp: 100, date: '2026-07-14' }]);
  });

  it('negative MRR clamps to a 0-XP award (date still recorded, no same-day retry)', async () => {
    getSecretMock.mockResolvedValue('rc_fake');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ metrics: [{ id: 'mrr', value: -50 }] }));
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: false, revenuecat: true }),
      fetchImpl,
      now: () => new Date('2026-07-14T10:00:00'),
    });
    await engine.pollNow();
    expect(xp.awarded).toEqual([{ xp: 0, date: '2026-07-14' }]);
  });

  it('NaN MRR is rejected by the client schema check -> no award at all', async () => {
    getSecretMock.mockResolvedValue('rc_fake');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ metrics: [{ id: 'mrr', value: NaN }] }));
    const xp = new FakeXp();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: false, revenuecat: true }),
      fetchImpl,
    });
    await engine.pollNow();
    expect(xp.awarded).toHaveLength(0);
    spy.mockRestore();
  });

  it('absurd MRR (1e15) is capped at MRR_MAX_DOLLARS before the award', async () => {
    getSecretMock.mockResolvedValue('rc_fake');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ metrics: [{ id: 'mrr', value: 1e15 }] }));
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: false, revenuecat: true }),
      fetchImpl,
      now: () => new Date('2026-07-14T10:00:00'),
    });
    await engine.pollNow();
    expect(xp.awarded).toEqual([{ xp: 1_000_000 * 10, date: '2026-07-14' }]);
  });

  it('sums stripe and revenuecat when both are connected', async () => {
    getSecretMock.mockImplementation(async (_storeDir, _service, account) => {
      if (account === 'stripe-key') return 'sk_test_fake';
      if (account === 'revenuecat-key') return 'rc_fake';
      if (account === 'revenuecat-project') return 'proj1';
      return null;
    });
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('stripe.com')) return stripeSubscriptionsResponse(50);
      return jsonResponse({ metrics: [{ id: 'mrr', value: 25 }] });
    });
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: true }),
      fetchImpl,
      now: () => new Date('2026-07-13T10:00:00'),
    });
    await engine.pollNow();
    expect(xp.awarded).toEqual([{ xp: 750, date: '2026-07-13' }]); // (50 + 25) * 10
  });

  it('prevents concurrent polls from awarding twice', async () => {
    let resolveSecret: ((value: string) => void) | undefined;
    getSecretMock.mockImplementation(() => new Promise<string>((resolve) => {
      resolveSecret = resolve;
    }));
    const fetchImpl = vi.fn().mockResolvedValue(stripeSubscriptionsResponse(50));
    const xp = new FakeXp();
    const engine = new MrrEngine({
      xpEngine: xp,
      getMode: () => 'mrr',
      getSecretStoreDir: () => '/state',
      getKeychainService: () => 'svc',
      getConnected: () => ({ stripe: true, revenuecat: false }),
      fetchImpl,
      now: () => new Date('2026-07-13T10:00:00'),
    });

    const first = engine.pollNow();
    const second = engine.pollNow(); // should return immediately while first is in flight

    expect(xp.awarded).toHaveLength(0);
    resolveSecret!('sk_test_fake');
    await first;
    await second;

    expect(xp.awarded).toHaveLength(1);
    expect(xp.awarded).toEqual([{ xp: 500, date: '2026-07-13' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
