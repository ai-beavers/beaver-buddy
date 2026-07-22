# Wave 3 — Parachute Drop: Polish (Owner Feedback 2026-07-20)

**Status:** not-started · Occasion: owner review of the assets/integration; 4 adjustment points

## Chunks (loop as usual: plan → worker → pi verification)
- [ ] P1 — **Remove white artifacts in the parachute (assets):** → **CLAUDE CODE**
      (owner decision 2026-07-20: asset editing/generation generally done
      by Claude Code, because of Comfy Cloud MCP + tooling). Two paths, Claude
      Code decides based on feasibility:
      (a) **Mechanical (preferred, no credits):** near-white pass in
      `scripts/gen-sprites/ingest-animation-frames.mjs` — connected components
      on opaque near-white pixels (min(r,g,b) ≥ ~240, calibrate), remove ONLY
      regions ≥ size guard (e.g. 0.05% of the raw frame area) so that
      eye highlights/belly speckles survive; then re-bake + re-intake +
      tests (no opaque near-white ≥ guard; belly/eye samples stay opaque;
      re-golden determinism/byte match).
      (b) **Regeneration:** regenerate parachute-wind frames via the ComfyUI
      workflow (BiRefNet alpha removes enclosed white at the source;
      document style anchoring + seeds).
      Goal: only ropes + red canopy visible, no white artifact left.
      Diagnosis (confirmed): panel white is enclosed; flood fill from the
      edges does not reach it.
- [ ] P2 — **Beaver larger while gliding down (runtime):** scale factor
      during `gliding` (and possibly `landing`), proposal `GLIDE_SCALE = 1.5`
      (PET_SCALE=1; drawFrame already supports scale; check pixel-art smoothing:
      imageSmoothingEnabled=false → nearest-neighbor). Dirty rect/pad
      must cover the larger footprint!
- [ ] P3 — **More variation in the struggle animation:** ✅ decision (c):
      (a) **Claude Code** generates 1–2 additional struggle strips via
      Comfy Cloud MCP (style anchoring! document seeds) + intake as
      additional rows (`struggle-b`, `struggle-c`) — assignment in HANDOFF.md;
      (b) **pi** builds the runtime player: during `grabbed` an
      rng-driven sequence of 2–3 struggle rows plays (random order,
      clean transitions at loop end, seed-deterministically testable)
- [ ] P4 — **Stronger wind variance (runtime, roam.ts):** in addition to the sway,
      a persistent horizontal wind drift: `glideDriftV` (px/s, rng from
      [-MAX, +MAX], new constant `GLIDE_WIND_DRIFT_MAX_PX_S` ~25–40) pushes
      `glideBaseX` during flight; optional gust events (drift is
      re-rolled mid-flight, `GLIDE_GUST_INTERVAL_S`). Bounds clamping
      stays hard. Tests: drift direction/magnitude, seed determinism, bounds.

## Open decisions (owner) — DECIDED 2026-07-20
1. **P2 scale factor:** ✅ **1.5×** (GLIDE_SCALE = 1.5)
2. **P3 approach:** ✅ **(c) both combined** — 1–2 additional struggle strips
   (new rows, e.g. `struggle-b`, `struggle-c`) via ComfyUI + runtime player
   that randomly plays 2–3 of the struggle animations in sequence during
   `grabbed` (rng-driven sequence, variables in roam.ts/renderer)
3. **Asset generation AND editing in principle via Claude Code**
   (Comfy Cloud MCP; owner note 2026-07-20, second note same day:
   "the editing part must be done by Claude Code"). This includes P1 —
   Claude Code chooses there between mechanical pipeline fix (a) and
   regeneration (b), depending on what is feasible with workflow files/PixiJS
   tools. pi continues to take the runtime chunks (P2, P3b, P4).

## Tracked open task (beyond this wave)
- **Flight animations per beaver stage:** when the beaver grows (teen/adult,
  later stages), struggle/parachute-wind/land must be newly created
  + ingested per stage. The interaction is currently deliberately baby-only (C4 gating).
  → affects ROADMAP M2 Phase 5+ (every animation phase) and Phase 15
  (adult art); collect with every future stage-art phase.
