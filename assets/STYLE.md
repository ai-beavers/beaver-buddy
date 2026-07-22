# Beaver Buddy — sprite style guide

Binding for every sprite in this repo, with one exception: BL-11 replaced the
beaver stages with the user's own generated art (see Provenance below), and
by owner decision the palette/outline rules below no longer apply to those
sheets — colors and edges ship exactly as the source art provides them. The
lodge sheet is untouched and stays fully palette/outline-bound.

## Palette (≤16 colors, warm-toned) — lodge only

Defined once in `scripts/gen-sprites/palette.ts`; the lodge's pixel map
references colors by the one-char key. `.` is transparent and never a
palette entry. Beaver sheets (`beaver-{baby,teen,adult}.png`) are RGBA
truecolor, not indexed — this table does not constrain them.

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

- **Beaver stages** (`beaver-{baby,teen,adult}.png`): 96×96 transparent RGBA
  tiles, all three stages ingested from generated art at their native
  chunky-pixel resolution (no 1-art-pixel-per-sheet-pixel rule — see
  Provenance).
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
horizontally for left-facing movement. The user's left-facing images
(`{stage}-idle-left.png`, `{stage}-to-left-{1,2}.png`) exist in
`assets-src/beaver/` but are unused: mixing them into a sheet row would make
the sheet itself alternate facing per frame (a flip-flopping walk), so
left-facing movement comes only from renderer mirroring, never from
left-facing source frames.

Source naming (owner-corrected, 2026-07-14, BL-12): `{stage}-idle-{dir}.png`
is the idle pose; `{stage}-to-{dir}-{1,2}.png` are the two walk step frames.
Earlier drops used ambiguous names that put an idle pose in the walk row —
twice (BL-11's `teen-to-right-1` as walk frame, then its `-1-4` replacement).

## Sheet row order & timing

- **Beaver stages**: `idle(1), walk(N)` for teen; baby/adult additionally
  carry `struggle(8), parachute-wind(8), land(8)` for the parachute-drop
  sequence (BL-17/BL-18). Adult also carries `type(8)` — the "sit and type on a
  laptop" loop for `roam.ts`'s `working` state — `watering(8)`/`drink(8)`/
  `sleep(8)` loops, and `stretch(8)` — a ONE-SHOT wake-up transition (not a
  loop), matching `land`. `beaver-baby.png`/`beaver-teen.png`/`beaver-adult.png`:
  walk×2. fps hint: 8. The idle pose never appears in a walk row — walk cycles
  are step frames only.
- **Lodge** (`lodge.png`): `idle(1), shake(3), burst(3), spark(4)`; spark
  frames are 8×8 particles centered in the 48×48 tile (rows/cols 20–27, also
  noted in `lodge.json`). fps hint: 10 (unchanged; the renderer's shared
  `SPRITE_FPS` constant is 8 — see `src/renderer/pet-config.ts` for why that
  mismatch is cosmetic, not a bug).
- Adult stage art: `idle`/`walk` are final generated art (BL-6/T3,
  reference-conditioned on the adult sheet's own already-shipped rows — see
  Provenance), replacing the earlier placeholder derived from the committed
  teen sheet (`scripts/gen-sprites/build-adult-placeholder.ts`, `npm run
  assets:adult-placeholder`; a first BL-18 attempt at golden generated art
  was rejected by the owner as generic/off-model and reverted to that
  placeholder before BL-6/T3 replaced it for good). `struggle`/
  `parachute-wind`/`land` are appended via
  `scripts/gen-sprites/ingest-animation-frames.mjs adult` (`npm run
  assets:adult-anims`) and remain reference-matched to the former
  teen-upscale placeholder's look, not the rejected golden art — the BL-6/T3
  final art was itself generated to preserve that same look, so these rows
  stay visually consistent with idle/walk. `type(8)` is appended on top
  by `scripts/gen-sprites/ingest-typing.mjs` (`npm run assets:typing`) — it
  preserves every earlier row byte-for-byte and adds a 96px `type` row at the
  bottom (sheet grows to 768×608). Its source is a green chroma-key Comfy run
  (prompt_id `b99d59bf`); see Provenance. `watering(8)` is appended on top of
  that by `scripts/gen-sprites/ingest-animation-frames.mjs adult-watering`
  (`npm run assets:adult-watering`, BL-1/T2) the same byte-preserving way,
  growing the sheet to 768×704; see Provenance. `drink(8)` is appended on top
  of that by `scripts/gen-sprites/ingest-animation-frames.mjs adult-drink`
  (`npm run assets:adult-drink`, BL-3) via the same config-driven
  `buildAdultRowSheet` helper watering now shares, growing the sheet to
  768×800; see Provenance. `sleep(8)` — a curled-up idle LOOP, no
  settle/lie-down transition frame — is appended on top of that by
  `scripts/gen-sprites/ingest-animation-frames.mjs adult-sleep` (`npm run
  assets:adult-sleep`, BL-4) via the same `buildAdultRowSheet` helper,
  growing the sheet to 768×896; see Provenance. `stretch(8)` — a ONE-SHOT
  wake-up/stretch transition, not a loop — is appended on top of that by
  `scripts/gen-sprites/ingest-animation-frames.mjs adult-stretch` (`npm run
  assets:adult-stretch`, BL-5) via the same `buildAdultRowSheet` helper,
  growing the sheet to 768×992; see Provenance.
- **Tree growth stages** (`tree-stage-1.png`/`tree-stage-2.png`/`tree-stage-3.png`,
  BL-1/T1): one row each, `sway(12)`, baked at fps 8 by the puppet studio
  (`tools/puppet-studio/`) — 96×96 tile, sheet 1152×96. Not a multi-row sheet
  like the beaver stages: each growth stage is its own file (mirrors the
  beaver-baby/teen/adult per-stage-sheet precedent), swapped whole rather than
  animated between. See Provenance.

## Provenance

**Beaver stages** (`beaver-baby.png`, `beaver-teen.png`, `beaver-adult.png`):
`idle`/`walk` rows for baby and teen are generated images (external
image-gen, owner-supplied) ingested via `scripts/gen-sprites/ingest-images.mjs`
— background removal (flood-fill transparency from the borders over
near-white/near-black/already-transparent pixels, then a hard alpha
threshold), crop to content bbox, premultiplied-alpha area-average downscale
to a scale factor locked per stage, composited onto a 96×96 tile
bottom-aligned and horizontally centered. Colors ship as generated — the
16-color palette rule above is waived for these sheets by owner decision,
2026-07-14. Source images live in the gitignored `assets-src/beaver/` (not
committed — no raw image-gen intermediates in the repo, same rule as
everywhere else); only the ingested sheets are committed. Right-facing
frames only — the user's left-facing images are unused (see Facing &
mirroring above).

