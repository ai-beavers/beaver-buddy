# ADR 003: PixiJS as dev-time animation-authoring tool (never in the app runtime)

## Status

Accepted

## Date

2026-07-17

## Context

New animation ideas (parachute drop, growing tree, more complex combined
motions) make the current asset workflow — generating every animation frame
with an image model and ingesting full sprite sheets — slow and
iteration-hostile. We want to generate individual beaver **parts** once
(ComfyUI `PixelArt Builder` workflow), then assemble and rig them into many
animations quickly. PixiJS (MIT) provides the scene-graph pieces such a puppet
rig needs (nested containers, pivot points, rotation/scale tweens).

ADR 001 rejected PixiJS for the **app runtime** (persistent GPU-compositor
context for what is one animated sprite; power/weight grounds; idle-CPU
budget). That rejection governs what ships to users — not what developers run
locally to author assets.

## Decision

- PixiJS is allowed **only** as a dev-time dependency for the authoring
  studio (`tools/puppet-studio/`), which rigs ComfyUI-generated parts and
  bakes frames into the existing PNG sprite-sheet format
  (`assets/sprites/*.png` + `*.json`) that the plain-Canvas2D renderer already
  consumes.
- The shipped app keeps its plain-Canvas2D renderer. ADR 001's runtime
  rejection of PixiJS is **reaffirmed unchanged**.
- Enforcement:
  - eslint `no-restricted-imports` blocks `pixi.js` imports under `src/`.
  - `pixi.js` is a `devDependency` only — never `dependencies`.
  - The studio is not part of `npm run build`; it runs via `npm run studio`.
- License: pixi.js 8.19.0 is MIT — satisfies CLAUDE.md's dependency policy.

## Consequences

- Animation authoring becomes: generate parts once (ComfyUI) → write/adjust
  keyframe recipes in code → bake → review contact sheet → commit the sheet.
  No per-frame image-generation runs for routine motion (walk cycles, sways,
  pendulum swings).
- Extreme poses that rotation tweens cannot express in pixel-art style are
  still generated in ComfyUI as separate parts/keyframes (see the studio
  README's fidelity rules).
- Revisiting PixiJS in the **runtime** (live puppet animation in the app)
  still requires a new ADR with measured power/CPU evidence, per ADR 001's
  original demand.
