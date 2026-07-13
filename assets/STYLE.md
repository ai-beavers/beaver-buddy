# Beaver Buddy — sprite style guide

Binding for every sprite in this repo. Off-palette colors, mixed pixel
densities, or broken outline rules fail the design gate (PRD R10).

## Palette (≤16 colors, cool-toned — no pure black, no warm saturated hues)

Defined once in `scripts/gen-sprites/palette.ts`; pixel maps reference colors
by the one-char key. `.` is transparent and never a palette entry.

| Key | Hex       | Name                | Used for |
|-----|-----------|---------------------|----------|
| `k` | `#2c3138` | cool slate (darkest)| 1px outlines, eye pupils, closed-eye lines |
| `1` | `#5c4f47` | fur shadow          | dark fur flecks, feet, dark wood sticks |
| `2` | `#7c6b5e` | fur mid             | main fur, lodge wood fill |
| `3` | `#a08d7a` | fur highlight       | top-of-head/back highlight, muzzle, light sticks |
| `5` | `#8fada9` | teal-gray           | belly patch, spark fade dots |
| `6` | `#333c46` | dark slate          | tail fill, lodge entrance |
| `7` | `#4b5866` | light slate         | tail scute-texture lines |
| `8` | `#eef2ee` | cool off-white      | buck teeth |
| `9` | `#4fb8b0` | cyan/teal accent    | eye shine, sparks |
| `0` | `#cfe0dd` | pale teal-gray      | spark cores |

The fur ramp (`1`/`2`/`3`) doubles as the lodge wood ramp — cool desaturated
taupe reads as both. 10 colors used of the 16 allowed; extend only when a new
asset genuinely needs a tone, never pre-allocate.

## Grid & tiles

- One pixel density everywhere: 1 art pixel = 1 sheet pixel, nearest-neighbor
  scaling only, never anti-alias, never sub-pixel.
- Beaver stages: 32×32 transparent tiles. Lodge + particles: 48×48 tiles.
- Sheets: rows = animations in fixed order, columns = frames, transparent
  padding after short rows. Companion `<sheet>.json` records tile size, fps
  hint, row order/frame counts, and sheet dimensions.

## Sizes per stage (visual height inside the 32px tile)

- Baby: ~16px (round chibi mass ~16×14 + stub feet).
- Teen: ~22px — chest/shoulders visibly broader than hips, tail 12px.
- Adult: ~28px — barrel chest (widest ~19px), tail 13×5, 4px feet, heavier
  dark flank shading.

## Character rules (all stages)

- One smooth round mass for body+head; convex back line, no notches/humps.
- Single small round ear bump; blunt 2–3px muzzle — never pointy.
- 2×2 off-white buck-teeth block directly under the muzzle, slate-rimmed.
- Flat horizontal paddle tail low near the ground, dark slate with lighter
  scute lines — it must read FLAT in every frame, never a ball (enforced by
  a vitest guard).
- 2px eye: slate pupil + 1px cyan shine, high on the head.
- Stubby feet only, no stick legs.

## Outline

1px in `k` (darkest cool slate), auto-derived: every silhouette pixel that
touches transparency becomes outline. No hand-drawn outline passes, no
anti-aliasing, no double outlines. One exception: the 8×8 spark particles
carry no outline — they read as light, not matter.

## Facing & mirroring

All frames are authored RIGHT-facing. The renderer mirrors horizontally for
left-facing movement. Never author left-facing frames.

## Sheet row order & timing

- Beaver stages (`beaver-{baby,teen,adult}.png`): `idle(2), walk(4), run(4),
  sleep(2), react(4)` — binding for the BL-4 renderer.
- Lodge (`lodge.png`): `idle(1), shake(3), burst(3), spark(4)`; spark frames
  are 8×8 particles centered in the 48×48 tile (rows/cols 20–27, also noted
  in `lodge.json`).
- fps hint: 10 (sprite-frame cadence; independent of render Hz).

## Provenance

Programmatic pixel art: frames are authored as string pixel-maps in
`scripts/gen-sprites/pixel-maps/` and rendered to indexed PNGs by
`scripts/gen-sprites/` (hand-rolled PNG encoder, node:zlib — no image
dependencies). Regenerate with `npm run assets:build`; output is
byte-deterministic. Design was human-directed through the BL-3 design-review
gates (contact sheets + verdicts in `docs/design-reviews/`), 2026-07-14.
No image-gen intermediates exist; the pixel maps are the source of truth.
