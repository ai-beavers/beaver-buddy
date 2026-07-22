# Phase 2 — Clone & adapt the ComfyUI "PixelArt Builder" workflow

> Part of Milestone 2. Done when: a new workflow produces beaver parts at different size parameters in the same style, and the parts are usable in the Puppet Studio.

**Status:** done (2026-07-19)

## Waves
- [x] WAVE-1 — Clone workflow, adjust size parameters, generate first parts (see `Waves/WAVE-1.md`)

## Notes
- Template: existing ComfyUI workflow "PixelArt Builder" (hamster avatar animations).
- Goal: fast generation of new characters/stages/parts in a consistent style; more complex animations by combining individual animations.
- Parts land under `assets-src/parts/<rig>/` (gitignored), sheets after bake in `assets-src/baked/` — only reviewed sheets are committed (CLAUDE.md assets rule).
- MCP server for ComfyUI is configured (access confirmed in an earlier session); setup docs are deliberately not in the repo (don't commit API keys/local paths).