**`beaver-young-baby.png`/`beaver-older-teen.png`** (BL-6/T1-T2, 2026-07-22):
two new in-between growth-stage sheets, not yet wired into `Stage`/
`stageForLevel` (WAVE-2) — an unwired sheet is inert, so committing them is
safe ahead of that wiring. Both are full-frame Comfy Cloud generations via
`partner_generate` (`vertexai/nano-banana-2`), DUAL reference-conditioned by
passing the two neighboring stages' already-committed idle tiles as base64
data-URI images so the result reads BETWEEN them rather than as a new
character: `beaver-young-baby` conditions on the committed baby + teen idle
tiles (`targetContentHeightPx: 76` — interpolated between baby's and teen's
own locked scales, cheap to re-ingest at another value); `beaver-older-teen`
conditions on the committed teen + adult idle tiles (`targetContentHeightPx:
94` — interpolated the same way). Both ship `idle(1)`/`walk(2)` only (teen
precedent, app-complete minimum; interaction rows are a WAVE-2 follow-up
once stage wiring lands), on a 192×192 sheet like teen. Ingested via the
existing `scripts/gen-sprites/ingest-images.mjs` pipeline (new `STAGE_SPECS`
entries, unchanged mechanics) — `npm run assets:young-baby` / `npm run
assets:older-teen`; the CLI now accepts an optional stage-name arg so
building one new figure doesn't require the other stages' gitignored source
frames to also exist locally. No human cleanup beyond the mechanical
pipeline.

