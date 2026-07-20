# ComfyUI Avatar Asset Generation Pipeline

## Status

Idea / developer task — **not yet implemented**. This document captures the
workflow plan so it can be iterated in upcoming sessions.

## Goal

Create a **developer-facing** asset-generation workflow using ComfyUI to
produce new character stages, variants, and animations for Beaver Buddy.
Generated assets are committed to the repo as PNG sprite sheets and consumed
by the existing sprite system.

## Non-goal

End-users do **not** run ComfyUI or generate avatars inside the app. This is a
content-authoring / build-time pipeline only. Any point/level system that
unlocks avatars is tracked separately.

## Context

- The existing sprite system uses 48×48 source tiles, 16-frame animation sets
  (`idle`, `walk`, `run`, `sleep`, `react`), rendered at `PET_SCALE` via the
  canvas renderer.
- `assets/STYLE.md` pins the 16-color palette, grid, outline rules, and
  right-facing + mirror convention.
- A ComfyUI workflow already exists for hamster avatar animations and can
  serve as the starting point.
- No API keys or remote services are involved; ComfyUI runs locally and only
  image files enter the repo.

## Proposed workflow

1. Author or adapt a ComfyUI workflow locally (hamster workflow as base).
2. Generate animation frames or sprite sheets.
3. Convert the output into the repo's existing sprite-sheet format
   (`scripts/gen-sprites/`).
4. Validate against `assets/STYLE.md` (palette, grid, silhouette rules).
5. Commit generated PNG/JSON assets and any workflow metadata needed for
   reproducibility.

## Animation ideas to explore

### 1. Parachute drop interaction

- Triple-click the beaver to enter "grab" mode.
- Drag to a target location on screen.
- Click again to release; the beaver opens a parachute and glides down to the
  bottom screen edge.
- **Full-sheet animations generated (2026-07-20, owner "Voll ComfyUI"
  decision):** the three Fallschirm-Drop rows (`struggle`, `parachute-wind`,
  `land`) were generated as complete 8-frame sheets via the `PixelArt Builder`
  workflow (one Comfy Cloud run each) and baked with
  `scripts/gen-sprites/ingest-animation-frames.mjs`. Runtime integration +
  design gate is Phase 3 · WAVE-2.
- Open questions:
  - Is the parachute part of the beaver sprite sheet, or a separate overlay
    sprite animated independently?
  - Can a GIF/animated ComfyUI output be used 1:1, or do we still need
    frame-by-frame sprite sheets for the existing renderer?
  - How is the falling trajectory integrated with `roam.ts` and the existing
    screen-edge clamping?

### 2. Growing environment object (e.g. tree)

- A tree grows next to the beaver as it levels up.
- Must be generatable by the same ComfyUI workflow and stay faithful to the
  pixel-art style.
- Open questions:
  - Does the tree live on a separate render layer (foreground/background) or
    share the beaver sprite layer?
  - How many growth stages are needed, and how do they map to the level curve?
  - Does the tree need its own animation states (sway, leaves rustling)?

## Workflow adaptation needs

The existing hamster workflow likely needs changes to support:

- More complex multi-part animations (e.g. beaver + parachute).
- Consistent 48×48 grid and fixed palette output.
- Transparent background / correct alpha for overlay rendering.
- Batch generation of complete animation sets (`idle`, `walk`, `run`, `sleep`,
  `react`, plus new custom animations).
- Style consistency with the current warm palette and silhouette rules.

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

### Key parameters in the current template

- **Output prompt:** `"pixelart, 32x32 pixels sprite sheet, white background, 4 x 2 grid of images"` + a German scene description.
- **Model:** `Nano Banana 2 (Gemini 3.1 Flash Image)`.
- **Resolution:** `2K`, aspect ratio `16:9`.
- **Frame layout:** 4×2 grid → 8 frames.
- **Frame rate:** 8 fps in the `VHS_VideoCombine` nodes.
- **Background removal:** `BiRefNet_toonout` with alpha output.

## Needed modifications for Beaver Buddy

1. **Grid / tile size:** Move from `32×32` and `4×2` grid to the repo's
   `48×48` tiles. Depending on the animation, this may become a `4×4` grid
   (16 frames) to match the existing animation sets (`idle×2, walk×4, run×4,
   sleep×2, react×4`).
2. ~~**Prompt / style guide anchoring**~~ **Done** (2026-07-20, Phase-3
   Fallschirm-Drop): the warm-palette / 1px-outline / right-facing +
   consistent-character clause is now anchored directly in the `PixelArt
   Builder` prompt ("warm golden-brown fur with cream belly and 1px dark
   outline, side view facing right, same baby beaver character and colors as
   the reference image, consistent proportions in every frame") ahead of the
   per-animation scene description. Verified against the three baked
   Fallschirm-Drop rows.
3. **Transparent background:** The workflow already outputs alpha; verify the
   exported frames are usable as PNG with transparency for the canvas renderer.
4. **Batch animation generation:** One run should produce a full animation set
   for a given stage/character, not just one 8-frame action.
5. **Multi-part animations:** For the parachute drop, decide whether to render
   beaver + parachute in one sprite sheet or as separate overlay sprites.

## Open questions / next steps

- [x] Locate and review the current hamster ComfyUI workflow file.
- [x] Create a clean copy named `PixelArt Builder`.
- [ ] Decide whether the workflow JSON belongs in the repo (for
      reproducibility) or stays outside as a local developer artifact.
- [ ] Define palette enforcement in ComfyUI: post-process quantization vs.
      prompt/model-level control.
- [ ] Prototype the parachute animation using either combined sprite sheets or
      a separate overlay sprite.
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
