// Tuning constants for the MRR growth mode. Kept in one small domain config
// module per CLAUDE.md's "no magic numbers in logic" rule.

// How often the daily MRR poll runs. Coalesced/unref'd (same discipline as
// usage/tracker.ts) — never keeps the process alive on its own.
export const MRR_POLL_MS = 24 * 60 * 60 * 1000;

// XP awarded per whole dollar of daily MRR (floor(mrr_dollars * rate)).
// Flat daily award, not continuous accrual — see the plan's auto-decisions.
export const MRR_XP_PER_DOLLAR = 10;

// Sanity cap on summed daily MRR before it converts to XP: anything above
// this is a corrupt/hostile API response, not revenue — clamp so one bad
// poll can never mint unbounded XP.
export const MRR_MAX_DOLLARS = 1_000_000;

// Keychain service name used when no `--keychain-service` override is
// passed (QA uses an override so it never touches real entries).
export const DEFAULT_KEYCHAIN_SERVICE = 'beaver-buddy';

// Keychain accounts under the resolved service. One secret per account,
// never combined into a single blob (so a single Disconnect can drop
// exactly the source it targets).
export const STRIPE_KEY_ACCOUNT = 'stripe-key';
export const REVENUECAT_KEY_ACCOUNT = 'revenuecat-key';
export const REVENUECAT_PROJECT_ACCOUNT = 'revenuecat-project';
