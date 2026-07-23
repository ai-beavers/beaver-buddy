# BL-1 to BL-5 retro animation design-gate verdict

Date: 2026-07-23  
Verdict: **PASS**

## Scope and method

This is evidence catch-up for already-committed WAVE-1 art. No sprite was
regenerated or edited. Each contact sheet was extracted from the committed
PNG and JSON manifest, composited on a magenta/dark-gray checkerboard, and
scaled 4x with nearest-neighbor sampling.

Loop evidence shows every authored frame in order followed by frame 1 again,
so the wraparound seam is adjacent and directly reviewable. The `stretch`
one-shot instead includes the committed sleep row's frame 8 before its eight
authored frames and the committed idle frame after them, exposing both
transition boundaries.

## BL-1 — tree sway and adult `watering`

Verdict: **PASS**

- `tree-stage-1`, `tree-stage-2`, and `tree-stage-3` each contain a 12-frame
  `sway` LOOP. All three stay grounded, preserve their silhouette and foliage,
  and move through a small side-to-side arc without clipping. The repeated
  frame 1 matches the start of each strip, so the loop seam is clean.
- Adult `watering` is an 8-frame LOOP. The beaver, watering can, tail, and
  ground line remain coherent; the water droplets advance and clear without
  transparency holes. Frame 8 returns cleanly to the repeated frame 1.

Evidence:

- `docs/design-reviews/BL-1-tree-stage-1-sway-contact.png`
- `docs/design-reviews/BL-1-tree-stage-2-sway-contact.png`
- `docs/design-reviews/BL-1-tree-stage-3-sway-contact.png`
- `docs/design-reviews/BL-1-watering-contact.png`

## BL-3 — adult `drink`

Verdict: **PASS**

Adult `drink` is an 8-frame LOOP: mug lift, sip, and lower. The same beaver and
mug read across the row, steam remains pale and opaque against the contrasting
background, and no frame clips. The repeated frame 1 makes the frame 8 to
frame 1 reset explicit and visually clean.

Evidence:

- `docs/design-reviews/BL-3-drink-contact.png`

## BL-4 — adult `sleep`

Verdict: **PASS**

Adult `sleep` is an 8-frame curled-up breathing LOOP, not a settle transition.
The body and tail stay coherent while the pale-blue `zzz` marks grow and
recede. Frame 8 and the repeated frame 1 form a continuous low-particle seam,
with no cutout holes or clipping.

Evidence:

- `docs/design-reviews/BL-4-sleep-contact.png`

## BL-5 — adult `stretch`

Verdict: **PASS**

Adult `stretch` is an 8-frame ONE-SHOT wake-up transition, not a loop. In the
contact sheet, panel 1 is the committed sleep frame 8, panels 2–9 are
`stretch` frames 1–8, and panel 10 is the committed idle frame. The start
continues from the curled sleep pose; the sequence rises through sitting,
standing, and the overhead stretch; the end settles into the same neutral
stance and scale as idle. No frame clips or exposes transparency defects.

Evidence:

- `docs/design-reviews/BL-5-stretch-contact.png`

## Asset-byte guard

At extraction time, both this branch and
`origin/build-loop/m5-animations` pointed at `c6540c5`.
`git diff --quiet origin/build-loop/m5-animations -- assets/sprites` exited
zero. Every committed file under `assets/sprites/` was byte-identical to that
integration base; this item changes documentation/evidence only.

## Verification

- `npm ci` — clean install (431 packages).
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test` — PASS (54 files; 618 passed, 34 skipped).

No renderer, runtime trigger, platform behavior, or WAVE-2 wiring changed, so
no separate Windows overlay capture is required.
