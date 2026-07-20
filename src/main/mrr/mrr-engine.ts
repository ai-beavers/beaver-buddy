// Daily MRR poll: if the current growth mode is 'mrr' and today's local
// date hasn't been awarded yet, fetches MRR from every connected source and
// awards floor(mrr_dollars * MRR_XP_PER_DOLLAR) through the existing
// XpEngine (see xp/engine.ts's awardMrr). A connected source that fails to
// read its Keychain secret or returns null MRR aborts the whole poll with
// no award — never a partial/guessed award — and the next daily tick tries
// again. Timer is coalesced and unref'd (same discipline as
// usage/tracker.ts): never keeps the process alive on its own.

import type { XpEngine } from '../xp/engine';
import { getSecret } from './secrets';
import { getStripeMrr } from './stripe';
import { getRevenueCatMrr } from './revenuecat';
import type { FetchLike } from './https-allowlist';
import { MRR_MAX_DOLLARS, MRR_POLL_MS, MRR_XP_PER_DOLLAR, REVENUECAT_KEY_ACCOUNT, REVENUECAT_PROJECT_ACCOUNT, STRIPE_KEY_ACCOUNT } from './mrr-config';

export interface MrrEngineDeps {
  readonly xpEngine: Pick<XpEngine, 'getLastMrrAwardDate' | 'awardMrr'>;
  readonly getMode: () => 'tokens' | 'mrr';
  readonly getSecretStoreDir: () => string;
  readonly getKeychainService: () => string;
  readonly getConnected: () => { readonly stripe: boolean; readonly revenuecat: boolean };
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class MrrEngine {
  private readonly deps: MrrEngineDeps;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;

  constructor(deps: MrrEngineDeps) {
    this.deps = deps;
  }

  start(): void {
    void this.pollNow();
    if (this.timer) return;
    this.timer = setInterval(() => void this.pollNow(), MRR_POLL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollNow(): Promise<void> {
    const { xpEngine, getMode, getSecretStoreDir, getKeychainService, getConnected, now, fetchImpl } = this.deps;
    if (getMode() !== 'mrr') return;
    if (this.pollInFlight) return;
    this.pollInFlight = true;

    try {
      const today = localDateString((now ?? (() => new Date()))());
      // Once per local date, and never for a date at-or-before the last
      // award: <= (lexicographic on YYYY-MM-DD) instead of === means a clock
      // rolled backwards can't re-award a day that was already paid out.
      const lastAward = xpEngine.getLastMrrAwardDate();
      if (lastAward !== null && today <= lastAward) return;

      const connected = getConnected();
      const storeDir = getSecretStoreDir();
      const service = getKeychainService();
      let totalDollars = 0;
      let sawConnectedSource = false;

      if (connected.stripe) {
        const apiKey = await getSecret(storeDir, service, STRIPE_KEY_ACCOUNT);
        if (!apiKey) return; // connected flag says yes but the key is gone — no guessed award
        const mrr = await getStripeMrr({ apiKey, fetchImpl });
        if (mrr === null) return;
        totalDollars += mrr;
        sawConnectedSource = true;
      }

      if (connected.revenuecat) {
        const apiKey = await getSecret(storeDir, service, REVENUECAT_KEY_ACCOUNT);
        const projectId = await getSecret(storeDir, service, REVENUECAT_PROJECT_ACCOUNT);
        if (!apiKey || !projectId) return;
        const mrr = await getRevenueCatMrr({ apiKey, projectId, fetchImpl });
        if (mrr === null) return;
        totalDollars += mrr;
        sawConnectedSource = true;
      }

      if (!sawConnectedSource) return; // mrr mode but nothing connected — nothing to award

      // Sanity clamp: negative/NaN collapses to 0 (date still recorded — a
      // garbage value is not retried the same day), absurd values cap at
      // MRR_MAX_DOLLARS so a corrupt response can't mint unbounded XP.
      const dollars = Number.isFinite(totalDollars) ? Math.min(Math.max(0, totalDollars), MRR_MAX_DOLLARS) : 0;
      await xpEngine.awardMrr(Math.floor(dollars * MRR_XP_PER_DOLLAR), today);
    } finally {
      this.pollInFlight = false;
    }
  }
}
