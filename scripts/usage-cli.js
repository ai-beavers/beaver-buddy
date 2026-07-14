// Dev-only CLI (like scripts/gen-sprites) — not part of the app runtime.
// Prints derived daily + lifetime token totals from the real machine's
// Claude Code / Codex usage logs, for the ccusage ±5% cross-check and
// debugging. Runs against the compiled output: `npm run usage:cli`.
//
// Derived counts only — this prints aggregate token numbers, never raw log
// content, prompts, or paths.

const { UsageTracker } = require('../dist/main/usage/tracker');

const tracker = new UsageTracker();
tracker.refresh();
const totals = tracker.getTotals();

process.stdout.write(
  `${JSON.stringify({ daily: Object.fromEntries(totals.daily), lifetime: totals.lifetime }, null, 2)}\n`,
);
