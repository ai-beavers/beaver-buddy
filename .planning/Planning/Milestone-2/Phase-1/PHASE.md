# Phase 1 — PixiJS Puppet Studio

> Part of Milestone 2. Done when: rig system + bake pipeline produce app-compatible sprite sheets from individual parts.

**Status:** done (2026-07-17/18)

## Waves
- [x] WAVE-1 — Studio skeleton: rig/keyframes/puppet/sheet + serve.mjs + UI (PR: BL-14)
- [x] WAVE-2 — Re-bake with real parts + frozen-pose fix (canopy artifact after bake, commit `9290061`)

## Notes
- Dev-time tooling only: `pixi.js` is a devDependency, eslint blocks imports under `src/` (ADR 001: the shipped renderer stays Canvas2D).
- Rigs: `tools/puppet-studio/rigs/beaver-baby.json` (8 parts incl. canopy), `tree.json`; recipes: idle, walk, parachute, tree-sway.
- Bake output → `assets-src/baked/` (gitignored) → asset review → `assets/sprites/` (committed) → registration in `docs/asset-gallery.md`.
- Run: `npm run studio:parts` → `npm run studio` → http://localhost:8377/.
