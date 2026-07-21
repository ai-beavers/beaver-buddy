# Development Guardrails & Gotchas (hard-won)

Concrete traps hit while building the grab/parachute feature (BL-17/18/19) and
its ComfyUI sprite art. Skim before touching the **sprite pipeline**, the **grab
interaction**, or **generating animation art** — each bullet cost a wrong turn.
Authoritative specs live elsewhere ([`interaction-model.md`](interaction-model.md),
[`../assets/STYLE.md`](../assets/STYLE.md),
[`comfyui-avatar-generation.md`](comfyui-avatar-generation.md)); this is the
"don't repeat these mistakes" list.

## Grab / interaction (renderer)

- **Gate every input path through ONE stage predicate.** The capture-mode gate
  *and* the `pointerdown`/`dblclick` recorders in `src/renderer/renderer.ts`
  must all use `stageHasInteraction(stage)`. When the adult stage was enabled,
  the capture-mode gate was updated but the two click recorders still said
  `stage !== 'baby'` and silently dropped clicks. Grep every sibling caller when
  you touch a gate.
- **Don't blame the platform first.** macOS `setIgnoreMouseEvents(true,
  { forward: true })` delivers hover events fine and the grab works on macOS. A
  "works on Windows, not Mac" symptom was really "works on baby, not adult" —
  a stage-gating bug, not a platform gap.
- **Tile geometry:** `placeOnTile` keeps the TOP and drops the BOTTOM when
  content is taller than the tile — oversizing a parachute frame clips the
  beaver's **feet**, not the canopy. A parachute beaver looks small because the
  canopy + beaver share one 96px square; the fix is a taller per-row tile
  (`SheetRow.height`; `drawFrame` bottom-anchors taller rows to the same ground
  line — BL-19). Keep the pet's **logical footprint at 96px** (roam bounds /
  click-through hit-box) even when the tile is visually taller.

## ComfyUI sprite generation (full-frame — the shipped approach)

The parts-based/puppet-studio pipeline in `comfyui-avatar-generation.md` was
reverted by owner decision; shipped animation frames are **full-character
ComfyUI runs ingested mechanically**. When generating:

- **Match an existing character with a REFERENCE IMAGE.** Text-only prompts
  invent a new generic character. Feed the actual committed sprite as a
  reference (`GeminiImage2Node.images`, fed by a `LoadImage` node).
- **Use `submit_workflow` + `wait_for_job`, not `partner_generate`, for
  reference-conditioned jobs.** They run slow (>120s) and `partner_generate`
  holds the call open → the transport drops. `submit_workflow` returns a
  `prompt_id` immediately; poll it. Upload the reference via a `ctx_execute`
  fetch — the context-mode hook blocks `curl`.
- **Generate on a GREEN chroma-key background if the sprite contains white**
  (e.g. the white parachute-canopy stripes). A white background + the ingest's
  flood-fill removal eats white detail that touches the edge. Key the green to
  transparent at slice time, and protect bright/white pixels in the key.
- Comfy Cloud needs an active **subscription** to queue jobs.

## Ingest / bake pipeline (`scripts/gen-sprites/`)

- **`preKeyed: true`** on an animation skips `removeBackground` for
  already-transparent (chroma-keyed) frames. `removeBackground`'s border
  flood-fill treats near-white as background, so running it on a
  transparent-bg frame eats white detail touching the edge (the canopy stripes
  flickered transparent until this flag was added).
- **`assets:adult-anims` writes to `assets-src/baked/<stage>/` — you must
  PROMOTE it** (copy `sheet.png` / `sheet.json` → `assets/sprites/beaver-<stage>.*`).
  The bake does not write the shipped sheet directly.
- `computeStageScale` locks ONE scale per row from the widest+tallest frame and
  caps content width at the tile width — a single wide pose shrinks the whole
  row.
- **Always eyeball the baked sheet** (a contact sheet; on a contrasting/magenta
  background to spot transparency holes). "typecheck + tests pass" never means
  "looks right."

## Verification & platforms

- The renderer/asset code is **platform-agnostic** (no `process.platform`
  branches in the interaction path); HiDPI is the shared DPR transform
  (`src/renderer/canvas-dpr.ts`), covering Windows fractional scaling
  (125/150%) the same as Retina.
- **The Windows visual design gate cannot run on macOS** — subagents share the
  host machine, so none of them can run a Windows overlay either.
  `windows-latest` CI (`.github/workflows/ci.yml`) covers packaging
  (`electron-builder --win`) + typecheck/lint/test; the overlay screenshot gate
  still needs a Windows desktop (checklist under `docs/design-reviews/`).
