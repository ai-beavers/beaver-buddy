# BL-14 design-gate verdict — adult `toilet` row (full toilet routine)

Date: 2026-07-23
Verdict: **PASS**

## Scope

WAVE-1-only row for M5/P9, per owner decision 2026-07-23: the FULL toilet
routine the short `flush` gag only hinted at. No runtime wiring. Sheet width
stays 8 tiles (768px), so the routine is compressed into 8 frames.

Owner narrative (accepted sequence): beaver sits on a stylized toilet bowl +
tank → does its business → flushes (water swirl) → a tile-scale water wave
sweeps the toilet AND beaver away to the side it faces → small swept-away
silhouette. The shipped `flush` gag (no toilet prop) and this `toilet` routine
both ship — `flush` is the quick bit, `toilet` the full routine.

**Deferred to WAVE-2 (owner decision):** the "huge, full-screen wall of water"
version of the sweep — a canvas effect spanning the whole overlay, not a tile.
This row ships the tile-scale sweep only.

## Generation

Same environment constraint as BL-8/BL-9/BL-10/BL-11: `upload_file` blocked;
`partner_generate` (`vertexai/nano-banana-pro`) with the public committed adult
sheet raw URL and copy-the-idle-tile instruction. Green `#00FF00`, 4×2 grid,
RGB→RGBA normalization scratch-only. Regenerated once: a first take dropped the
beaver on the closing sweep frames (frames 6–7 missing the beaver). The retry
kept the beaver clearly visible in every frame; accepted take ingested
unmodified (natural grid order, no `frameOrder`).

## Visual gate — PASS

- Routine reads clearly at 8fps: sit → business → flush swirl → wave sweep →
  swept away.
- Beaver clearly visible in all 8 frames (the explicit owner acceptance bar).
- Toilet bowl + tank read as a consistent prop; no independent-cell whole-body
  redraw flicker beyond the intended full-body motion.
- Tile-scale wave crests above the beaver and sweeps toilet + beaver aside;
  cool stylized pixel water, no photoreal water.
- No transparency holes; no surviving green (verified programmatically — 0
  green-dominant pixels across all 8 frames).
- Large inter-frame deltas are intentional (full-body ONE-SHOT), not redraw
  jitter of a supposed idle loop.

## Geometry

`rowHeight: 128` (parachute-wind/exercise precedent), `targetContentHeightPx:
112`. Tallest raw content is the toilet-tank + seated beaver (~292×381) and the
cresting sweep wave (~344×355), both taller than a bare standing beaver — the
taller tile keeps the beaver at a readable size while the tank/wave extend
upward past the base tile (bottom-anchored to the shared ground line). The
WIDTH term binds at scale 0.2791 (max content 96px wide — fills the tile, no
horizontal clip; max content 106px tall, inside the 128px tile). Sheet grows
768×1696 → 768×1824.

## Evidence

- `docs/design-reviews/BL-14-toilet-contact.png` (magenta/dark-checker contact
  sheet, all 8 frames, 4× nearest-neighbor)
- `docs/design-reviews/BL-14-toilet.gif` (8fps loop on the same checker)

## Windows gate

No renderer/window/tray/HiDPI code changed; existing adult row convention
(sheet-only asset append). Windows visual gate not applicable to this WAVE-1
asset item.
