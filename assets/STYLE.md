# Beaver Buddy — sprite style guide

Binding for every sprite in this repo, with one exception: BL-11 replaced the
beaver stages with the user's own generated art (see Provenance below), and
by owner decision the palette/outline rules below no longer apply to those
sheets — colors and edges ship exactly as the source art provides them. The
lodge sheet is untouched and stays fully palette/outline-bound.

## Palette (≤16 colors, warm-toned) — lodge only

Defined once in `scripts/gen-sprites/palette.ts`; the lodge's pixel map
references colors by the one-char key. `.` is transparent and never a
palette entry. Beaver sheets (`beaver-{baby,teen}.png`) are RGBA truecolor,
not indexed — this table does not constrain them.

| Key | Hex       | Name                    | Used for |
|-----|-----------|-------------------------|----------|
| `k` | `#2b1714` | dark chocolate outline  | 1px outlines |
| `1` | `#572920` | deepest fur shadow      | lodge wood shadow |
| `2` | `#7a3b27` | dark warm-brown fur     | lodge wood fill |
| `3` | `#a6542e` | warm-brown fur midtone  | lodge wood highlight |
| `4` | `#ca7036` | golden-brown fur        | (beaver-only, unused by lodge) |
| `5` | `#e99545` | honey fur highlight     | (beaver-only, unused by lodge) |
| `b` | `#d19a62` | tan belly shadow        | (beaver-only, unused by lodge) |
| `c` | `#f0c785` | cream belly and muzzle  | (beaver-only, unused by lodge) |
| `w` | `#fff4dc` | teeth and eye shine     | (beaver-only, unused by lodge) |
| `e` | `#d97b73` | pink inner ear          | (beaver-only, unused by lodge) |
| `t` | `#45251f` | dark paddle tail        | lodge entrance arch |
| `T` | `#714035` | tail texture highlight  | (beaver-only, unused by lodge) |
| `B` | `#0b6896` | pacifier dark blue      | spark cores (darkest) |
| `C` | `#20a9d8` | pacifier blue           | spark mid |
| `D` | `#7adcf5` | pacifier shine          | spark tips (palest) |
| `q` | `#120d0d` | black eye and nose      | (beaver-only, unused by lodge) |

The "beaver-only" rows are dead weight now that the beaver stages no longer
use this table — kept rather than renumbered so `palette.ts`'s existing char
keys (and the lodge pixel map that references some of them) don't churn.

## Grid & tiles

- **Beaver stages** (`beaver-{baby,teen}.png`): 96×96 transparent RGBA
  tiles, ingested from the user's own images at their native chunky-pixel
  resolution (no 1-art-pixel-per-sheet-pixel rule — see Provenance).
  Renderer draws at `PET_SCALE = 1` (`src/renderer/pet-config.ts`): 96px
  native tile → 96px on screen, integer nearest-neighbor blit.
- **Lodge + particles** (`lodge.png`): unchanged, 48×48 indexed-palette
  tiles, one art pixel per sheet pixel, nearest-neighbor only. Renderer
  draws it at `LODGE_SCALE = 2` (48px → 96px on screen) so it matches the
  beaver's on-screen size despite the different native tile — `drawFrame`
  (`src/renderer/sprites.ts`) takes scale as an explicit per-call parameter
  for exactly this reason.
- Sheets: rows = animations in fixed order, columns = frames, transparent
  padding after short rows. Companion `<sheet>.json` records tile size, fps
  hint, row order/frame counts, and sheet dimensions.

## Character rules — lodge only

(Beaver stages: no enforced silhouette/color rules — see Provenance. The
ingest pipeline's own invariants — hard alpha, cropped bbox, one locked
scale per stage, bottom-aligned + centered placement — are what's checked,
in `scripts/gen-sprites/ingest-images.test.ts`.)

- Lodge: stick-dome silhouette in the warm fur-brown ramp (`1`/`2`/`3` double
  as wood), dark-paddle-tail (`t`) entrance-arch contrast, pacifier-blue
  (`B`/`C`/`D`) spark particles.

## Outline — lodge only

1px in `k` (dark chocolate), auto-derived: every lodge silhouette pixel that
touches transparency becomes outline. Spark particles carry no outline (they
read as light, not matter). Beaver stages: whatever edge the source art
ships with (hard alpha at the background cutout, no re-outlining).

## Facing & mirroring

All frames are authored/ingested RIGHT-facing. The renderer mirrors
horizontally for left-facing movement. The user's left-facing images —
`baby-idle-left.png`/`baby-to-left-*.png` and `teen-to-right-1-{1,3,5}.png`
(despite their names, left-facing mirrors of `-1`/`-1-2`/`-1-4`) — exist in
`assets-src/beaver/` but are unused: mixing them into a sheet row would make
the sheet itself alternate facing per frame (a flip-flopping walk), so
left-facing movement comes only from renderer mirroring, never from
left-facing source frames.

## Sheet row order & timing

- **Beaver stages**: `idle(1), walk(N)` — no run/sleep/react (BL-11 slimmed
  the animation set to match `roam.ts`'s idle/walk-only state machine).
  `beaver-baby.png`: walk×2. `beaver-teen.png`: walk×3. fps hint: 8.
- **Lodge** (`lodge.png`): `idle(1), shake(3), burst(3), spark(4)`; spark
  frames are 8×8 particles centered in the 48×48 tile (rows/cols 20–27, also
  noted in `lodge.json`). fps hint: 10 (unchanged; the renderer's shared
  `SPRITE_FPS` constant is 8 — see `src/renderer/pet-config.ts` for why that
  mismatch is cosmetic, not a bug).
- Adult stage has no art yet: `sprites.ts#loadSheet` falls back to the teen
  sheet until it does.

## Provenance

**Beaver stages** (`beaver-baby.png`, `beaver-teen.png`): user-generated
images (external image-gen, owner-supplied), ingested via
`scripts/gen-sprites/ingest-images.mjs` — background removal (flood-fill
transparency from the borders over near-white/near-black/already-transparent
pixels, then a hard alpha threshold), crop to content bbox, premultiplied-
alpha area-average downscale to a scale factor locked per stage, composited
onto a 96×96 tile bottom-aligned and horizontally centered. Colors ship as
generated — the 16-color palette rule above is waived for these sheets by
owner decision, 2026-07-14. Source images live in the gitignored
`assets-src/beaver/` (not committed — no raw image-gen intermediates in the
repo, same rule as everywhere else); only the ingested sheets are committed.
Right-facing frames only — the user's left-facing images are unused (see
Facing & mirroring above). No adult-stage art exists yet.

**Lodge** (`lodge.png`): pixel maps authored by OpenAI Codex (vision-guided
from a user-supplied reference image), iterated through visual design-review
gates, 2026-07-14; converted via `scripts/gen-sprites/import-codex.mjs` (BL-10;
this script and the beaver pixel maps it produced were removed in BL-11 once
the beaver stages moved to imported art — the lodge's own already-generated
`pixel-maps/lodge.ts` needed no regeneration, so the conversion script became
dead weight) from Codex's fenced text-grid output into this repo's
`pixel-maps/*.ts` string-grid format. Rendered from the committed pixel map
to an indexed PNG by `scripts/gen-sprites/build.ts` (hand-rolled PNG encoder,
node:zlib — no image dependencies). Regenerate with `npm run assets:build`;
output is byte-deterministic.
