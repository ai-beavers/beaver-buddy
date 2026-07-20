# ComfyUI Avatar Asset Generation Pipeline

## Status

Parts-based pipeline is **working end-to-end**: the ComfyUI `PixelArt Parts
Builder` workflow generates a character's part set in one run, the PixiJS
puppet studio (`tools/puppet-studio/`, ADR 003) rigs them and bakes
app-compatible sprite sheets. First real run: `beaver-baby` parts (torso,
head, tail, legs, eyes, parachute canopy) → idle/walk/parachute sheet. Next:
more characters/stages and tuning of part conventions.

## Goal

Create a **developer-facing** asset-generation workflow using ComfyUI +
PixiJS to produce new character stages, variants, and animations for Beaver
Buddy. Generated assets are committed to the repo as PNG sprite sheets and
consumed by the existing sprite system.

## Non-goal

End-users do **not** run ComfyUI or generate avatars inside the app. This is a
content-authoring / build-time pipeline only. Any point/level system that
unlocks avatars is tracked separately.

## Context

- The app's sprite system uses **96×96 native tiles** at `PET_SCALE = 1`
  (BL-11 ingested art), currently with `idle` / `walk` rows, 8 fps sprite
  cadence (`SPRITE_FPS = 8`).
- `assets/STYLE.md` pins the palette, grid, outline rules, and right-facing +
  mirror convention; imported (AI-generated) sheets are exempt from palette
  quantization but must still pass the visual design gate.
- The original hamster-avatar workflow (`PIXEL ART BILDER`) exists in the
  user's Comfy Cloud workspace and serves as the starting point.
- No API keys or remote services in the app; only image files enter the repo.

## The pipeline (parts-based)

1. **Parts once**: ComfyUI generates a character's part set (torso, head,
   limbs, tail, eye open/closed, accessories like a parachute canopy) in one
   run per character/stage — parts-grid mode of `PixelArt Builder` (next task,
   see below).
2. **Rig**: `tools/puppet-studio/rigs/<name>.json` declares each part's image,
   pivot, rest position, z-order, and parent.
3. **Recipes**: `tools/puppet-studio/anims/*.ts` — keyframe data (time →
   rotation/position/scale/visibility per part). A new animation is a small
   data file, not a new image-gen batch.
4. **Bake**: the studio samples recipes at 8 fps into 96×96 tiles, one row per
   animation, emitting exactly the app's sheet format (PNG + meta JSON).
5. **Review & intake**: inspect baked frames/sheet, then copy into
   `assets/sprites/` and run the existing `scripts/gen-sprites` checks and the
   design gate.

## Animation ideas to explore

### 1. Parachute drop interaction

- Triple-click the beaver to enter "grab" mode → drag to a target location →
  click again to release; the beaver opens a parachute and glides down to the
  bottom screen edge.
 
- **Studio prototype exists**: the `parachute` recipe (canopy pendulum + body
  hang) bakes a loop. The interactive behavior (grab/drag/release + glide
  trajectory in `roam.ts`) is a separate app task.
- Open questions:
  - How is the falling trajectory integrated with `roam.ts` and the existing
    screen-edge clamping?
  - Does the canopy need rope lines (a separate thin part) for readability?

### 2. Growing environment object (e.g. tree)

- A tree grows next to the beaver as it levels up.
- **Studio prototype exists**: one-part `tree` rig + `sway` recipe; growth
  stages are separate images (placeholder stages 1–3 generated), the sway
  recipe is stage-independent.
- Open questions:
  - Does the tree live on a separate render layer (foreground/background) or
    share the beaver sprite layer?
  - How many growth stages are needed, and how do they map to the level curve?

## Tooling access

**Comfy Cloud MCP is available** in this session (`https://cloud.comfy.org`,
authenticated via OAuth, 36 tools). That means we can:

- Search models, nodes, and templates.
- Run templates and saved workflows in the cloud.
- Upload images and fetch outputs.

The generated images still enter the repo as ordinary PNG assets; no API keys
or runtime cloud calls are added to the Beaver Buddy codebase.

## Workflow inventory

| Name | Cloud filename | Source / role |
|---|---|---|
| `PIXEL ART BILDER` | `pixel-art-bilder.json` | Original template; generates an 8-frame (4×2) sprite sheet from one reference image via `GeminiNanoBanana2`, removes background with `BiRefNetRMBG`, and exports frames + GIF/WebP animation. |
| `PixelArt Builder` | `pixelart-builder.json` | Clean copy of the template, created for Beaver Buddy modifications. |
| `PixelArt Parts Builder` | `pixelart-parts-builder.json` | Parts-grid variant: one run generates 8 separated character parts (4×2 grid) with alpha, named outputs (`parts/<rig>/<part>`). Used for the first `beaver-baby` parts run (2026-07-17). |

