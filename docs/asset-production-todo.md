# Asset Production — sequential to-do list

The working checklist for producing the assets planned in
[`asset-storybook.md`](asset-storybook.md). The storybook says *what* and
*when*; this file says *in which order, with which gate, and who decides*.

**Ground rule (owner, 2026-07-27): strictly sequential.** One stage at a time,
each closed by an owner gate before the next opens. Nothing here starts without
that gate. The whole ladder runs on the **baby stage only** until the approach
is verified — the other four stages are not touched.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Gate legend: **🚦 GATE** = stop, present evidence, wait for owner decision.

---

## Why this order

Two competing approaches must be compared, and the comparison is only
meaningful once a good reference exists:

| | Option A — full-character | Option B — parts + puppet studio |
|---|---|---|
| How | one ComfyUI run per animation, whole beaver, 4×2 grid | animate body parts separately, merge in the studio |
| Shipped today | all 18 adult rows, both baby row sets | 3 tree stages only — **no beaver row ever shipped this way** |
| Cost per new animation | one generation + review | one recipe edit (cheap) *after* the parts exist |
| Outfits | derive from baked frames, alignment must be checked | outfit is a rig part — aligned by construction |
| Known failure | character drifts between independently generated cells (BL-7) | the baby bake was technically correct but visually rejected |

Both are tested **on the same character, from the same turnaround reference**,
so the comparison is fair. That is the entire point of doing the turnaround
first.

---

## Stage 0 — Preconditions

- [x] **T0.1 — Authorize the Comfy Cloud MCP.** Done by owner 2026-07-27.
  Verified: `cloud.comfy.org`, production, authenticated (OAuth), server
  v0.32.0, 36 tools.
- [ ] **T0.2 — Resolve the documentation contradiction.**
  [`comfyui-avatar-generation.md`](comfyui-avatar-generation.md) claims the
  parts pipeline is "working end-to-end";
  [`dev-guardrails.md`](dev-guardrails.md) says it was reverted by owner
  decision. Repo reality: no beaver sheet in `assets/sprites/` came from the
  studio — only the three tree stages did. Whichever way Stage 4 lands, one of
  the two docs must be corrected. Do this *after* Stage 4, so the correction
  records the current truth rather than the old one.
- [ ] **T0.3 — Baseline evidence.** Build a side-by-side contact sheet:
  the unpromoted studio bake (`assets-src/baked/beaver-baby/sheet.png`, still
  on disk) versus the shipped `assets/sprites/beaver-baby.png`. This is the
  concrete record of *why* the parts route was rejected last time — without it
  Stage 4 re-litigates a decision from memory. Cheap: both files exist, no
  generation needed.

---

## Stage 1 — A fresh, minimal ComfyUI workflow

Owner decision: a **new workflow built around a single Gemini Image Flash
node** — not a modification of the existing `PixelArt Parts Builder` (which
carries `BiRefNetRMBG` background removal and `VHS_VideoCombine` video export
we do not want; our ingest does its own chroma-keying).

- [x] **T1.1 — Identify the exact node.** Resolved 2026-07-27 via
  `search_nodes` + `get_node`. **We standardize on `GeminiImage2Node`
  ("Nano Banana Pro") with `model: "Nano Banana 2 (Gemini 3.1 Flash Image)"`.**
  Findings:
  - **`GeminiNanoBanana2` is now DEPRECATED.** That is the node BL-5's
    `stretch` row used and the one wired into the existing
    `PixelArt Parts Builder`. Nano Banana 2 survives as a *model option inside*
    `GeminiImage2Node` — which independently justifies building a fresh
    workflow rather than editing the old one.
  - `GeminiImage2Node` takes an optional `images` input accepting **up to 14
    reference images** via a `Batch Images` node — enough for the dual/triple
    conditioning the turnaround work needs.
  - It exposes `aspect_ratio` and `resolution` (1K/2K/4K), which the older
    `GeminiImageNode` (`gemini-2.5-flash-image`) only partly does.
  - **Trap found — override `system_prompt`.** Its default ends with
    *"If a prompt is conversational or lacks specific visual details, you must
    creatively invent a concrete visual scenario"*. For a rigid 5-cell
    turnaround with a pinned layout, "creatively invent" is precisely the
    wrong instruction, and it is a plausible contributor to the past layout
    failures (BL-4's transposed grid, BL-8's invented divider lines). The new
    workflow must pass a strict, layout-preserving system prompt instead of
    relying on the default.
- [ ] **T1.2 — Build the workflow.** Minimal graph only:
  `LoadImage` (reference) → Gemini Image Flash → `SaveImage`. No background
  removal, no video export, no upscaler.
