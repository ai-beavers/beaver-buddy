# Interaction Model — Grab & Parachute Drop

> Specification of the beaver grab/drop interaction. Platform-neutral on
> purpose: it is the reference for the Windows implementation and for any
> future port (e.g. macOS). Status: **specification draft** (2026-07-20),
> verified against the implementation in Milestone 2 / Phase 3 / Wave 2.

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
  below.
- **Full capture (grabbed):** the overlay captures **all** mouse input. No
  window below is clickable until the beaver is released. This is an explicit
  product decision (Owner, 2026-07-20).
- **Release → click-through:** after the double-click, capture is returned and
  the overlay is click-through again during `gliding` and `landing`.

## Glide physics

- 8-frame `parachute-wind` animation loop.
- Procedural **wind sway** on top: sinusoidal horizontal drift plus slight
  rotation, scattered by the injected rng, tuned fall speed — the goal is a
  believable, organic descent.
- Horizontal drift is clamped to the screen bounds.

## Platform notes

- **Windows (reference implementation):** Electron
  `win.setIgnoreMouseEvents(true, { forward: true })` delivers mouse-move
  events while staying click-through; `setIgnoreMouseEvents(false)` captures
  everything. Implemented in `src/main/overlay-adapter.ts`, driven by the
  renderer state machine (`src/renderer/roam.ts`, pure and unit-testable).
- **macOS (future port):** the same Electron API exists. Verify: `forward`
  behavior on macOS (event delivery granularity), Retina scale factors for the
  hit test (DIP vs. physical pixels), and multi-display bounds. The state
  machine and click counting are platform-neutral and reusable as-is.

## Animation assets

| Row              | Purpose                          | Frames |
|------------------|----------------------------------|--------|
| `struggle`       | dangling/wriggling while grabbed | tbd (M2/P3/W1) |
| `parachute-wind` | gliding with visible wind        | 8      |
| `land`           | touchdown, absorb, into idle     | tbd (M2/P3/W1) |

All rows follow the app sheet format (96×96 tiles), registered in
`docs/asset-gallery.md` and gated by the design review (#38).
