# Wave 1 — Clone "PixelArt Builder" & first new parts

**Status:** done (2026-07-19, verified)

## Prerequisites
- [x] ComfyUI MCP access active
- [x] "PixelArt Builder" template workflow available
- [x] Puppet Studio functional (Phase 1 done)

## Tasks
- [x] Duplicate "PixelArt Builder" in ComfyUI and save as a new template
      — cloud inventory documents `pixelart-builder.json` + parts variant
      `pixelart-parts-builder.json` (docs/comfyui-avatar-generation.md)
- [x] Adjust size parameters to the studio rigs (target: 96×96 tiles, individual
      parts on transparent background) — alpha output verified; 96×96 target
      achieved via `ingest-parts.mjs` (alpha-bbox trim + premultiplied downscale
      to rig proportions)
- [x] Test generation: complete part set for the `beaver-baby` rig (tail, legBack,
      body, legFront, head, eyeOpen, eyeClosed, canopy) — run 2026-07-17,
      raw data `assets-src/comfyui/parts-run-1/`
- [x] Import parts into `assets-src/parts/beaver-baby/`
      (`tools/puppet-studio/ingest-parts.mjs`) — 8 parts, rig pivots tuned
- [x] Verify in studio: idle/walk/parachute with real parts, then bake trial —
      bake 2026-07-18: `assets-src/baked/beaver-baby/sheet.png` (768×288,
      3 rows: idle 8 / walk 4 / parachute 8) + frames in app format;
      smoke test 2026-07-19: studio server serves UI, rig JSON, and all
      8 parts without errors (HTTP 200)

## Done when
- New workflow produces a complete part set in the same style; the studio
  shows the real parts without errors in all three recipes. ✅

## Carry-over (not part of this wave, before the NEXT generation run)
- Style prompt anchoring: explicit reference to palette/outline/right-facing
  from `assets/STYLE.md` in the parts builder prompt (open modification #2 in
  docs/comfyui-avatar-generation.md). Needs a Comfy Cloud MCP session or
  manual UI intervention — no MCP is currently configured in pi.
