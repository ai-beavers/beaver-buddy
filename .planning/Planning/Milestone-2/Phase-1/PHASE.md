# Phase 1 — PixiJS Puppet Studio

> Part of Milestone 2. Done when: Rig-System + Bake-Pipeline erzeugen App-kompatible Sprite-Sheets aus Einzelteilen.

**Status:** done (2026-07-17/18)

## Waves
- [x] WAVE-1 — Studio-Grundgerüst: rig/keyframes/puppet/sheet + serve.mjs + UI (PR: BL-14)
- [x] WAVE-2 — Re-Bake mit echten Parts + Frozen-Pose-Fix (Canopy-Artefakt nach Bake, Commit `9290061`)

## Notes
- Dev-Time-Tooling only: `pixi.js` ist devDependency, eslint blockt Import unter `src/` (ADR 001: shipped Renderer bleibt Canvas2D).
- Rigs: `tools/puppet-studio/rigs/beaver-baby.json` (8 Parts inkl. Canopy), `tree.json`; Rezepte: idle, walk, parachute, tree-sway.
- Bake-Output → `assets-src/baked/` (gitignored) → Asset-Review → `assets/sprites/` (committed) → Registrierung in `docs/asset-gallery.md`.
- Run: `npm run studio:parts` → `npm run studio` → http://localhost:8377/.