- [ ] **T1.3 — Settle the invocation path.** Two documented, contradictory
  experiences must be resolved by testing, not by picking one:
  - `dev-guardrails.md`: use `submit_workflow` + `wait_for_job`;
    `partner_generate` holds the call open until the transport drops.
  - `assets/STYLE.md` (BL-8/9/10/11/14): `upload_file` was **blocked by the
    sandbox** in those sessions, forcing `partner_generate` with a public raw
    URL as the reference.
  Test the reference upload first (`ctx_execute` fetch — `curl` is blocked by
  the context hook). Record which path works in *this* environment.
- [ ] **T1.4 — Smoke test.** One throwaway image, green `#00FF00` background,
  confirming: output arrives, alpha/color type is as expected (expect RGB from
  `partner_generate` → needs RGBA normalization before ingest), no divider
  lines.
- [ ] **T1.5 — Decide where the workflow JSON lives** — committed for
  reproducibility, or a local developer artifact. This is a long-standing open
  question in `comfyui-avatar-generation.md`; the new workflow is the moment to
  answer it.

**🚦 GATE 1** — owner confirms: workflow runs, invocation path is known and
documented, smoke image looks sane.

---

## Stage 2 — The baby turnaround (reference sheet)

Owner decision: **baby only.** The other four stages wait until the whole
approach is verified.

- [ ] **T2.1 — Prepare the reference.** `assets-src/reference/beaver-baby-idle.png`
  already exists and is committed — verify it is still the clean idle tile from
  the shipped sheet before using it.
- [ ] **T2.2 — Generate 5 views in one image.** front (S), front-right (SE),
  right (E), back-right (NE), back (N) — 5 columns × 1 row, landscape.
  Non-negotiable constraints, every one of them learned from a past failure:
  - Green `#00FF00` background, **no divider lines between cells** (BL-4/BL-8:
    a seam touching a cell edge poisons `cropToBbox`).
  - Layout pinned explicitly in the prompt (BL-4 came back transposed).
  - Identical pose, lighting, and scale across all 5 cells — that *is* the
    deliverable. Drift = regenerate, never "fix it in ingest".
- [ ] **T2.3 — Sequential review.** Every attempt goes to the owner before the
  next step. Explicitly requested: generate → owner checks → continue.
- [x] **T2.4 — Ingest.** Done via the new
  `scripts/gen-sprites/ingest-turnaround.mjs` (`npm run assets:turnaround`),
  reusing the existing `chromaKeyGreen` / `extractGridCell` / `cropToBbox` /
  `resizeAreaAverage` / `placeOnTile` / `computeStageScale` helpers. No RGBA
  normalization needed — `submit_workflow` + `SaveImage` emits `colorType 6`
  directly, unlike `partner_generate`. Scale 0.1181; HEIGHT binds (813 px
  content → 96 px tile), width tops out at 74 px, so no scale trap.
  One addition was required: `dropStrayFragments` removes detached blobs under
  1 % of the figure (attempt 3 left a 336 px speck beside the side view).
- [x] **T2.5 — Mirror the three left-side views** (indices 5/6/7 from 3/2/1) —
  pixel-exact by construction, no generation. Test-enforced against the
  committed sheet.
- [x] **T2.6 — Commit** to `assets-src/reference/turnaround/beaver-baby-turnaround.png`
  + `.json`. **Not** `assets/sprites/` — build-time reference, nothing in
  `src/` loads it. Registered in `docs/asset-gallery.md`, provenance in
  `assets/STYLE.md`.
- [x] **T2.7 — Design-gate verdict**:
  `docs/design-reviews/baby-turnaround-verdict.md` (PASS) + contact sheet.

Gate status: `npm run typecheck` + `npm run lint` clean, `npm test` 669 passed
/ 36 skipped, including a byte-for-byte rebuild check and the mirror contract.

**🚦 GATE 2** — owner accepts the turnaround. Everything downstream conditions
on it, so a mediocre turnaround propagates into all 36 planned rows.

### Attempt log — baby turnaround (2026-07-27)

Raw dumps under the gitignored `assets-src/comfyui/baby-turnaround/`; kept
rather than deleted (owner decision) as reference material.

