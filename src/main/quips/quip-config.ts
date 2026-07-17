// Tuning module for the quip system (CLAUDE.md "no magic numbers in logic"
// rule) — cooldown, display duration, and detector thresholds all live here.
//
// No separate detector-poll-cadence constant: detectors ride the usage
// tracker's own refresh timer (usage/config.ts USAGE_REFRESH_MS) via
// UsageTracker.onTick, rather than running a second polling loop — a
// duplicate constant here would just be a second name for the same number.

// Minimum gap between two shown quips, regardless of trigger — the beaver
// never says more than one thing per cooldown window.
export const QUIP_COOLDOWN_MS = 10 * 60_000;

// How long the renderer keeps a quip's speech bubble on screen.
export const QUIP_DISPLAY_DURATION_MS = 6_000;

// Daily token-count floors for the spend-tier quips (tokens only — no USD).
// Calibrated from independent HN / community / Anthropic-docs research:
//   weak  < 2M   — light/occasional day
//   ok    2M–20M — typical daily-driver cluster
//   crazy ≥ 20M  — power-user territory (Anthropic's top ~5%)
export const SPEND_TIER_OK_MIN_TOKENS_PER_DAY = 2_000_000;
export const SPEND_TIER_CRAZY_MIN_TOKENS_PER_DAY = 20_000_000;

// Minutes of continuous nonzero-token snapshots before a codingSession quip.
export const CODING_SESSION_LENGTH_MIN = 20;

// Minutes of continuous zero-token snapshots before an idle quip.
export const IDLE_LENGTH_MIN = 15;
