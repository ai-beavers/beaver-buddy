# Milestone 2 — Asset Pipeline & Animations

> Why it matters: New beaver characters, stages, and animations should be produced quickly and reproducibly with the ComfyUI workflow + PixiJS Puppet Studio and baked into the app — without manual pixel work.

**Status:** in-progress (P3 paused since 2026-07-21 — re-onboarding/cycle-1 re-planning; resume via `/fp-resume` in Claude Code, spec: `Phase-3/Waves/WAVE-3.md`)

**Accountable:** Vlady (Assets) + Rodgi · **Agent:** Claude Code (Assets), pi (Runtime, Rodgi only)

## Phases
> Convention (owner decision 2026-07-20): one animation per phase, 1–2 waves
> (WAVE-1 assets, WAVE-2 runtime). Detailed definition at the start of each phase.
> **Move 2026-07-21:** The animation implementation phases (formerly P4–P15) now
> live in **Milestone 5**. Only the pipeline foundation + parachute pilot remain here.

- [x] Phase 1 — PixiJS Puppet Studio (BL-14, ADR 003)
- [x] Phase 2 — Clone & adapt the ComfyUI "PixelArt Builder" workflow
- [ ] Phase 3 — Parachute drop (interaction animation) — **paused** (WAVE-1 ✅, WAVE-2 ✅, WAVE-3 polish open)

## Success
- Pipeline in place: parts/animations are generated, rigged, baked, reviewed, and registered in `assets/sprites/` + `docs/asset-gallery.md`. ✅ (P1/P2)
- Parachute drop complete as pilot interaction (design gate + gallery).

## Dependencies
- **Blocked by:** none (M1 ✅)
- **Blocks:** M5 all phases (pipeline), M4/P4 (character map uses bake output)

## Open resume items (P3, on resumption)
- Claude Code: WAVE-3/P1 (white artifacts on parachute) + P3a (struggle-b/c strips)
- pi (Rodgi): WAVE-3/P2 (glide scale 1.5×) + P4 (wind drift) + P3b (random player)
- Owner: live test + sign-off on struggle frames · org admin: PR #28/#29/#33