### Key parameters in the current template

- **Output prompt:** `"pixelart, 32x32 pixels sprite sheet, white background, 4 x 2 grid of images"` + a German scene description.
- **Model:** `Nano Banana 2 (Gemini 3.1 Flash Image)`.
- **Resolution:** `2K`, aspect ratio `16:9`.
- **Frame layout:** 4×2 grid → 8 frames.
- **Frame rate:** 8 fps in the `VHS_VideoCombine` nodes.
- **Background removal:** `BiRefNet_toonout` with alpha output.

### Parts conventions (first run: beaver-baby)

- **Reference image:** a clean idle frame extracted from
  `assets/sprites/beaver-baby.png`, uploaded to Comfy Cloud as the
  `LoadImage` input so generated parts match the shipped character's style.
- **Part set (cell order):** torso · head · tail · front leg · back leg ·
  open eye · closed eye · red parachute canopy — one separated part per grid
  cell, white background, side view facing right.
- **Intake:** `node tools/puppet-studio/ingest-parts.mjs <runDir> <rigName>`
  trims each part crop to its alpha bbox and downscales it
  (premultiplied-alpha area-average) to rig proportions, writing
  `assets-src/parts/<rig>/`. Rig pivots/positions are then tuned to the
  printed dimensions.

## Needed modifications for Beaver Buddy

1. ~~**Parts-grid prompt mode**~~ **Done** (`PixelArt Parts Builder`).
2. **Prompt / style guide anchoring:** Add explicit references to the warm
   palette, outline rules, and right-facing mirror convention from
   `assets/STYLE.md` so generated parts stay consistent with shipped art.
3. ~~**Transparent background**~~ **Verified:** the workflow outputs clean
   alpha; parts work directly in the studio.
4. ~~**Reference image**~~ **Done:** idle frame from the shipped sheet.

## PixiJS puppet studio (parts-based authoring)

Decision recorded in `docs/adr/003-pixijs-authoring.md`: PixiJS is used
**dev-time only** (the app's Canvas2D renderer stays untouched; ADR 001's
runtime rejection is reaffirmed). The studio lives in `tools/puppet-studio/`
and is documented in its own README.

- Run: `npm run studio` → http://localhost:8377/
  (`npm run studio:parts` regenerates the crude placeholder parts if needed).
- Rigs: `beaver-baby` (real ComfyUI parts since 2026-07-17), `tree`
  (placeholders); recipes: `walk`, `idle`, `parachute`, `sway`.
- Baked output lands in `assets-src/baked/` (gitignored) and goes through the
  normal intake/review before copying to `assets/sprites/`.
- Verified end-to-end (headless Chrome): rig loads, bake writes
  `sheet.png`/`sheet.json` + frames in the app's exact format — with real
  ComfyUI parts.

## Open questions / next steps

- [x] Locate and review the current hamster ComfyUI workflow file.
- [x] Create a clean copy named `PixelArt Builder`.
- [x] Decide where PixiJS fits: dev-time puppet studio (ADR 003), never the
      app runtime.
- [x] Prototype the parachute animation — as a parts-based recipe in the
      studio (baked sheet; runtime behavior remains a separate app task).
- [x] Adapt `PixelArt Builder` for **parts-grid generation**
      (`PixelArt Parts Builder`, first run 2026-07-17).
- [x] Replace the studio's placeholder parts with the first real ComfyUI parts
      set and re-bake (idle/walk/parachute sheet verified).
- [ ] Generate the remaining part sets (beaver teen/adult, tree stages) and
      document any adjustments to the part conventions.
- [ ] Decide whether the workflow JSON belongs in the repo (for
      reproducibility) or stays outside as a local developer artifact.
- [ ] Define palette enforcement in ComfyUI: post-process quantization vs.
      prompt/model-level control.
- [ ] Decide how environment objects (tree) fit into the scene graph and level
      system.
- [ ] Update `assets/STYLE.md` once new asset types are finalized.
- [ ] Add/update sprite validation in `generator.test.ts` or similar for any
      new animation categories.

## Constraints

- No API keys, secrets, or `.env` files in the repo (`CLAUDE.md`).
- Generated content is graphical only; progression/unlock logic is handled
  separately.
- New assets must pass the existing sprite validation and design-review gate
  before merging.
- Runtime network calls remain forbidden unless an explicit future item
  authorizes them.
