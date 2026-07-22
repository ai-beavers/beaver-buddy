# Phase 12 — Stage Art Package: young baby, older teen, adult (#7)

> Part of Milestone 5. Done when: all 5 life stages have their own final art —
> **young baby** (L5–8), **older teen** (L17–24) and **adult** (L25–32,
> no more teen-upscale placeholder) are generated, baked and registered.
> Baby + teen already exist.

**Status:** not-started

**Background (owner decision 2026-07-21):** 5 life stages instead of 3 — that's why this
phase grew from "Adult Art Polish" into the **Stage Art Package** and was pulled into
the Z1 scope (users reach adult around day 37, within the Z1 horizon).

## Waves
- [ ] WAVE-1 — Generate missing stage parts (young baby, older teen,
  adult: larger proportions, same style), rig, bake
- [ ] WAVE-2 — Retire the placeholder pipeline (`build-adult-placeholder.ts`), wire
  stages into the character map (M4/P4), design gate, gallery update

## Notes
- Depends on the adjusted ComfyUI workflow (M2/P2 ✅) — that's why it's scheduled as the last phase of the milestone.
- Current placeholder: byte-deterministic teen upscale (npm run assets:adult-placeholder), documented in `assets/STYLE.md` + `docs/asset-gallery.md`.

**Accountable:** Vlady (Assets via Claude Code; Runtime: Rodgi + pi)
**Cycle:** Cycle 1 (pulled in 2026-07-21)
**Blocked by:** M2/P2 ✅ (workflow in place) · wiring of the stages additionally: M4/P2 + M4/P4 (level boundaries + character map)
**Duration (rough):** ~2 weeks (3 stage sets instead of 1)
