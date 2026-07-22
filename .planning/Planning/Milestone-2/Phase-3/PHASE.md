# Phase 3 — Parachute Drop (Interaction Animation)

> Part of Milestone 2. Done when: the interaction "3× click → beaver sticks to
> the cursor (squirming, overlay captures everything) → double-click releases →
> parachute glide with wind sway → clean landing → back into the roam loop" is
> fully implemented, tested, design-approved (design gate), and registered in
> `docs/asset-gallery.md`. The interaction logic is documented in
> `docs/interaction-model.md` (platform-neutral, macOS-portable).

**Status:** in-progress — **PAUSED 2026-07-21** (re-onboarding/cycle-1 re-planning; WAVE-1 ✅, WAVE-2 ✅, WAVE-3 open. Resume: Claude Code → WAVE-3/P1+P3a, then pi → P2/P4/P3b)

**Blocked by:** none · **Blocks:** nothing hard (pilot interaction; M5 can start in parallel)
**Accountable:** Vlady (Assets via Claude Code) + Rodgi (Runtime via pi)

## Clarified Scope (owner decisions 2026-07-20)

- **Click detection:** the beaver is clickable in **every** state (idle, walk,
  climb — no restriction for now). 3 clicks must fit within a **total time
  window of 4 seconds** (window starts with click 1; then the counter resets).
- **Grab:** after click 3 the beaver sticks to the cursor. **Squirm animation**
  (new asset, still to be created). Roam state machine pauses.
- **Input capture:** during the grab the overlay captures **all** mouse events
  — no other windows are clickable until the beaver is released.
- **Release:** a **double-click** (anywhere) releases the beaver at the current
  cursor position.
- **Glide:** parachute animation (8 frames) + **procedural wind sway**
  (horizontal drift + slight rotation, as realistic as possible). The glide
  frames will be **newly created/improved** (wind effect in the sprites
  themselves + additional runtime motion).
- **Landing:** dedicated, clean **landing animation** (new asset), then
  seamlessly back to `idle` → normal roam loop.
- **Assets:** gap analysis first; missing animations (struggle, improved
  parachute-wind, land) will be created — studio keyframe recipes and/or
  ComfyUI generation. Cost/credits are not a blocker (owner).

## Waves
- [x] WAVE-1 — Assets: gap analysis + **full ComfyUI generation** (struggle,
      parachute-wind, land) + bake into app sheet format
      (`assets-src/baked/beaver-baby/`, 768×480, 5 rows) + smoke test.
      Intake into the committed sheet + test reconciliation + design gate → C4.
      (see `Waves/WAVE-1.md`)
- [x] WAVE-2 — Runtime: input capture layer, click counter (4-s window),
      `roam.ts` state machine (grabbed/gliding/landing), glide physics with
      wind sway, tests, design gate, gallery + `docs/interaction-model.md`
      finalization (see `Waves/WAVE-2.md`)
- [ ] WAVE-3 — Polish after owner review (2026-07-20): P1 white artifacts on
      parachute (near-white pass in ingest), P2 glide scaling (beaver
      larger while hovering), P3 struggle variation (detailed planning with
      owner), P4 wind drift variance (see `Waves/WAVE-3.md`)

## Notes
- Mandatory as always: design gate verdict (#38) under `docs/design-reviews/`,
  registration in `docs/asset-gallery.md`.
- Interaction specification: `docs/interaction-model.md` (repo, English) —
  reference also for the later macOS implementation.
- `roam.ts` stays a pure, unit-testable state machine (no DOM/Canvas).