`idle(1)`/`walk(2)` (BL-6/T3, 2026-07-22, FINAL ART): reference-conditioned
Comfy Cloud Nano Banana Pro (`GeminiImage2Node`) generations, replacing the
teen-upscale placeholder for good. A first BL-18 pass at golden idle/walk art
was rejected by the owner as generic and off-model and reverted to the
placeholder (`scripts/gen-sprites/build-adult-placeholder.ts`,
`npm run assets:adult-placeholder`); the root cause, per
`docs/dev-guardrails.md`, was insufficient reference conditioning. This pass
fixes that by conditioning on the SAME already-uploaded adult reference image
every other adult row (`struggle`/`parachute-wind`/`land`/`type`/`watering`/
`drink`/`sleep`/`stretch`) is already anchored to — the single most
consistency-preserving reference available, since those 8 rows are the
ones the owner has already accepted as on-model. Idle is a single standing
pose (1x1 "grid"); walk is a 2-frame side-view cycle (2x1 grid, contact +
passing poses) generated in one image with an explicit no-divider-line
instruction (the BL-4 sleep-row gotcha: a seam between grid cells can poison
`cropToBbox`). Both on a green (`#00FF00`) chroma-key background. Ingested by
`scripts/gen-sprites/ingest-animation-frames.mjs adult-idle` and
`adult-walk` via `buildAdultRowSheet`/`spliceRow` — same byte-preserving
replace-by-name pattern as watering/drink/sleep/stretch, at
`targetContentHeightPx: 96` (the committed idle tile's own measured
full-tile content height, edge-to-edge, no padding — same value
`ADULT_STRETCH` was measured against). Continuity gate (candidate idle/walk
vs. all 8 existing rows, and before/after vs. the placeholder) was checked as
post-ingest 96x96 side-by-side strips on a magenta backdrop, eyeballed
against the BL-18 failure mode (same character? same shading/palette? same
proportions?) — passed cleanly: consistent fur color, tail cross-hatch
texture, ear shape, tooth/eye-highlight details, and outline weight across
every row. No human cleanup beyond the mechanical pipeline.

**`assets:adult-placeholder` must NOT be re-run against the committed
`beaver-adult.png`**: `build-adult-placeholder.ts` derives idle/walk from the
teen sheet and writes a FRESH 2-row 192×192 sheet from scratch, not a
targeted idle/walk patch — a rerun destroys all 8 other committed rows
(`struggle`/`parachute-wind`/`land`/`type`/`watering`/`drink`/`sleep`/
`stretch`), not just idle/walk. `build-adult-placeholder.ts` itself stays in
the tree (its own retirement is a WAVE-2 item; other code may still
reference it as a generation utility), but running its CLI and committing
the result over the shipped adult sheet is a regression, not a refresh — the
script now refuses to run against a committed sheet that has rows beyond
idle/walk (see its own header comment), and an unconditional committed-sheet
byte-pin test (`ingest-animation-frames.test.ts`) catches an accidental
clobber commit too.

`struggle`/`parachute-wind`/`land` rows for baby and adult are appended
separately by `scripts/gen-sprites/ingest-animation-frames.mjs` from Comfy
Cloud run dumps (gitignored `assets-src/comfyui/<run>/`) — same mechanical
pipeline, one scale lock per animation row (see Sheet row order & timing
above). The adult anim rows (BL-18) are reference-matched to the previous
(darker, teen-upscale) adult: generated via Comfy Cloud Nano Banana Pro,
using the prior adult sprite as a reference image so the new poses stay one
consistent beaver with the restored idle/walk rows above.

`watering(8)` (BL-1/T2, 2026-07-22): a 4×2 grid (8 frames) of a watering-can
pour loop, generated via Comfy Cloud Nano Banana Pro (`GeminiImage2Node`),
reference-conditioned on the committed adult beaver sprite so it stays the
same character as the rows above it, on a green (`#00FF00`) chroma-key
background. Ingested by `scripts/gen-sprites/ingest-animation-frames.mjs
adult-watering` (`npm run assets:adult-watering`) — chroma-keys the green,
crops/scales each cell, and appends the row directly onto the already-shipped
`beaver-adult.png` (byte-preserving for every earlier row, same append
pattern as `type`) rather than rebuilding the whole stage from
`ADULT.animations`, since the `struggle`/`parachute-wind`/`land` rows' own
Comfy run dumps aren't guaranteed to exist locally and re-baking
non-deterministic generations would risk silently changing already-shipped
pixels. No human cleanup beyond the mechanical pipeline.

