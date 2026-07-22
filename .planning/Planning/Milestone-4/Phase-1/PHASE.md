# Phase 1 — Token Tracking & Aggregation

> Part of Milestone 4. Done when: daily aggregated token sums (input/output, without
> cache) per model are captured from the usage logs and stored locally (#24, #25).

**Status:** not-started (stub — detailed definition at phase start with Rodgi)

**Accountable:** Rodgi · **Agent:** pi
**Cycle:** Cycle 1
**Blocked by:** none (M1 usage logs exist) — **can start immediately**
**Blocks:** M4/P2
**Duration (rough):** ~1 week

## Waves
- [ ] WAVE-1 — Log reader following the TokScale model: find + parse local token logs, **only real input/output tokens** per model (cache creation + cache read strictly excluded), daily aggregation
- [ ] WAVE-2 — Storage schema (local, append-safe, atomic-file), edge cases (#24), tests

## Notes
- No raw-data mountains: only date + aggregated values per day and model (meeting 01:10:50).
- Data source: **TokScale logic** as the template for finding/reading the local token logs (spec §1b) — our own reader, no tool dependency.
- Items: `Reference/windows-native-flight-plan.md` #24 (Codex path edge cases), #25 (spike detection).
