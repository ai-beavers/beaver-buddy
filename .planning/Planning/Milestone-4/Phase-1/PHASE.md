# Phase 1 — Token Tracking & Aggregation

> Part of Milestone 4. Done when: daily aggregated token sums (input/output, without
> cache) per model are captured from the usage logs and stored locally (#24, #25).

**Status:** in-progress — WAVE-1 delegated to cloud agent (2026-07-22, brief: [AGENT-BRIEF.md](AGENT-BRIEF.md)); first increment **merged via PR #42** (`feat/multi-harness-usage-logs`)

**Accountable:** Rodgi · **Agent:** cloud agent (Claude Code/Codex) for WAVE-1, pi afterwards
**Cycle:** Cycle 1
**Blocked by:** none (M1 usage logs exist) — **can start immediately**
**Blocks:** M4/P2
**Duration (rough):** ~1 week

## Waves
- [ ] WAVE-1 — Log reader following the TokScale model: find + parse local token logs, **only real input/output tokens** per model (cache creation + cache read strictly excluded), daily aggregation
- [ ] WAVE-2 — Storage schema (local, append-safe, atomic-file), edge cases (#24), tests

## Notes
- No raw-data mountains: only date + aggregated values per day and model (meeting 01:10:50).
- Data source: **TokScale logic** as the template for finding/reading the local token logs (spec §1b) — our own reader, no tool dependency. Reference repo: https://github.com/junhoyeo/tokscale (**logical reference only**, do not commit into the codebase — details in the AGENT-BRIEF).
- **Refresh interval:** the reader is called by the app **every 10 minutes** → read incrementally.
- **Outlook (not Z1 scope):** aggregated token usage should later be pushed to the **user DB of the AI Beavers account** → choose a push-capable schema; the push itself comes later.
- Branch: `feat/multi-harness-usage-logs` (merged via PR #42, 2026-07-22); follow-ups via new branches off `origin/main`.
- Items: `Reference/windows-native-flight-plan.md` #24 (Codex path edge cases), #25 (spike detection).
