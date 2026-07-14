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

// Token throughput (tokens/minute, measured between two tracker snapshots)
// that counts as a "spike" worth commenting on.
export const TOKEN_SPIKE_RATE_PER_MIN = 2_000;

// Minutes of continuous nonzero-token snapshots before a codingSession quip.
export const CODING_SESSION_LENGTH_MIN = 20;

// Minutes of continuous zero-token snapshots before an idle quip.
export const IDLE_LENGTH_MIN = 15;
