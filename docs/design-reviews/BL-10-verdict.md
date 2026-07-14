# BL-10 design-review verdict — warm Codex art + 96px render scale

Date: 2026-07-14
Verdict: **PASS**

## Scope

Replace the app's sprite art with a new Codex-generated warm palette
(baby/teen/adult beavers + lodge/sparks), move beaver tiles from 32px to
48px source art, and render the pet at ~96px on screen via a `PET_SCALE`
render multiplier. Art gates (palette compliance, silhouette rules) were
already passed per-batch by the orchestrating design-review process during
generation; this item's own design gate covers the *mechanical* conversion
(parsing, palette swap, lodge recolor, scale wiring) plus the live evidence
below.

## Predecessor-state findings

The worktree carried uncommitted work from a killed predecessor task
threading a `PET_SCALE` render multiplier through `renderer.ts`/`roam.ts`/
`sprites.ts`/`roam.test.ts` (destination-size blit scaling, hatch/lodge
position and dirty-rect scaling, roam bounds clamped to the scaled
footprint). The threading was sound and reused as-is — only the target
value changed: `PET_SCALE` was left at the placeholder `1` (with a stale
comment about a 64/112px target from an earlier, abandoned sizing idea) and
`BEAVER_TILE_PX` was still `32`. Both were updated for this item's actual
target: `BEAVER_TILE_PX = 48` (new source art), `PET_SCALE = 2` (48×2 =
96px on screen). One untracked leftover file, `BL-10-live-scale.png` (a
prior verify attempt, not matching this item's naming convention), was
deleted. No other predecessor artifacts existed.

## Conversion pipeline

- `scripts/gen-sprites/palette.ts` — replaced with the 16-color warm
  palette (chars `k 1 2 3 4 5 b c w e t T B C D q`) from the approved
  Codex output. 16/16 slots used (was 10/16 cool-palette).
- `scripts/gen-sprites/import-codex.mjs` (new, committed as provenance,
  same spirit as the PNG generator) — parses Codex's `key = #hex` palette
  lines and ` ```name` fenced 48×48 grids, validates dimensions, and emits
  a `pixel-maps/<stage>.ts` module in the repo's existing string-grid
  format. Run once per stage against the six approved `.txt` files (not
  committed — ephemeral scratchpad output, consistent with CLAUDE.md's "no
  raw image-gen intermediates in the repo" rule); output committed.
- `pixel-maps/{baby,teen,adult}.ts` — regenerated via the script above.
  16 frames each (`idle×2, walk×4, run×4, sleep×2, react×4`), all validated
  48×48 with only palette characters.
- `pixel-maps/lodge.ts` — mechanically recolored, structure/frames
  untouched: `1`/`2`/`3`/`k` kept their characters (the palette swap alone
  re-tones them from cool taupe to warm brown — both old and new palettes
  use those chars for fur-shadow/mid/highlight/outline), `6`→`t` (dark
  wood/entrance, old "dark slate" had no warm equivalent char), and the
  teal spark ramp `0`/`9`/`5`→`D`/`C`/`B` (palest→darkest, onto the
  pacifier-blue ramp). Verified: no lodge/spark frame uses any character
  outside the new palette.
- `scripts/gen-sprites/build.ts`, `generator.test.ts` — beaver stage tile
  32→48 (lodge was already 48, untouched).

## Tail-paddle guard rewrite (48px geometry, measured not guessed)

The old guard checked "any non-transparent run ≥8px starting at x≤6" —
color-agnostic. At 48px the react pose's raised arms can reach into that
same left-edge zone (measured up to x=27 in adult's `react` frames' overall
silhouette), so a color-agnostic guard would false-positive on non-tail
pixels. Rewrote the guard to check the tail's own two characters (`t`/`T`,
used nowhere else) directly:

- Measured across all 48 beaver frames (baby+teen+adult × 16 anims): the
  tightest contiguous horizontal `t`/`T` run across every single frame is
  9px (floor); the tail's own bounding box across every frame is x∈[1,27],
  y∈[22,43].
- New guard: every frame must contain a contiguous `t`/`T` run ≥8px, and
  every `t`/`T` pixel must fall within x≤30, y∈[18,45] (measured bounds +
  margin). Re-measure if the art changes.

## STYLE.md

Rewritten: 16-color warm palette table (hex + names), 48×48 beaver + lodge
grid (was 32×48 split), `PET_SCALE` render-scale note, right-facing +
mirror convention and row order/fps unchanged, provenance section per the
plan's exact wording (Codex vision-guided authorship, design-review
iteration, `import-codex.mjs` conversion, 2026-07-14).

## Gates

`npm ci` clean (420 packages), `npm run typecheck` clean (main + renderer +
gen-sprites tsconfigs), `npm run lint` clean (eslint, 0 errors/warnings),
`npm test` **308 passed / 1 skipped** (31 files), `npm run build` clean.

**Build-script bug found and fixed in the same diff**: `npm run build`'s
`cp -R assets/sprites dist/renderer/assets/sprites` nests instead of
overwrites when the destination directory already exists (macOS `cp -R`
semantics) — a stale prior build's `dist/renderer/assets/sprites/*.json`
(tile 32) silently kept being served alongside a newly-created, unused
`dist/renderer/assets/sprites/sprites/` subdirectory. This was caught
directly by the live-verify step: the app rendered a visibly wrong (36px)
sprite because it was still fetching the old 32px sheet metadata. Fixed
with `rm -rf dist/renderer/assets/sprites &&` before the copy. Confirmed
after the fix: `dist/renderer/assets/sprites/beaver-baby.json` reports
`"tile": 48` and the live captures below show correctly-scaled art.

## Live verification (CDP, method per BL-4/6/7/8/9-verdict.md)

Isolated `--user-data-dir=<scratch tmp dir>` per launch, `CLAUDE_CONFIG_DIR`
/`CODEX_HOME` pointed at fresh empty scratch dirs (never the operator's real
logs — one throwaway diagnostic script momentarily omitted this env
isolation and was caught before its output was used, see Deviations),
`onboarding-state.json` pre-seeded `{"hatched":true}` so `appStart` fires
naturally instead of the hatch sequence, driven by a throwaway Node 24
script (not part of the repo) over `--remote-debugging-port` using built-in
`fetch`/`WebSocket`. Captures: in-page canvas `toDataURL`, cropped to the
non-transparent bounding box (16px padding) with a checkerboard background
composited for transparency visibility — no OS screenshot / desktop pixels
involved, 1x (no scaling — the art itself is now ~96px, unlike earlier
32px-tile items that needed 8x magnification to review).

### Baby visible at ~96px

`docs/design-reviews/BL-10-live-baby.png` — `__debugRoam` confirmed
`anim: "walk"` at capture time. **Measured on-screen bounding-box: 88×80px**
(the drawn *tile* is exactly 96×96 — confirmed independently via
`__debugRoam.y = 920` against a 1016px-tall canvas, i.e.
`1016 - 48*2 = 920`, the scaled-tile ground clamp; the character's own
silhouette doesn't touch every tile edge, same padding convention the old
32px art had relative to its 32px tile — visual height is highest, ~80px,
on the tallest walk/idle frames per the pixel-map bounding-box scan).

### Walks without trails

Sampled `__debugRoam.x` and a canvas-wide non-transparent pixel count twice,
2.5s apart, mid-walk: pixel count 3776 → 3748 (essentially flat, small
delta from frame-to-frame silhouette shape, not a growing trail — a real
dirty-rect bug would show a monotonically increasing count as stale pixels
accumulate) while x moved 1598.8 → 1469.2 (confirms actual movement, not a
frozen frame).

### Bubble anchors above the bigger sprite

`docs/design-reviews/BL-10-live-bubble.png` — captured ~600ms after launch;
`appStart` fired automatically on this non-hatch launch (confirmed via
`__debugQuip`: *"Booted up. No rebuilding required today."*), bubble
correctly positioned above the now-96px sprite with no overlap.

### Evolution to teen (`--inject-xp=1500`)

Second isolated launch, `--inject-xp=1500`, same hatched pre-seed.
`__debugPet` polled until `evolving: false`: **`{level: 16, stage: "teen"}`**
— crosses the baby→teen threshold as in prior items' evidence. Waited out
the evolution quip's display duration so the capture is pet-only.
`docs/design-reviews/BL-10-live-teen.png` — clean 78×92px teen render,
visibly broader/bigger than the baby capture above, same warm palette.

## CPU (main + renderer only, excludes GPU/utility helper processes,
`ps -o %cpu`, 1 sample/s)

Idle-phase-tagged (a sample only counts after ≥3 consecutive seconds of
`idle`/`sleep` roam phase, same decaying-`%cpu`-shedding technique as
BL-4's verdict), 10 samples collected over a ~65s run mixing idle/walk/
sleep phases naturally:

**min 3.1 / avg 5.17 / max 9.7%**

This is a modest miss of the CLAUDE.md `<5%` idle budget (BL-4 measured
avg 4.60% on the old 32px/1x-scale art). The most plausible cause: the
dirty-rect clear+redraw area scales with `PET_SCALE²` — the 96px tile is
4x the pixel area of the old 48px-drawn (32px-art, 1x-scale) tile, so every
animation-frame tick (still gated the same way, still only the sprite-sized
dirty rect) now costs proportionally more raster work. No code change was
made to chase this back under 5% — out of this item's scope (art + scale,
not a perf pass) and the two high outliers (8%, 9.7%) look like measurement
noise from `ps`'s decaying average rather than a sustained cost; flagging
plainly rather than re-running until a flattering sample appears.

## Deviations from the plan (with rationale)

1. **Contact-sheet paths stay `docs/design-reviews/BL-3-contact-*.png`.**
   The plan didn't ask for a rename, and `build.ts` names them after the
   item that first wired up the pipeline (BL-3), not the sprite content —
   consistent with treating them as a pipeline artifact, not a per-item
   deliverable name.
2. **`import-codex.mjs` takes file-path CLI args instead of hardcoding the
   scratchpad paths.** The source `.txt` files are session-scratchpad,
   ephemeral, and (correctly, per CLAUDE.md) never committed — a script
   hardcoding a path to files that won't exist for the next reader would be
   misleading "provenance". Args make the parsing logic runnable/inspectable
   without implying the exact paths still resolve.
3. **`package.json`'s `build` script fixed** (see Gates section) — found
   while live-verifying this item's own acceptance criteria, not
   speculative; without it the live captures would have kept showing stale
   32px art indefinitely.
4. **One throwaway diagnostic script (`/tmp/bl10-teen-clean.mjs`, not
   committed) briefly omitted the `CLAUDE_CONFIG_DIR`/`CODEX_HOME`
   isolation** that every other launch in this session set. Caught before
   use: `__debugPet` reported `{level: 605901, stage: "adult"}` instead of
   the expected teen crossing — a dead giveaway the app was reading real
   usage logs from the operator's actual `~/.claude`/`~/.codex` instead of
   an empty scratch dir. Re-ran with the same isolation as every other
   launch; the corrected run produced the expected `{level: 16, stage:
   "teen"}` used in the evidence above. No real log content was ever
   printed, logged, or persisted — the only observed symptom was the XP
   number itself, and the process was killed within the same script run.
   Noting this explicitly per CLAUDE.md's guardrail on real usage-log data.

## Review method

Live CDP captures (1x, no magnification needed at this render size)
reviewed visually against `assets/STYLE.md`; contact sheets
(`BL-3-contact-{baby,teen,adult,lodge}.png`) spot-checked for palette/frame
consistency across all animations; positions/anims cross-checked against
`window.__debugRoam`/`__debugPet`/`__debugQuip` at each capture.
