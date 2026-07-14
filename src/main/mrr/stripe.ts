// MRR from Stripe: GET /v1/subscriptions (status=active, auto-paginated),
// summing each item's plan amount normalized to monthly. Any failure
// (network, non-2xx, unexpected schema) returns null — never throws, never
// retries hot (the daily poll tries again tomorrow). The API key is only
// ever passed to the Authorization header and to redaction on the error
// path; it is never interpolated into a log message.

import { allowlistedFetch, type FetchLike } from './https-allowlist';
import { logRedacted } from './redact';

export interface StripeMrrOptions {
  readonly apiKey: string;
  readonly fetchImpl?: FetchLike;
  readonly baseUrl?: string;
}

interface StripePlan {
  readonly amount?: unknown;
  readonly currency?: unknown;
  readonly interval?: unknown;
  readonly interval_count?: unknown;
}

interface StripeItem {
  readonly plan?: StripePlan;
  readonly quantity?: unknown;
}

interface StripeSubscription {
  readonly id?: unknown;
  readonly items?: { readonly data?: readonly StripeItem[] };
}

interface StripeSubscriptionList {
  readonly data: readonly StripeSubscription[];
  readonly has_more: boolean;
}

function isSubscriptionList(value: unknown): value is StripeSubscriptionList {
  if (typeof value !== 'object' || value === null) return false;
  const { data, has_more: hasMore } = value as Record<string, unknown>;
  return Array.isArray(data) && typeof hasMore === 'boolean';
}

// year/12, week*4.33, day*30, month as-is — divided by interval_count so a
// quarterly (month, interval_count=3) or biennial (year, interval_count=2)
// plan normalizes correctly. Unknown intervals contribute 0 rather than a
// guessed conversion.
function normalizeToMonthly(amountMinorUnits: number, interval: unknown, intervalCount: unknown): number {
  const count = typeof intervalCount === 'number' && intervalCount > 0 ? intervalCount : 1;
  switch (interval) {
    case 'year':
      return amountMinorUnits / (12 * count);
    case 'month':
      return amountMinorUnits / count;
    case 'week':
      return (amountMinorUnits * 4.33) / count;
    case 'day':
      return (amountMinorUnits * 30) / count;
    default:
      return 0;
  }
}

function monthlyMinorUnitsForItem(item: StripeItem): number {
  const plan = item.plan;
  const amount = plan?.amount;
  const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 0;
  return normalizeToMonthly(amount, plan?.interval, plan?.interval_count) * quantity;
}

const MAX_PAGES = 50; // defensive cap against a malformed/looping paginated response

export async function getStripeMrr(options: StripeMrrOptions): Promise<number | null> {
  const { apiKey, fetchImpl = fetch as unknown as FetchLike, baseUrl = 'https://api.stripe.com' } = options;
  let startingAfter: string | undefined;
  let totalMonthlyMinorUnits = 0;

  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const url = new URL(`${baseUrl}/v1/subscriptions`);
      url.searchParams.set('status', 'active');
      url.searchParams.set('limit', '100');
      if (startingAfter) url.searchParams.set('starting_after', startingAfter);

      const res = await allowlistedFetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } }, fetchImpl);
      if (!res.ok) {
        logRedacted('stripe mrr poll failed', new Error(`HTTP ${res.status}`), apiKey);
        return null;
      }

      const body: unknown = await res.json();
      if (!isSubscriptionList(body)) {
        logRedacted('stripe mrr poll failed', new Error('unexpected response schema'), apiKey);
        return null;
      }

      for (const sub of body.data) {
        for (const item of sub.items?.data ?? []) {
          totalMonthlyMinorUnits += monthlyMinorUnitsForItem(item);
        }
      }

      const lastId = body.data[body.data.length - 1]?.id;
      if (!body.has_more || typeof lastId !== 'string') break;
      startingAfter = lastId;
    }
    return totalMonthlyMinorUnits / 100;
  } catch (error) {
    logRedacted('stripe mrr poll failed', error, apiKey);
    return null;
  }
}