| | Attempt 1 | Attempt 2 | **Attempt 3 (winner)** |
|---|---|---|---|
| Layout | ❌ 5×2 grid, second row unrequested | ✅ one row, 5 figures | ✅ one row, 5 figures |
| Green bleed onto the character | ❌ 2 of 10 cells destroyed — **0.4 %** and **9.1 %** of their pixels survive a green key | ✅ none | ✅ none |
| Five *distinct* angles | ❌ front-three-quarter duplicated, back-three-quarter missing | ✅ all five distinct | ✅ all five distinct |
| Height consistency | ⚠ varies | ✅ 0 % deviation (1029 px each) | ✅ 0 % deviation (810 px each) |
| Drawn ground line | ✅ none | ❌ solid line, darkest row **95 %** | ✅ none, darkest row **39 %** (figure outlines only) |
| Background | `#00FF00` | `#00FF00` | ⚠ `(30,195,55)` muted green |

**What each attempt taught us:**

- **A1 → the layout instruction alone does not hold.** A 21:9 canvas is 2.36:1;
  five square cells in one row want ~5:1, so the model filled the leftover
  vertical space with a second row. The recurring "grid layout" failure class
  (BL-4, BL-8, BL-11) struck again.
- **A1 → naming the background colour near the character description leaks it
  onto the character.** Two beavers came back painted green — the worst
  possible outcome for a chroma-key pipeline, since a green character keys out
  to a hole. Fixed by an explicit "the figure itself contains NO green" rule
  plus a colour whitelist for the character.
- **A2 → forbidding dividers does not forbid a *ground* line.** The model drew
  a baseline under the feet, spanning the full width and touching the image
  edge — the exact `cropToBbox` poison from BL-8, in a form the earlier ban did
  not cover. Fixed by an explicit no-ground/no-shadow/no-props block.
- **A3 → the hex value must stay in the prompt.** Hardening the prompt lost the
  `#00FF00` from the English header, and the background came back a muted
  `(30,195,55)`. Uniform and cleanly keyable here (far from every brown in the
  art), but the ingest threshold has to target the measured colour, and the
  hex belongs back in the template for the remaining figures.

**Prompt template** (winner, A3, with the A3 defect corrected): header must
read `pixelart character turnaround sheet, 5 poses in ONE single horizontal
row, pure green background (#00FF00) chroma key backdrop, nothing else in the
image` — **keep the hex**, A3 lost it and the background drifted to
`(30,195,55)`. Then: standing neutral model-sheet pose · five enumerated views
with "face NOT visible" spelled out for the back angles · character colour
whitelist · explicit no-green-on-figure rule · explicit
no-ground/shadow/props/lines/text block · "the imagined ground line is NOT
drawn" · reference-conditioned on the stage's committed idle tile.
Node settings: `GeminiNanoBanana2`, model "Nano Banana 2 (Gemini 3.1 Flash
Image)", `21:9`, `2K`, `IMAGE`, `thinking_level: HIGH`, stock `system_prompt`
untouched, a fresh recorded seed per attempt.

---

## The generation workflow (owner decision, 2026-07-27)

**Animation rows are generated with `BEAVER BUDDY ANIMATIONS WORKFLOW`**
(Comfy Cloud: `beaver-buddy-animations-workflow.json`, id
`d5a8b538-b05b-4cd4-b65e-7385bde68fc5`; a copy of the graph is committed at the
repo root as `BEAVER BUDDY ANIMATIONS WORKFLOW.json`). It supersedes
`pixelart-builder` and the throwaway minimal graph used for the turnaround.

Structure: two `LoadImage` nodes (character reference + a 2×2 layout guide)
batched together, feeding **four parallel `GeminiImage2Node` branches**
(`gemini-3-pro-image-preview`, i.e. Nano Banana Pro). Each branch emits a 2×2
grid, then `Crop Images` (16 px inset) → `Create Composites` → `Create
Animation`, producing 4 cut frames, a sheet, and an 8 fps video per animation.
Four animations per run.

Why it is better than what we used before — two lines in its prompt template do
the heavy lifting:

- *"Every element of the generated frame should fit inside the quadrant, with
  the central point of the character aligned with the central point of each
  quadrant."* This is the fix for the drift that killed `walk` attempt 1.
- A `CRITICAL CHROMAKEY REQUIREMENTS` block that pins `#00FF00` exactly, forbids
  green on the subject, and forbids black borders between frames — the three
  failures we hit separately across turnaround attempts 1–3, all covered up
  front.

**Deviations to keep in mind:**

- It produces **4 frames per row**, not 8. Fine for the sheet (`SheetRow.frames`
  is per-row and the sheet is 8 tiles wide), and a 4-phase walk cycle
  (contact / passing / opposite contact / passing) is a standard cycle — but it
  supersedes the earlier "8 frames for all movement rows" decision.
