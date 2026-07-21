# Comfy workflows (shared)

Reusable **ComfyUI / Comfy Cloud** workflows for generating beaver animation
art, committed so the whole team generates the same way. A workflow is just a
JSON graph — drag it onto a ComfyUI canvas to load it.

> These run on **Comfy Cloud** (`cloud.comfy.org`), not a purely-local
> ComfyUI: the image node is **Nano Banana Pro (`GeminiImage2Node`)**, a paid
> Gemini API node that spends Cloud credits. You need a Comfy Cloud account +
> subscription.

## Workflows here

| File | What it does |
|------|--------------|
| [`beaver-animation-reference.json`](beaver-animation-reference.json) | Character-matched animation sprite sheet: `LoadImage` (an existing beaver sprite as a **reference**) → `GeminiImage2Node` (Nano Banana Pro) → `SaveImage`. The reference keeps the generated frames on-model. Used for the BL-18/BL-19 adult parachute art. |

## Use one

1. Open **cloud.comfy.org**, then **load the JSON** — drag the file onto the
   canvas, or use the Workflows sidebar → open/import.
2. In **`LoadImage`**, pick your reference (e.g. `assets/sprites/beaver-adult.png`
   cropped to one idle frame). The reference is what keeps the new frames
   looking like the existing character — don't skip it.
3. Edit the **`GeminiImage2Node` prompt** to describe the animation you want
   (poses per frame, grid layout, sizing). Keep the **green (`#00FF00`)
   background** instruction if the art has white detail (see below).
4. Run. Download the output sheet.
5. Slice → chroma-key → ingest into the sprite sheet. The full recipe (green
   chroma-key, `preKeyed` ingest flag, `assets:*` bake + promote step) is in
   [`docs/dev-guardrails.md`](../../docs/dev-guardrails.md); the art style rules
   are in [`assets/STYLE.md`](../../assets/STYLE.md).

**Why green background:** the ingest's background remover flood-fills from the
edge over *near-white*, so a white background eats white detail (parachute
canopy stripes). Generating on green and chroma-keying it out preserves the
white. Frames keyed transparent are ingested with `preKeyed: true` (skips the
white remover).

## Add a new one

1. Build/refine the graph in ComfyUI until it produces good frames.
2. Export it: **Workflow → Export** (or the sidebar's save-as-JSON) — this is
   the drag-loadable graph format.
3. Commit the `.json` here, add a row to the table above with a one-line
   description, and (if it introduces a new technique) note it in
   `docs/dev-guardrails.md`.
4. Keep prompts **generic/placeholder** where a field is meant to be swapped
   (the reference-image path, the animation description) so the next person
   isn't editing around a one-off.
