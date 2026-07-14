import { describe, expect, it, vi } from 'vitest';
import { allowlistedFetch, type FetchResponseLike } from './https-allowlist';

function fakeResponse(): FetchResponseLike {
  return { ok: true, status: 200, json: async () => ({}) };
}

describe('allowlistedFetch', () => {
  it('calls the injected fetch for the exact allowed Stripe host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await allowlistedFetch('https://api.stripe.com/v1/subscriptions', undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.stripe.com/v1/subscriptions', { redirect: 'error' });
  });

  it('always forces redirect: "error" into the init, preserving caller headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await allowlistedFetch('https://api.stripe.com/v1/subscriptions', { headers: { Authorization: 'Bearer x' } }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.stripe.com/v1/subscriptions', {
      headers: { Authorization: 'Bearer x' },
      redirect: 'error',
    });
  });

  it('a 3xx (which fetch rejects under redirect: "error") propagates as a rejection', async () => {
    // With redirect:'error', a real fetch never returns a 3xx Response — it
    // rejects. Simulate exactly that and confirm the wrapper propagates it.
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed: unexpected redirect'));
    await expect(
      allowlistedFetch('https://api.stripe.com/v1/subscriptions', undefined, fetchImpl),
    ).rejects.toThrow(/redirect/);
  });

  it('calls the injected fetch for the exact allowed RevenueCat host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await allowlistedFetch('https://api.revenuecat.com/v2/projects/p1/metrics/overview', undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-allowlisted host without ever calling fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await expect(allowlistedFetch('https://evil.com/steal', undefined, fetchImpl)).rejects.toThrow(/refused/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a lookalike host (suffix trick) without ever calling fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await expect(
      allowlistedFetch('https://evil-api.stripe.com.evil.com/v1/subscriptions', undefined, fetchImpl),
    ).rejects.toThrow(/refused/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a lookalike host (prefix trick) without ever calling fetch', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await expect(allowlistedFetch('https://api.stripe.com.evil.com/', undefined, fetchImpl)).rejects.toThrow(/refused/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects http (non-https) even to an allowed hostname', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    await expect(allowlistedFetch('http://api.stripe.com/v1/subscriptions', undefined, fetchImpl)).rejects.toThrow(
      /refused/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