`drink(8)` (BL-3, 2026-07-22): a 4×2 grid (8 frames) of a coffee-mug drink
loop (lift the mug, sip with eyes closed, lower it, steam wisps), generated
via Comfy Cloud Nano Banana Pro (`GeminiImage2Node`), reference-conditioned
on the same already-uploaded adult reference image the BL-19 parachute-wind
generation used (no new upload — direct uploads are blocked in this
environment; reused the prior-uploaded reference by filename, per
`docs/dev-guardrails.md`), on a green (`#00FF00`) chroma-key background so
the pale steam wisps survive the key. Ingested by
`scripts/gen-sprites/ingest-animation-frames.mjs adult-drink` (`npm run
assets:adult-drink`) via `buildAdultRowSheet`, the config-driven
generalization of the watering builder above (`{rowName, sourceDir, frames,
gridCols, gridRows, targetContentHeightPx}` — watering and drink are now two
config entries sharing one function) — same byte-preserving append pattern,
growing the sheet to 768×800. No human cleanup beyond the mechanical
pipeline.

`sleep(8)` (BL-4, 2026-07-22): a 4×2 grid (8 frames) of a curled-up sleeping
LOOP (no settle/lie-down transition — matches every other looping row; a
one-shot fall-asleep transition can be added as its own row later), gentle
breathing rise/fall and pulsing pale-blue "zzz" wisps that grow through
frames 1→4 and shrink back down through frames 5→8 so the frame-8→frame-1
seam reads as a continuous pulse restarting, not a jump. Generated via Comfy
Cloud Nano Banana Pro (`GeminiImage2Node`), reference-conditioned on the same
already-uploaded adult reference image the drink/watering/parachute-wind
generations used (reused by filename, no new upload — direct uploads are
blocked in this environment, per `docs/dev-guardrails.md`), on a green
(`#00FF00`) chroma-key background. The first generation attempt drew thin
black divider lines between grid cells that touched every cell's edge and
poisoned `cropToBbox` (pinning every frame's crop to the full cell); a second
attempt without divider lines came back oriented as 2 columns × 4 rows
instead of the requested 4×2; the prompt was tightened to explicitly forbid
divider lines AND pin the 4-column/2-row landscape layout, which produced
the shipped grid. Ingested by `scripts/gen-sprites/ingest-animation-frames.mjs
adult-sleep` (`npm run assets:adult-sleep`) via `buildAdultRowSheet` — same
byte-preserving append pattern as watering/drink — growing the sheet to
768×896. No human cleanup beyond the mechanical pipeline.

**BL-5 handoff reference** (`assets-src/reference/adult-sleep-pose.png`,
BL-4): a committed, post-ingest 96×96 copy of the sleep row's frame index 7
(frame 8 of 8 — the pose with the fewest/faintest zzz wisps, so BL-5's
wake-up/stretch generation conditions on the sleeping beaver's pose, not on
transient particle art), verified pixel-identical to that frame in the
committed sheet by a dedicated test (`ingest-animation-frames.test.ts`).

`stretch(8)` (BL-5, 2026-07-22): a 4×2 grid (8 frames) of a ONE-SHOT wake-up
sequence — matching `land`, not a loop, since waking up is a transition by
nature: curled-up sleep (frame 1, continuous with the committed sleep pose)
→ eyes opening → sitting up rubbing an eye → standing up → both arms thrown
straight up overhead in a big stretch with a wide yawn → arms lowered back
down to a calm neutral standing pose (frame 8, continuous with the idle
stance). Generated via Comfy Cloud Nano Banana 2 (`GeminiNanoBanana2`,
`vertexai/nano-banana-2` family — a distinct node from the `GeminiImage2Node`
used elsewhere in this doc), DUAL reference-conditioned (BL-5's own new
requirement, not a single reference like watering/drink/sleep): the committed
adult idle tile AND the committed
`assets-src/reference/adult-sleep-pose.png` sleep-pose tile, batched into one
`images` input via a `Batch Images` node so the model sees both the character
design and the exact pose to wake from, on a green (`#00FF00`) chroma-key
background. **Scale-trap check** (BL-19 parachute-wind precedent considered but not
needed here): the row's tallest raw cropped content turned out to be the
standing frames' own tail-to-ear span (~762px pre-scale at generation
resolution), shared evenly by the arms-up AND arms-down standing frames — the
raised arms never reach above ear height in this generation, so there's no
single taller arms-up silhouette forcing a smaller shared scale. Measured
empirically before promoting: at
`targetContentHeightPx: 96` (default 96px `rowHeight`, no override), the
standing frames land at exactly the committed idle tile's own content height
(96px, full-tile edge-to-edge — the idle sprite has zero vertical padding),
and frame 1's scaled size (86×68) closely matches the committed sleep-pose
reference tile (82×67). Ingested by
`scripts/gen-sprites/ingest-animation-frames.mjs adult-stretch` (`npm run
assets:adult-stretch`) via `buildAdultRowSheet` — same byte-preserving append
pattern as watering/drink/sleep — growing the sheet to 768×992. Continuity
gates (frame 1 vs. the committed sleep-pose tile, frame 8 vs. the committed
idle tile) were checked as post-ingest 96×96 side-by-side diffs on a magenta
backdrop, eyeballed rather than pixel-diffed (frame 1 is newly generated art
conditioned on the sleep pose, not a byte copy of it) — both read as a clean
continuous match. No human cleanup beyond the mechanical pipeline.

