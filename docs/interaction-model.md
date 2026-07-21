# Interaction Model — Grab & Parachute Drop

> Specification of the beaver grab/drop interaction. Platform-neutral by
> design — the same renderer + state-machine code drives both the **Windows**
> and **macOS** builds; there are no platform branches in the interaction path.
> Status: **verified against implementation** (Windows + macOS), 2026-07-21.

## Overview

The beaver roams the screen autonomously (idle / walk / climb). The user can
grab it and drop it with a parachute:

1. **Click the beaver 3 times** within a single **4-second window**.
2. The beaver **sticks to the cursor** and plays a **struggle** animation.
   While grabbed, the overlay **captures all mouse input** — nothing below the
   overlay is clickable until release.
3. A **double-click** (anywhere) **releases** the beaver at the cursor
   position.
4. The beaver **glides down with a parachute** (8-frame animation plus
   procedural wind sway).
5. On reaching the ground it plays a short **landing** animation, then resumes
   the normal roam loop (`idle` → roam state machine).

## States

| State     | Entered when                              | Visuals                | Input capture            | Exits when                          |
|-----------|-------------------------------------------|------------------------|--------------------------|-------------------------------------|
| `roaming` | default / after landing                   | idle / walk / climb    | click-through (see below)| 3rd click inside the 4 s window     |
| `grabbed` | click counter reaches 3                   | `struggle` row         | **full capture**         | double-click → `gliding`            |
| `gliding` | double-click while grabbed                | `parachute-wind` row + wind sway | click-through    | ground contact → `landing`          |
| `landing` | beaver reaches the ground                 | `land` row             | click-through            | animation finished → `roaming`      |

## Click counting

- The beaver is clickable **in every roam state** (idle, walk, climb) — no
  state restriction for now.
- The **window opens on click 1** and lasts **4 seconds total**. All three
  clicks must land inside this window; the gaps between clicks do not matter
  beyond that. When the window expires, the counter resets to 0.
- A click counts when the pointer-down position is inside the beaver's sprite
  bounds (hit test against the current frame rectangle).

## Input capture semantics

The overlay window is **click-through by default**
(`BrowserWindow.setIgnoreMouseEvents(true)`), so the desktop below stays fully
usable. The interaction requires temporarily capturing input:

- **Hover capture (roaming):** with `forward: true`, mouse-move events are
  delivered to the overlay while clicks still pass through. When the cursor
  enters the beaver's bounds, the overlay switches to full capture
  (`setIgnoreMouseEvents(false)`) so clicks on the beaver register; when the
  cursor leaves, it switches back. Trade-off (standard for desktop pets):
  while hovering the beaver, that screen region does not pass clicks to apps
  below. This hover capture only applies on stages that ship the
  struggle/parachute-wind/land rows — **baby** and **adult** (BL-18); in teen
  the overlay stays fully click-through.
- **Full capture (grabbed):** the overlay captures **all** mouse input. No
  window below is clickable until the beaver is released. This is an explicit
  product decision (Owner, 2026-07-20) and is only available on the baby and
  adult stages.
- **Release → click-through:** after the double-click, capture is returned and
  the overlay is click-through again during `gliding` and `landing`, even when
  the cursor is hovering over the descending beaver (C3 refinement).

## Glide physics

- 8-frame `parachute-wind` animation loop.
- Procedural **wind sway** on top: sinusoidal horizontal drift plus slight
  rotation, scattered by the injected rng, tuned fall speed — the goal is a
  believable, organic descent.
- Horizontal drift is clamped to the screen bounds.

## Platform notes

Both platforms run the **same** `src/main/overlay-adapter.ts` and renderer
state machine (`src/renderer/roam.ts`, pure and unit-testable) — no
platform-specific branch exists in the interaction path.

- **Windows:** Electron `win.setIgnoreMouseEvents(true, { forward: true })`
  delivers mouse-move events while staying click-through;
  `setIgnoreMouseEvents(false)` captures everything. Packaging + typecheck/lint/
  test run on `windows-latest` CI (`.github/workflows/ci.yml`). The overlay
  visual design gate is tracked in
  `docs/design-reviews/BL-19-windows-parachute-gate.md`.
- **macOS:** the identical `forward: true` path delivers the hover/move events
  the grab needs and clicks register the same as on Windows — confirmed by
  owner testing during BL-18/BL-19. (An earlier hypothesis that `forward`
  behaved differently on macOS was disproven: the baby grab always worked on
  macOS; the adult stage failing was a stage-gating bug in the renderer's
  click handlers, not a platform issue — fixed in BL-18.) Hit-testing and
  dirty-rect math run in **logical** pixels, so Retina/HiDPI is handled by the
  shared DPR transform (`src/renderer/canvas-dpr.ts`), not per-platform code.

## Animation assets

| Row              | Purpose                          | Frames |
|------------------|----------------------------------|--------|
| `struggle`       | dangling/wriggling while grabbed | 8      |
| `parachute-wind` | gliding with visible wind        | 8      |
| `land`           | touchdown, absorb, into idle     | 8      |

Rows follow the app sheet format (96px-wide tiles). Baby rows are 96×96. The
**adult** `parachute-wind` row uses a taller **96×128** tile (BL-19) so the
beaver renders full-size while the canopy extends upward — `drawFrame`
bottom-anchors taller rows to the same ground line as every other row, and the
pet's **logical footprint stays 96px** (roam bounds / click-through hit-box
unchanged). Registered in `docs/asset-gallery.md` and gated by the design
review (#38).
