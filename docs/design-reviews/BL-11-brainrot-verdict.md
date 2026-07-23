# BL-11 design-gate verdict — adult `brainrot` row

Date: 2026-07-23
Verdict: **PASS**

## Scope

WAVE-1-only row: `brainrot` (8 frames, LOOP) appended after `exercise` on
`beaver-adult`. No runtime wiring.

## Generation

The reference-upload path was environment-blocked (same session constraint as
BL-8/BL-9). Comfy Cloud `partner_generate` (`vertexai/nano-banana-pro`) used
the public committed adult sheet as its reference. A first content result was
rejected (wrong grid / whole-body redraw between halves). The accepted source
grid keeps the beaver on-model with a subtle thumb-scroll, but the model drew
the 4×2 grid as two slightly different halves, so the raw cell sequence is not
itself a clean loop.

**Mechanical loop fix (same class as BL-7's mouth-patch escape hatch):** the
bottom row of the accepted grid (cells 4–7) is the body-consistent half.
`ADULT_BRAINROT.frameOrder = [4, 5, 6, 7, 7, 6, 5, 4]` ping-pongs that half so
the baked row is an 8-frame LOOP whose two former failure transitions
(4→5 and 8→1) are the same cell twice — measured zero pixel delta. RGB→RGBA
normalization was scratch-only; green `#00FF00` chroma-key, 4×2 grid, no
tokens or base64 in committed output.

## Visual gate — PASS

- Character: matches adult fur, muzzle, teeth, ears, outline, and cross-hatched
  tail; right-facing throughout.
- Action: standing / slight slouch, half-lidded glazed stare at a small phone
  held in both paws at chest height; thumb position advances and returns
  across the ping-pong (~one scroll cycle out and back).
- Prop: phone fully in-frame, small, plain dark rectangle with faint glow; no
  logo, text, or readable UI.
- Coherence: body, tail, head, feet, and phone size/position stay fixed across
  all eight baked frames. Within-half transitions change ~6–7% of tile pixels
  (thumb / glow); the two turn points are 0% by construction.
- Wraparound: frame 8→1 is cell4→cell4 (zero-diff). Contact sheet includes the
  repeated frame 1 after frame 8 for direct seam review.
- Cutout: magenta contact sheet shows no transparency holes; no surviving
  green-dominant pixels in baked frames.

## Geometry

Widest raw crop binds height at `targetContentHeightPx: 96`. Content fits the
default 96px row (sheet grows 768×1408 → 768×1504). No taller-row override.

## Evidence

- `docs/design-reviews/BL-11-brainrot-contact.png` — eight frames + repeated
  frame 1 at 4× nearest-neighbor on magenta/dark checker.
- `docs/design-reviews/BL-11-brainrot-wraparound.png` — frame 1 beside frame 8.
- `docs/design-reviews/BL-11-brainrot.gif` — 8fps checkerboard playback.

## Automated checks

Vitest pins row geometry, non-empty/grounded frames, chroma-key removal, and
byte-identical regeneration from the source grid + `frameOrder`. Temporal
pose coherence is this visual gate.

## Windows gate

No renderer, window, tray, interaction, or HiDPI code changed. Existing adult
row convention; no separate Windows capture required.
