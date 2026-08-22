# Phase 2 — XP/Level Model & Level Table 1–32

> Part of Milestone 4. Done when: XP formula + level table 1–32 are defined and
> implemented (1–16 ≈ Baby→Teen, fast progress at the start), with tests and documented
> state logic of the stages.

**Status:** complete (2026-07-23) — implemented and merged via PR #52, including the owner-approved curve, model-weighted XP migration, five life stages, unlimited levels beyond L32 and tests.

**Accountable:** Rodgi · **Agent:** pi
**Cycle:** Cycle 1
**Blocked by:** M4/P1 WAVE-1 ✅ (token data basis available)
**Blocks:** M4/P3 · M5 runtime triggers (level unlocks from ~level 8)
**Duration (rough):** ~1–1.5 weeks

## Waves
- [x] WAVE-1 — XP formula using real input+output tokens with Intelligence Index model weighting (γ=2), quadratic progression curve and exact level table 1–32; formula continues beyond L32
- [x] WAVE-2 — Five-stage state logic, level-up events, schema-v2 migration, settings status payload, tests and docs

**Detail spec (owner-approved 2026-07-21):** [`XP-LEVEL-MODEL.md`](XP-LEVEL-MODEL.md) — curve, level table, stage mapping, lifetime separation, calibration plan.

## Notes
- Target playtime to level 32: ~2 months average (meeting 01:55:35) — calibrate the curve accordingly.
- ~~Open owner decision (NOTE.md): time as a second XP source yes/no.~~ DECIDED: separate, time XP later (spec §1/§5).
