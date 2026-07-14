# Beaver Buddy — sprite style guide

Binding for every sprite in this repo. Off-palette colors, mixed pixel
densities, or broken outline rules fail the design gate (PRD R10).

## Palette (≤16 colors, warm-toned)

Defined once in `scripts/gen-sprites/palette.ts`; pixel maps reference colors
by the one-char key. `.` is transparent and never a palette entry.

| Key | Hex       | Name                    | Used for |
|-----|-----------|-------------------------|----------|
| `k` | `#2b1714` | dark chocolate outline  | 1px outlines, eye pupils |
| `1` | `#572920` | deepest fur shadow      | dark fur flecks, lodge wood shadow |
| `2` | `#7a3b27` | dark warm-brown fur     | main fur, lodge wood fill |
| `3` | `#a6542e` | warm-brown fur midtone  | fur shading, lodge wood highlight |
| `4` | `#ca7036` | golden-brown fur        | body highlight band |
| `5` | `#e99545` | honey fur highlight     | top-of-head shine |
| `b` | `#d19a62` | tan belly shadow        | belly/muzzle shading |
| `c` | `#f0c785` | cream belly and muzzle  | belly, muzzle fill |
| `w` | `#fff4dc` | teeth and eye shine     | buck teeth, eye highlight |
| `e` | `#d97b73` | pink inner ear          | ear interior |
| `t` | `#45251f` | dark paddle tail        | tail fill, lodge entrance arch |
| `T` | `#714035` | tail texture highlight  | tail scute lines |
| `B` | `#0b6896` | pacifier dark blue      | pacifier, spark cores (darkest) |
| `C` | `#20a9d8` | pacifier blue           | pacifier, spark mid |
| `D` | `#7adcf5` | pacifier shine          | pacifier highlight, spark tips (palest) |
| `q` | `#120d0d` | black eye and nose      | pupil, nose |

16 of 16 colors used; extend only when a new asset genuinely needs a tone,
never pre-allocate.

## Grid & tiles

- One pixel density everywhere: 1 art pixel = 1 sheet pixel, nearest-neighbor
  scaling only, never anti-alias, never sub-pixel.
- Beaver stages: 48×48 transparent tiles. Lodge + particles: 48×48 tiles.
- Sheets: rows = animations in fixed order, columns = frames, transparent
  padding after short rows. Companion `<sheet>.json` records tile size, fps
  hint, row order/frame counts, and sheet dimensions.
- Renderer draws at `PET_SCALE` (2x, see `src/renderer/pet-config.ts`) —
  every sprite lands on screen at 96×96px, integer nearest-neighbor blit.

## Character rules (all stages)

- One smooth round mass for body+head; convex back line, no notches/humps.
- Single round ear with a pink (`e`) interior; blunt muzzle patch (`c`/`b`).
- Two-tooth off-white (`w`) block directly under the muzzle.
- Flat horizontal paddle tail low near the ground, dark (`t`) with lighter
  texture lines (`T`) — it must read FLAT in every frame, never a ball
  (enforced by a vitest guard on the tail's own chars).
- Black (`q`) eye with an off-white (`w`) shine, high on the head.
- Cyan-blue pacifier (`B`/`C`/`D`) as a shared accent across stages.
- Stages scale up together within the fixed 48px tile — teen/adult read
  visibly larger and heavier (broader shoulders, bigger tail) than baby, but
  all share the same silhouette rules above.

## Outline

1px in `k` (dark chocolate), auto-derived: every silhouette pixel that
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

Pixel maps authored by OpenAI Codex (vision-guided from a user-supplied
reference image), iterated through visual design-review gates, 2026-07-14;
converted via `scripts/gen-sprites/import-codex.mjs` from Codex's fenced
text-grid output into this repo's `pixel-maps/*.ts` string-grid format. The
lodge/spark sheet was carried over from the prior (cool-palette) generation
and mechanically recolored — same structure and frames, palette chars
remapped to the new warm ramp (see `pixel-maps/lodge.ts` header for the
exact remap).

Sheets are rendered from the committed pixel maps to indexed PNGs by
`scripts/gen-sprites/` (hand-rolled PNG encoder, node:zlib — no image
dependencies). Regenerate with `npm run assets:build`; output is
byte-deterministic. No raw image-gen intermediates exist in this repo; the
pixel maps are the source of truth.