- Its stock prompts assume a **bipedal** character ("right leg forward, left leg
  back"). The baby crawls on all fours and sits; every prompt must be rewritten
  for the actual pose, and must add the size-consistency clause.
- Output naming is `ComfyUI-<anim>-1..4`, not `frame_01..08`. Rename to
  `frame_01.png`… on the way into `assets-src/comfyui/<figure>-<row>/`, or the
  ingest will not find them.

## Hand-off — how generated assets enter the repo

**Working split (owner, 2026-07-27): Rodgi generates and judges, the agent
integrates.** Generation runs in Comfy Cloud with the `pixelart-builder`
workflow; the agent no longer submits jobs. What lands on disk is what gets
ingested.

### Where to drop a finished animation row

```
assets-src/comfyui/<figure>-<row>/          e.g. baby-walk, baby-sleep
    frame_01.png … frame_08.png             REQUIRED — the 8 cut frames
    sheet.png                               optional, the raw 4×2 grid
    animation.gif                           optional but wanted (design gate)
```

`frame_01.png` … `frame_08.png` is not a suggestion — `bakeAnimation` in
`scripts/gen-sprites/ingest-animation-frames.mjs` reads exactly that naming,
and with `preKeyed: true` it takes the workflow's already-alpha-cut frames
straight through. Anything else needs code.

### Where to drop a turnaround

```
assets-src/comfyui/<figure>-turnaround/attempt-NN.png    the raw 5-view row
```

Then the agent runs `npm run assets:turnaround` after adding the figure to
`FIGURES` in `scripts/gen-sprites/ingest-turnaround.mjs`.

### What makes a row usable — the checklist that produced the failures so far

| Requirement | Why it exists |
|---|---|
| 8 frames, one continuous cycle, frame 8 flows into frame 1 | loops read as loops |
| **Identical body size and head height in all 8 cells** | walk attempt 1 died here: the body went 15 % flatter and the head dropped 10 px between grid rows 1 and 2, which reads as the beaver *falling*, not walking |
| Same lighting, same colours, same facing across all cells | independent-cell drift killed the adult's first `speak` row |
| Right-facing only | the renderer mirrors; a left-facing frame flips the walk mid-cycle |
| Nothing but the character — no ground line, shadow, props, dividers, text | a line touching a cell edge poisons `cropToBbox` |
| Pose stated explicitly in the prompt | the turnaround is a standing model sheet; it supplies character, never posture |

The foot line does **not** need to be consistent in the raw frames — the ingest
crops each frame to its own bbox and bottom-anchors it, which flattened 166 px
of raw drift to 0 px in the walk attempt. Body *size* is what must hold.

### Attempt log — baby rows

| Row | Attempt | Verdict | Why |
|---|---|---|---|
| `idle` | 1 | **accepted** | sitting pose held, 0 green on figure, no strays, outline matches the turnaround. Generated with a throwaway minimal graph, not `pixelart-builder` — flagged for a later redo |
| `walk` | 1 | **rejected** (owner) | body 15 % flatter and head 10 px lower in grid row 2 than row 1 → reads as the beaver dropping. Foot line was fine (0 px after bake). Same two-halves artefact as adult `brainrot`/`wave` |

## Stage 3 — Option A test: a full-character animation from the turnaround

- [ ] **T3.1 — Pick the test animation: `sleep`.** Reasons: it is the actual
  next row the baby needs (storybook §2.1, unlocks at L3), it is a loop (tests
  the wraparound seam), and it carries no prop (no width-bind scale trap). A
  successful test therefore produces a **usable asset**, not throwaway work.
- [ ] **T3.2 — Generate** 4×2 grid, conditioned on the turnaround sheet, green
  background, no dividers, layout pinned.
- [ ] **T3.3 — Ingest** via `scripts/gen-sprites/ingest-animation-frames.mjs`
  (new config entry, byte-preserving append — every existing baby row must stay
  untouched; the pin test enforces this).
- [ ] **T3.4 — Evidence:** contact sheet **and** an 8 fps GIF. A static contact
  sheet cannot catch temporal flicker — that is exactly how the first BL-7
  `speak` row passed review and still looked broken.
- [ ] **T3.5 — Answer the actual question:** did conditioning on a full
  turnaround reduce the cross-frame character drift that plagued BL-7? Compare
  against a known-drifty adult row. This is the measurable claim behind the
  whole turnaround idea — if it does not hold, the turnaround premise is wrong
  and we should know that before generating four more.

**🚦 GATE 3** — owner accepts or rejects the `sleep` row, and rules on whether
turnaround-conditioning demonstrably helped.

---

## Stage 4 — Option B test: part animations merged in the studio

Owner's idea: generate animations **per body part** (e.g. only the legs, no
body; only the head), keep them as separate sprite sheets, and merge them in
the puppet studio into more complex, variable animations.

