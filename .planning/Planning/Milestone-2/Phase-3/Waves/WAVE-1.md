# Wave 1 — Parachute Drop: Assets (struggle, parachute-wind, land)

**Status:** done (assets generated + baked + smoke-tested; intake into the
committed sheet = WAVE-2/C4) · **executing tool: Claude Code** (Comfy Cloud MCP
is only configured there; pi builds the runtime logic in parallel in WAVE-2)

## Result (2026-07-20, Claude Code)

### Gap analysis
- Rig `beaver-baby` has all 8 parts incl. `canopy`; the keyframe DSL could
  procedurally rig all three animations (a `parachute.ts` studio recipe
  already exists but was never baked into the app sheet). Studio recipes
  would have been credit-free and style-true.
- **Owner decision: full ComfyUI** (2026-07-20) — every animation generated
  completely as a sprite sheet via Comfy Cloud, for maximum expression.
- Side finding: none of the app sheets (baby/teen/adult) ever had a
  `parachute` row — all three rows are new.

### Generation record (Comfy Cloud, workflow `pixelart-builder.json`)
- Generator node: `GeminiNanoBanana2` (Nano Banana 2 / Gemini 3.1 Flash Image),
  16:9 @ 2K, BiRefNet BG removal, output 4×2 grid = 8 frames.
- Reference image: `assets-src/reference/beaver-baby-idle.png` (96×96, clean
  idle frame) uploaded via `upload_file`.
