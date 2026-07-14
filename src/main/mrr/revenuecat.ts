// MRR from RevenueCat: GET /v2/projects/{project_id}/metrics/overview,
// picking the "mrr" entry out of the `metrics` array (already in dollars —
// RevenueCat's overview metrics report a `"unit": "$"` value, unlike
// Stripe's minor-units amounts). Same null-on-any-failure contract as
// stripe.ts.

import { allowlistedFetch, type FetchLike } from './https-allowlist';
import { logRedacted } from './redact';

export interface RevenueCatMrrOptions {
  readonly apiKey: string;
  readonly projectId: string;
  readonly fetchImpl?: FetchLike;
  readonly baseUrl?: string;
}

function extractMrrMetric(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const metrics = (body as Record<string, unknown>).metrics;
  if (!Array.isArray(metrics)) return null;
  const entry = metrics.find(
    (m): m is Record<string, unknown> => typeof m === 'object' && m !== null && (m as Record<string, unknown>).id === 'mrr',
  );
  const value = entry?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function getRevenueCatMrr(options: RevenueCatMrrOptions): Promise<number | null> {
  const { apiKey, projectId, fetchImpl = fetch as unknown as FetchLike, baseUrl = 'https://api.revenuecat.com' } = options;
  const url = `${baseUrl}/v2/projects/${encodeURIComponent(projectId)}/metrics/overview`;

  try {
    const res = await allowlistedFetch(url, { headers: { Authorization: `Bearer ${apiKey}` } }, fetchImpl);
    if (!res.ok) {
      logRedacted('revenuecat mrr poll failed', new Error(`HTTP ${res.status}`), apiKey);
      return null;
    }

    const body: unknown = await res.json();
    const mrr = extractMrrMetric(body);
    if (mrr === null) {
      logRedacted('revenuecat mrr poll failed', new Error('unexpected response schema'), apiKey);
    }
    return mrr;
  } catch (error) {
    logRedacted('revenuecat mrr poll failed', error, apiKey);
    return null;
  }
}