**Technical finding — read before planning this stage.** The studio does *not*
support animated parts today. `RigPart.src` ([rig.ts:17](../tools/puppet-studio/rig.ts#L17))
is a **single image**, and tracks only interpolate `x`/`y`/`rotation`/`scaleX`/
`scaleY`/`visible` ([keyframes.ts:13-24](../tools/puppet-studio/keyframes.ts#L13-L24)).
There is no notion of "this part plays a frame sequence".

Two ways forward, and the cheap one is good enough for a spike:

- **Spike hack, zero code:** declare each frame as its own rig part
  (`legs01`…`legs08`, all `visibleByDefault: false`) and step them with
  `visible` keys. `visible` is already a sticky step function
  ([keyframes.ts:83-91](../tools/puppet-studio/keyframes.ts#L83-L91)) — exactly
  frame-stepping semantics. Ugly, but it proves or disproves the concept
  without touching the studio.
- **Clean version, small extension:** `src` accepts an array of frames plus a
  `frame` track field. Perhaps 30 lines across `rig.ts`/`keyframes.ts`/
  `puppet.ts` plus tests. **Only worth building if the spike succeeds.**

Tasks:

- [ ] **T4.1 — Define the part split.** Which parts get their own animation
  (legs, head, tail, arms?) and which stay static. The existing baby rig has 8
  parts and is committed — start from it rather than inventing a new split.
- [ ] **T4.2 — Generate a legs-only animation** (walk cycle, legs only, no
  body), conditioned on the turnaround. This is the genuinely unproven step:
  an image model asked for a disembodied body part with a *stable anchor point*
  across frames is a harder ask than a whole character.
- [ ] **T4.3 — Generate a head-only animation** (e.g. a look-around or blink).
- [ ] **T4.4 — Wire the spike** using the `visible`-stepping hack above; no
  studio code changes yet.
- [ ] **T4.5 — Bake and compare** against the Option A result from Stage 3.
- [ ] **T4.6 — Judge the two hard parts honestly:**
  (a) do generated part frames align on a consistent pivot, or does each frame
  shift the anchor? (b) does the merged result look like one character, or like
  parts sliding over each other — which is the failure mode that got the parts
  route rejected the first time?

**🚦 GATE 4** — owner decides: Option A, Option B, or a hybrid (e.g. full-body
generation for pose-heavy rows, parts for cyclic motion like walk/sway).

---

## Stage 5 — Consolidation

- [ ] **T5.1 — Record the decision** as an ADR if it changes the pipeline
  (a parts-based character pipeline would supersede the "full-character runs"
  statement in `dev-guardrails.md`).
- [ ] **T5.2 — Fix the docs** (T0.2) to match reality.
- [ ] **T5.3 — Derive the outfit route.** Deliberately kept coarse until now,
  because Gate 4 determines what an outfit task even *is*:
  - Option B wins → an outfit is a **rig part**; bake a body pass and an outfit
    pass, aligned by construction. Cheap per outfit.
  - Option A wins → an outfit must be **derived from baked frames** with a
    mechanical alignment test (storybook §5.2).
  Only the 5 Tier-1 outfits get planned in detail; Tier 2 stays a backlog list.
- [ ] **T5.4 — Re-scope the storybook batches** (B1–B7) against whichever
  approach won, and only then scale beyond the baby.

**🚦 GATE 5** — owner signs off on the production route for the remaining four
stages.

---

## Explicitly not in this list

- Generating anything for young-baby / teen / older-teen / adult. Locked behind
  Gate 5 by owner decision.
- Runtime wiring of any unlock (`stage-capabilities.ts`, `roam.ts`, the M4/P4
  character-map). This list produces assets; gating them is a separate WAVE-2
  concern.
- Multi-directional roaming — needs its own ADR (storybook §4.4).
- Tier-2 outfits — backlog until Gate 5.

## Open questions parked for later

- Does the turnaround need to be regenerated per stage, or can a younger stage
  be conditioned on the baby turnaround plus its own idle tile? Cheaper if yes;
  answerable only after Gate 3.
- Palette enforcement in ComfyUI (post-process quantization vs. prompt-level) —
  long-standing open item in `comfyui-avatar-generation.md`.
- Whether `SheetRow` should carry `loop: boolean` (storybook §3, D6).