**Tree growth stages** (`tree-stage-1.png`, `tree-stage-2.png`,
`tree-stage-3.png`; BL-1/T1, 2026-07-22): generated as one lineage, not three
independent prompts, via Comfy Cloud Nano Banana Pro (`vertexai/nano-banana-pro`
partner model) — stage 3 (the fully-grown tree) generated first from a text
prompt describing a warm-toned pixel-art tree (no image reference: an image
reference risked bleeding an unrelated shape into a brand-new asset type, so
the palette was described in the prompt text instead), then stage 2
generated by conditioning on stage 3's own output image ("same tree,
younger/smaller"), then stage 1 conditioned on stage 2's — so all three read
as the same tree growing rather than three unrelated trees. Source renders
use a solid white background, not green: a tree's own foliage is green, so a
green chroma key would eat leaf detail the same way a white key eats white
sprite detail elsewhere (see `docs/dev-guardrails.md`). Ingested via
`tools/puppet-studio/ingest-parts.mjs <runDir> tree` into
`assets-src/parts/tree/tree-stage-{1,2,3}.png` — this required two small
pipeline additions: the script's part-spec table is now keyed per rig (it
was hardcoded to the beaver-baby part set) with a `tree` entry added, and it
now runs the existing `removeBackground` white-key pass (shared with the
full-frame beaver pipeline) before cropping, since these part images (unlike
the BiRefNet-processed beaver-baby parts) ship with an opaque background.
Rigged as three separate rigs (`tools/puppet-studio/rigs/tree-stage-{1,2,3}.json`,
replacing the single stage-2-only `tree.json`) sharing pivot/position so the
stages stand on the same ground line when swapped, each with its own
`treeSway` recipe registration (amplitude tuned per stage: 5°/3°/2° for
sapling/young/mature — a sapling reads stiff at the mature tree's amplitude
and vice versa). Baked via the puppet-studio browser UI, driven through
`browser-harness` (CDP-connected isolated Chrome, per the primary
browser-automation bake path): `npm run studio`, then for each rig —
`document.getElementById('rig-select').value = '<rig>'` +
`dispatchEvent(new Event('change'))`, then
`document.getElementById('bake-button').click()`, confirming the `#status`
text reports a save under `assets-src/baked/<rig>/` — then promoted manually
to `assets/sprites/tree-stage-{1,2,3}.{png,json}`. No human cleanup beyond
the mechanical ingest/bake pipeline.

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
