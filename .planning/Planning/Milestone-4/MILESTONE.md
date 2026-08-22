# Milestone 4 — Level, XP & Profile System

> Why it matters: The gamification backbone (meeting 2026-07-21): token consumption becomes XP,
> XP becomes an unlimited quadratic level curve calibrated through L32, with five
> life stages; levels unlock interactions from about level 8.
> Local persistence without auth — account linking only post-cycle 1.

**Status:** in-progress — P2 complete; P1 durable storage, P3 profile and P4 character map remain open.

**Accountable:** Rodgi (state logic/definition) · Jurij advises on the data model · **Agent:** pi · **Duration (rough):** 3–4 weeks (parallel to M3)

## Facts from the meeting (binding)
- XP comes from **input + output tokens** of supported models, **cache excluded**
  (no double counting), weighted by the Intelligence Index table (γ=2).
- Storage **aggregated daily per model** (date + input/output sums) — no raw-data mountains.
- **Local config file**, no auth in C1; migration to account/DB is planned post-C1.
- No hard level cap. The exact table covers L1–L32 and the quadratic formula continues
  beyond it; stages are baby L1–4, young baby L5–8, teenager L9–16, older teenager
  L17–24 and adult L25+.
- **Character map JSON:** level ↔ sprites ↔ animations as an extensible contract
  (updates without reprogramming).
- **Naming** on first launch (Pokémon principle); the "AI Beaver" brand remains.
- **Achievements** for milestones (e.g. 7 / 30 days of active time).

## Phases
- [ ] Phase 1 — Token tracking & aggregation: WAVE-1 reader/aggregation ✅; WAVE-2 durable daily storage open · **Blocked by:** none
- [x] Phase 2 — XP/level model: model-weighted formula, exact table 1–32, five-stage mapping, unlimited continuation and migration · **Completed:** PR #52
- [ ] Phase 3 — Persistence & profile: local config (atomic-file), naming on first launch, achievements (7/30 days) · **Blocked by:** M4/P2
- [ ] Phase 4 — Character map JSON: contract level↔sprite sets↔animations, loader + validation · **Blocked by:** M2/P1–P2 ✅ (pipeline/bake format is in place)

## Success
- XP demonstrably rises with real token consumption; level-ups trigger stage/interaction
  unlocks; the profile (name, level, achievements) survives restarts; the character map
  is the only place linking level↔assets.

## Dependencies
- **Blocked by:** nothing hard (P4 uses finished M2 results)
- **Blocks:** M5 runtime wiring of level-coupled triggers (from P2), M6/P1 (docs)

## Notes
- Items #24/#25 from `.flightplan/Reference/windows-native-flight-plan.md` feed into P1;
  #26/#27 (MRR) remain post-cycle 1.
- Source: `.flightplan/Meetings/2026-07-21-planung/summary.md` (level 00:54:38/01:04:16,
  XP 01:03:06, aggregation 01:10:50, character map 01:30:53, local storage 02:11:46).
