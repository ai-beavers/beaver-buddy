# Beaver Buddy Puppet Studio

Dev-time animation-authoring tool (ADR 003 — **never shipped in the app**).
Rigs individual character parts (generated via the ComfyUI `PixelArt Builder`
workflow) and bakes animations into the exact PNG sprite-sheet format the
app's plain-Canvas2D renderer already loads (`assets/sprites/*.png` + `.json`).

## Run it

```bash
npm run studio:parts   # once: generate crude placeholder parts (assets-src/parts/, gitignored)
npm run studio         # compile + serve at http://localhost:8377/
```

With real ComfyUI parts (download the run's outputs into a folder first):

```bash
node tools/puppet-studio/ingest-parts.mjs <runDir> <rigName>
# e.g. node tools/puppet-studio/ingest-parts.mjs assets-src/comfyui/parts-run-1 beaver-baby
```

Open the URL, pick a rig + animation, press **play** to preview, **bake &
save** to write the sheet to `assets-src/baked/<rig>/` (gitignored):

- `sheet.png` + `sheet.json` — drop-in sheet for the app (copy to
  `assets/sprites/<name>.png/.json` after review)
- `frames/<anim>/frame_XX.png` — individual frames for close review

## Pipeline

1. **Parts** — one ComfyUI run per character/stage generates the part set
   (torso, head, limbs, tail, eye open/closed, accessories like the parachute
   canopy). Until that workflow adaptation lands, `npm run studio:parts`
   generates crude placeholders.
2. **Rig** — `rigs/<name>.json` declares each part's image, pivot, rest
   position, z-order, and parent (children inherit parent motion: the head
   rides the body's bob without its own track).
3. **Recipes** — `anims/*.ts` are pure keyframe data (time → rotation /
   position / scale / visibility per part). A new animation is a small data
   file, not a new image-gen batch.
4. **Bake** — recipes are sampled at the app's `SPRITE_FPS` (8) into 96×96
   tiles, one row per animation, matching `src/renderer/sprites.ts`'s
   `frameRect` addressing exactly (cross-checked in `sheet.test.ts`).
5. **Review & intake** — inspect the baked sheet/frames, then copy them into
   `assets/sprites/` and run the existing `scripts/gen-sprites` checks.

## Pixel-art fidelity rules

- Keep rotation angles small (±15–30°). Larger rotations break the pixel grid
  and look mushy — generate extreme poses in ComfyUI as separate
  parts/keyframes instead.
- Bake happens at native resolution with nearest-neighbor filtering; the
  studio preview zoom is CSS-only.
- Review every baked animation via its frames + a contact sheet before
  intake. What ships must pass the same style bar as ingested art
  (`assets/STYLE.md`).

## Layout

| Path | Purpose |
|---|---|
| `rig.ts` | rig types + validation (pure, tested) |
| `keyframes.ts` | keyframe DSL + sampling (pure, tested) |
| `sheet.ts` | sheet layout math (pure, tested against `sprites.ts`) |
| `puppet.ts` | PixiJS stage assembly + pose application |
| `bake.ts` | frame stepping → sheet PNG + meta JSON |
| `studio.ts` + `index.html` | browser UI |
| `serve.mjs` | localhost server (static + `POST /save`) |
| `ingest-parts.mjs` | ComfyUI parts intake: trim + downscale to rig size |
| `anims/` | animation recipes (pure data) |
| `rigs/` | rig definitions |
| `gen-placeholder-parts.mjs` | placeholder part generator |