- **Style prompt anchoring enabled** (open modification #2 thereby done):
  "warm golden-brown fur with cream belly and 1px dark outline, side view
  facing right, same baby beaver character and colors as the reference image,
  consistent proportions in every frame" anchored in the prompt.
- Seeds (fixed, reproducible): parachute-wind=810001, struggle=810002,
  land=810003.
- prompt_ids: parachute-wind `a8aac5c1-…`, struggle `4d6fd4d2-…`, land
  `75ee2f0c-…`. Raw frames → `assets-src/comfyui/{parachute-wind,struggle,land}-run/`
  (gitignored dumps).

### Bake
- Committed, reproducible ingest step:
  `scripts/gen-sprites/ingest-animation-frames.mjs` — reuses the exported
  functions from `ingest-images.mjs` (flood-fill BG removal → crop bbox →
  premultiplied-alpha area-average downscale → bottom-aligned placeOnTile),
  no new deps. idle/walk are copied pixel-perfectly from the existing sheet;
  struggle/parachute-wind/land appended.
- Locked-scale targets: struggle/land = 82px content height (resting/sitting
  frames ≈ idle size), parachute-wind = 92px (fit-to-tile → beaver deliberately
  smaller during glide; runtime placement is WAVE-2).
- Output: `assets-src/baked/beaver-baby/{sheet.png,sheet.json}` (768×480,
  rows idle(1)/walk(2)/struggle(8)/parachute-wind(8)/land(8)) + `_contact.png`.
- Smoke test: all 5 rows sliced correctly via the app `frameRect` logic, clean
  alpha cutout, no fringes. Row names exactly match pi's
  `AnimName` union in `roam.ts` (idle/walk/struggle/parachute-wind/land).

### Open → WAVE-2/C4 (integration)
- **Intake:** move `assets-src/baked/beaver-baby/sheet.{png,json}` into
  `assets/sprites/beaver-baby.{png,json}` (gitignored baked → committed).
- **Test reconciliation:** `scripts/gen-sprites/ingest-images.test.ts` currently
  locks "committed sheet == idle/walk-only ingest" (skipIf `assets-src/beaver/`
  absent — green on this machine, but latent on machines WITH source images).
  After intake, the beaver-baby byte match must move to
  `ingest-animation-frames.mjs` (or beaver-baby must be removed from `STAGE_SPECS`).
- **Design gate (#38):** Windows screenshots @100%/200% with the animation
  *playing* — needs the runtime, hence WAVE-2. Known points for the gate:
  (a) parachute-wind beaver smaller (fit-to-tile), (b) some struggle frames
  show the beaver rotated/left-facing (panicked squirming — the gate evaluates).
- **Gallery:** entry in `docs/asset-gallery.md`.

## Assignment for Claude Code (on `/fp-resume` continue reading directly here)

Create the three missing animations for the `beaver-baby` rig and bake them
into the app sheet format. Owner approval for ComfyUI credits is in place
(spend-gate confirmations are welcome but not a blocker).

1. **Gap analysis first** (30 min): check whether `struggle`/`land` can be built
   as **studio keyframe recipes** from the existing parts
   (`assets-src/parts/beaver-baby/`) (Puppet Studio,
   `tools/puppet-studio/`). Only what cannot be achieved pose-wise is newly
   generated via **Comfy Cloud**. Document the result here.
2. **Required rows** (in addition to idle/walk/parachute):
   - `struggle` — beaver hangs (on cursor), flails arms/legs/tail,
     body rotates slightly (squirming)
   - `parachute-wind` — glide with visible wind: canopy ripples, beaver
     sways; replaces/extends the existing `parachute` row (8 frames)
   - `land` — touch down, brief crouch/compression, transition into idle pose
3. **Conventions** (binding):
   - App format: 96×96 tiles, alpha, register sheet row in `sheet.json`
   - Style: `assets/STYLE.md` — **carry style prompt anchoring along**
     (palette/outline/right-facing explicitly in the prompt; carry-over from
     Phase 2, see `docs/comfyui-avatar-generation.md`)
   - Reference image: clean idle frame from `assets/sprites/beaver-baby.png`
     (upload via `upload_file`) so generations match the character
   - Workflow base: saved cloud workflows `pixelart-builder.json` /
     `pixelart-parts-builder.json` (inventory in
     `docs/comfyui-avatar-generation.md`)
   - Raw data to `assets-src/comfyui/<run-name>/`, parts ingest via
     `tools/puppet-studio/ingest-parts.mjs`, bake via studio
   - **Asset rule:** only commit reused assets; dumps stay
     local (gitignored)
4. **Completion:** studio smoke test (all rows play without errors), then update
   this wave + `PHASE.md` + `.flightplan/STATE.md` and register in
   `docs/asset-gallery.md` (gallery entry can also be WAVE-2).

## Prerequisites
- [x] Phase 1 + 2 done (studio functional, parts available)
- [ ] Comfy Cloud MCP reachable in Claude Code (reconnect if needed:
      `claude mcp add --transport http comfy-cloud https://cloud.comfy.org/mcp`
      + `/mcp` → Authenticate)

## Tasks
- [x] Gap analysis: studio recipe vs. ComfyUI generation per animation
      (result documented above; owner decision: full ComfyUI)
- [x] Create `struggle` (Comfy Cloud, seed 810002)
- [x] Create `parachute-wind` (Comfy Cloud, seed 810001; 8 frames)
- [x] Create `land` (Comfy Cloud, seed 810003)
- [x] Bake: sheet rows in app format (`assets-src/baked/beaver-baby/`)
- [x] Smoke test of all rows (frameRect slicing + contact overview)
- [ ] Intake into committed sheet + test reconciliation + design gate → WAVE-2/C4

## Done when
- The sheet contains the rows `struggle`, `parachute-wind`, `land` (in addition
  to idle/walk) in app format; the studio shows them without errors; the analysis
  + sources (studio recipe vs. ComfyUI run) are documented here.

## Carry-over
- Style prompt anchoring was mandated above — after the run check whether it
  is anchored in the prompt (open modification #2, docs/comfyui-avatar-generation.md).

## pi verification (2026-07-20, independently cross-checked)
- 3 runs complete (`struggle/parachute-wind/land-run`, 8 frames each + previews)
- Bake 768×480, 5 rows; `idle 1 / walk 2` byte-identical to the shipped sheet
  (no metadata bug — pi's earlier suspicion resolved itself)
- Sheet visually checked: wind ripples in canopy, flail variants, landing → idle ✅
- Suite 512 tests green in the mixed working tree
- **Design gate question for owner (for C4 verdict):** `struggle` contains rotated/
  left-facing frames — STYLE.md says "right-facing only". Is a panic-flail exception
  acceptable or regenerate?
