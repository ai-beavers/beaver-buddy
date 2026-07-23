# BL-10 design-gate verdict — adult `wave` + `flush` rows

Date: 2026-07-23
Verdict: **PASS** (both rows)

## Scope

WAVE-1-only rows for M5/P9, per owner decision 2026-07-23: build **both** a
friendly wave-goodbye LOOP and a source-faithful toilet-flush gag ONE-SHOT.
No runtime wiring. Sheet width stays 8 tiles (768px), so the flush narrative
is compressed into 8 frames (Auto-decision — `spliceRow` cannot widen a
single row without rewriting the whole adult sheet).

## Generation

Same environment constraint as BL-8/BL-9/BL-11: `upload_file` blocked;
`partner_generate` (`vertexai/nano-banana-pro`) with the public committed
adult sheet raw URL and copy-the-idle-tile instruction. Green `#00FF00`,
4×2 grids, RGB→RGBA normalization scratch-only.

### `wave` (LOOP, 8)

First attempt failed (left-facing + binary poses + half-split). Retry faced
right and waved, but still split halves and ended hand-down. Mechanical fix
(BL-7/BL-11 class): bake the body-consistent top half ping-ponged via
`ADULT_WAVE.frameOrder = [0, 1, 2, 3, 3, 2, 1, 0]` — turn points are
same-cell zero-diff.

### `flush` (ONE-SHOT, 8)

Accepted on first content attempt. Narrative beats in order: idle → water
hits → swept mid-frame → beaver out / splash residue → wet return → wet-dog
shake → drying → dry idle-like settle. Stylized pixel water (cool blue), no
toilet bowl prop, no photoreal water.

## Visual gate — PASS

### wave
- Right-facing, on-model adult beaver; body/tail/head stable across the loop.
- Raised paw waves; ~2 half-cycles via ping-pong.
- Wraparound 8→1 is zero-diff by construction.
- No transparency holes / no surviving green.

### flush
- Gag reads clearly at 8fps: sweep-out, empty beat, wet return, shake, dry.
- Phone-less; water stays stylized pixel splash.
- Last frame settles to a dry neutral stance suitable for idle handoff.
- Large inter-frame deltas are intentional (full-body gag), not redraw jitter
  of a supposed idle loop.
- No surviving green; contact sheet clean.

## Geometry

Both rows fit the default 96px tile at `targetContentHeightPx: 96`
(scale ≈ 0.25). Sheet grows 768×1504 → 768×1600 (`wave`) → 768×1696 (`flush`).

## Evidence

- `docs/design-reviews/BL-10-wave-contact.png` / `BL-10-wave-wraparound.png` /
  `BL-10-wave.gif`
- `docs/design-reviews/BL-10-flush-contact.png` / `BL-10-flush-wraparound.png` /
  `BL-10-flush.gif`

## Windows gate

No renderer/window/tray/HiDPI code changed; existing adult row convention.
