// Tiny fetch wrapper that refuses any hostname other than the two exact
// hosts this app is allowed to talk to. Exact Set membership (no
// endsWith/includes suffix matching) so a lookalike host — e.g.
// evil-api.stripe.com.evil.com, whose hostname is that entire string, not
// api.stripe.com — is rejected by construction, not by a blocklist that
// could miss a variant. The allowed hosts are hardcoded, not configurable
// via env/config; the only injectable seam is the underlying fetch
// implementation itself, so tests can verify rejection without ever
// reaching the network.

export interface FetchResponseLike {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; redirect?: 'error' },
) => Promise<FetchResponseLike>;

const ALLOWED_HOSTS = new Set(['api.stripe.com', 'api.revenuecat.com']);

// async so a synchronous validation rejection and a fetchImpl rejection are
// both always a rejected Promise — a caller doing `await` or
// `expect(...).rejects` never has to special-case "throws vs. rejects".
export async function allowlistedFetch(
  url: string,
  init: { headers?: Record<string, string> } | undefined,
  fetchImpl: FetchLike,
): Promise<FetchResponseLike> {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:' || !ALLOWED_HOSTS.has(hostname)) {
    throw new Error(`https-allowlist: refused host "${hostname}"`);
  }
  // redirect: 'error' — the hostname check above only covers the request
  // URL; fetch's default 'follow' would silently chase a 3xx to a host that
  // was never checked. These are JSON APIs; a redirect is never expected,
  // so any 3xx is a hard failure rather than something to follow.
  return fetchImpl(url, { ...init, redirect: 'error' });
}
