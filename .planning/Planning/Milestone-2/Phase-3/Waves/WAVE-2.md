# Wave 2 — Parachute Drop: Runtime (Input Capture, State Machine, Glide, Landing)

**Status:** done (2026-07-20) — all 4 chunks committed on BL-17 (HEAD `3fe1e7d`); carry-overs at the bottom.

## Chunk plan (loop: plan → review → implement → verify → doc)
- [x] C1 — Click counter (4-s window) + `grabbed` phase in `roam.ts` + tests ✅ 2026-07-20 (planner→worker→reviewer: 2 critical fixes [fixed window instead of sliding, reset on enterGrabbed] + 5 test extensions; 511 tests green, tsc/eslint clean)
- [x] C2 — `gliding` physics (wind sway) + `landing` phase + tests ✅ 2026-07-20 (planner→worker→pi verification: 19 new tests, 476 green; commit `0076d22` on BL-17. New insights in the plan: clampRoamStateToBounds phase-aware [resize during glide], rotation reset after climb)
- [x] C3 — Input capture layer (renderer pointer + `overlay-adapter.ts`) ✅ 2026-07-20 (1 IPC channel `input:capture-mode`, hover-forward initial, pure logic input-capture.ts; pi review fixed spec deviation: gliding/landing = click-through even on hover; 496 green; commit on BL-17)
- [x] C4 — Renderer wiring + integration + mandatory items ✅ 2026-07-20 (sheet intake `assets/sprites/` 768×480/5 rows via `assets:parachute` + byte-match reconciliation test; beaver-baby removed from STAGE_SPECS; stage gating baby-only; facing/rotation reset; interaction-model.md finalized; BL-17 verdict **PASS with 2 documented limitations**; CDP screenshots pending manual; suite 500 green)

## Closing notes (2026-07-20)
- BL-17: 8 commits on upstream/main (`d1ace44`..`3fe1e7d`).
- Carry-over 1: gallery re-apply after merge of PR #28–#30 (entry from fork commit b6c97f1).
- Carry-over 2: owner sign-off on struggle left-facing frames (verdict: pending).
- Carry-over 3: live screenshots manually by owner (CDP hung in pi environment).
- Carry-over 4: update PR #31 (push BL-17 + body: now contains ALL slices incl. input wiring + assets).

## Prerequisites
- [ ] WAVE-1 done (rows `struggle`/`parachute-wind`/`land` in the sheet) — **only needed for C4 integration**; C1–C3 are asset-independent
- [x] `docs/interaction-model.md` available as specification (draft since 2026-07-20)

## Tasks
- [ ] **Input capture layer:** pointer events in the renderer + orchestration of
      `setIgnoreMouseEvents` in the main process (`src/main/overlay-adapter.ts`):
      hover capture on the beaver (make clicks visible) → full capture during
      `grabbed` (nothing below clickable) → hand back to click-through after
      the landing
- [ ] **Click counter:** 3 clicks within a 4-s total window (window
      starts with click 1, then reset); clickable in every roam state;
      hit test on the beaver sprite area
- [ ] **State machine (`src/renderer/roam.ts`, pure + unit-testable):**
      new phases `grabbed` (follows cursor, struggle row, roam paused),
      `gliding` (parachute-wind row + wind sway physics: sinusoidal
      horizontal drift + slight rotation, rng-scattered, fall speed
      tuned), `landing` (land row, then `idle` → normal loop)
- [ ] **Release:** double-click during `grabbed` → transition into `gliding` at
      the cursor position
- [ ] **Renderer loop wiring:** load/register sheet rows, animation
      per phase, bounds handling (landing at the bottom edge)
- [ ] **Tests:** unit tests for the state machine (transitions, 4-s window, reset,
      bounds/landing, rng-deterministic), click counter tests, existing
      suite green (`./node_modules/.bin/vitest run`, `tsc`, `eslint`)
- [ ] **Design gate (#38):** verdict under `docs/design-reviews/`
- [ ] **Registration:** new rows/assets in `docs/asset-gallery.md`
- [ ] **Docs:** verify `docs/interaction-model.md` against the implementation
      and finalize

## Done when
- The complete sequence "3× click (≤4 s) → grabbed (squirms, full capture) →
  double-click → gliding (wind sway) → landing → roam loop" works live
  in the Windows app; tests green; design gate + gallery + interaction docs
  done.

## Notes
- `roam.ts` stays free of DOM/Canvas access (pure functions, injected rng).
- `npx` is blocked (pi safety guard) → local binaries `./node_modules/.bin/…`.

## C4 addendum (from PR split 2026-07-20)
- [ ] **Gallery re-apply:** `docs/asset-gallery.md` does not yet exist on
  upstream/main (comes with PR #28–#30). The prepared gallery entry
  ("parachute-drop animations", as of fork commit b6c97f1) must be re-applied
  after their merge — together with the sheet intake.
