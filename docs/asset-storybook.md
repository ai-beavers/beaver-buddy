# Asset Storybook — levels, animations, turnarounds, outfits (L1–L32)

The production plan for **every character asset up to level 32**: which
animation unlocks at which level, which 360° turnaround sheets serve as the
character template for generation, and which costumes/outfits get generated on
top.

**Status: PROPOSAL — awaiting owner sign-off.** Every table marked
`⚠ decision` is a proposal, not a decision. Nothing here overrides
[`assets/STYLE.md`](../assets/STYLE.md) (binding style + provenance),
[`docs/asset-gallery.md`](asset-gallery.md) (the registration index), or the
XP curve in `src/main/xp/curve.ts` (the one source of truth for levels).

Related: [`asset-production-todo.md`](asset-production-todo.md) (**the live,
sequential work queue** — start there),
[`animation-authoring.md`](animation-authoring.md) (how to generate),
[`dev-guardrails.md`](dev-guardrails.md) (traps), `.planning/ROADMAP.md` (M5
phase order).

---

## 1. Ground truth we build on

These are **facts from the codebase**, not proposals — the plan below is
constrained by them.

### 1.1 Level → stage mapping

Source: `src/main/xp/curve.ts` (`STAGE_ANCHORS`, `LEVEL_XP_THRESHOLDS`).

| Stage | Levels | Cumulative XP at stage entry | Sheet |
|---|---|---|---|
| `baby` | L1–L4 | 0 | `assets/sprites/beaver-baby.png` |
| `young-baby` | L5–L8 | 2 930 | `assets/sprites/beaver-young-baby.png` |
| `teen` | L9–L16 | 9 492 | `assets/sprites/beaver-teen.png` |
| `older-teen` | L17–L24 | 33 867 | `assets/sprites/beaver-older-teen.png` |
| `adult` | L25–L32 | 73 242 | `assets/sprites/beaver-adult.png` |

L32 = 120 000 XP total. At the calibrated reference rate (≈400k tokens/day ×
5 XP per 1k tokens ≈ 2 000 XP/day) that is **~60 days to L32**, with the adult
stage reached around **day 37**. The curve is *not* capped at 32 — L33+ keeps
using the quadratic formula. This document deliberately stops at L32: beyond
it, no new art unlocks (see §6.4 prestige note).

### 1.2 What already exists

| Sheet | Rows shipped |
|---|---|
| `beaver-baby` | `idle(1) walk(2) struggle(8) parachute-wind(8) land(8)` |
| `beaver-young-baby` | `idle(1) walk(2)` |
| `beaver-teen` | `idle(1) walk(2)` |
| `beaver-older-teen` | `idle(1) walk(2)` |
| `beaver-adult` | `idle walk struggle parachute-wind land type watering drink sleep stretch speak throw-stick collect-sticks exercise brainrot wave flush toilet` (18 rows) |
| `tree-stage-{1,2,3}` | `sway(12)` each |
| `lodge` | `idle(1) shake(3) burst(3) spark(4)` |

**The gap in one sentence:** the adult stage is animation-rich, the four
younger stages are nearly empty — three of five stages ship only `idle`+`walk`.

### 1.3 Hard technical constraints

- **Tile:** 96×96 px, fps hint 8, sheet width = 8 tiles (768 px) for 8-frame
  rows. Taller rows use `SheetRow.height` (128 px precedent:
  `parachute-wind`, `exercise`, `toilet`) and `drawFrame` bottom-anchors them
  to the shared ground line.
- **Right-facing only.** All shipped rows are authored right-facing; the
  renderer mirrors for left movement. Mixing a left-facing frame into a row
  produces a flip-flopping walk (`assets/STYLE.md` → Facing & mirroring).
  **The turnaround sheets in §4 do not change this** — they are generation
  references, not runtime rows.
- **Scale trap:** `computeStageScale` locks ONE scale per row from the
  widest+tallest frame. A wide prop (log, watering can, toilet tank) shrinks
  the whole row. Budget a taller `rowHeight` *before* generating, not after.
- **The logical footprint stays 96 px** (roam bounds, click-through hit-box)
  even when a row is visually taller.

---

## 2. The unlock ladder (L1 → L32) ⚠ decision

Design rules behind the ladder:

1. **Every level unlocks something visible.** A level-up that changes nothing
   on screen reads as a broken progress bar.
2. **Unlocks are cumulative and never regress.** A row available at L10 stays
   available at L32. `stageForLevel` is monotonic — the unlock set must be too.
3. **Stage transitions (L5/L9/L17/L25) carry the stage art itself**, not a new
   behaviour. Changing body *and* behaviour in the same level-up buries the
   evolution moment.
4. **Every stage owns a complete "daily loop"**: idle, walk, sleep, stretch,
   speak. Nothing above that is required for the app to feel alive.
5. **Props escalate with age.** Baby beavers do not operate laptops or
   toilets; adult beavers do.

Legend: `NEW` = animation row that must be generated · `ART` = stage body art ·
`COSM` = cosmetic/outfit (§5) · `FX` = renderer effect, no sprite row.

### 2.1 Baby — L1–L4

| Lvl | XP | Unlock | Kind | Sheet row | Exists? |
|---|---|---|---|---|---|
| 1 | 0 | Hatch from the lodge, `idle` + `walk` roaming | ART | `idle(1) walk(2)` | ✅ |
| 2 | 469 | Grab & parachute drop (`struggle` → `parachute-wind` → `land`) | NEW | 3 rows | ✅ |
| 3 | 1 055 | `sleep` — curls up when the machine idles | NEW | `sleep(8)` | ❌ |
| 4 | 1 875 | `speak` — quip bubbles get a talking mouth | NEW | `speak(8)` | ❌ |

### 2.2 Young baby — L5–L8

| Lvl | XP | Unlock | Kind | Sheet row | Exists? |
|---|---|---|---|---|---|
| 5 | 2 930 | **Evolution → young baby** (full body art) | ART | `idle(1) walk(2)` | ✅ |
| 6 | 4 219 | Grab & parachute drop carried over to the new body | NEW | 3 rows | ❌ |
| 7 | 5 742 | `sleep` + `stretch` (wake-up one-shot) | NEW | 2 rows | ❌ |
| 8 | 7 500 | `speak` + `drink` (first prop: mug) | NEW | 2 rows | ❌ |

### 2.3 Teen — L9–L16

| Lvl | XP | Unlock | Kind | Sheet row | Exists? |
|---|---|---|---|---|---|
| 9 | 9 492 | **Evolution → teen** (full body art) | ART | `idle(1) walk(2)` | ✅ |
| 10 | 11 719 | Grab & parachute drop | NEW | 3 rows | ❌ |
| 11 | 14 180 | Daily loop: `sleep`, `stretch`, `speak` | NEW | 3 rows | ❌ |
| 12 | 16 875 | `type` — sits and codes on a laptop while you code | NEW | `type(8)` | ❌ |
| 13 | 19 805 | `drink` (mug) | NEW | `drink(8)` | ❌ |
| 14 | 22 969 | `collect-sticks` — one-shot gather | NEW | `collect-sticks(8)` | ❌ |
| 15 | 26 367 | `throw-stick` — one-shot throw | NEW | `throw-stick(8)` | ❌ |
| 16 | 30 000 | **Tree stage 1** planted + `watering` | NEW + FX | `watering(8)` + `tree-stage-1` | tree ✅ / row ❌ |

### 2.4 Older teen — L17–L24

| Lvl | XP | Unlock | Kind | Sheet row | Exists? |
|---|---|---|---|---|---|
| 17 | 33 867 | **Evolution → older teen** (full body art) | ART | `idle(1) walk(2)` | ✅ |
| 18 | 37 969 | Grab & parachute drop | NEW | 3 rows | ❌ |
| 19 | 42 305 | Daily loop: `sleep`, `stretch`, `speak` | NEW | 3 rows | ❌ |
| 20 | 46 875 | `type` + `drink` | NEW | 2 rows | ❌ |
| 21 | 51 680 | `exercise` — log lift, two reps | NEW | `exercise(8)` @128px | ❌ |
| 22 | 56 719 | `brainrot` — glazed phone scroll | NEW | `brainrot(8)` | ❌ |
| 23 | 61 992 | `wave` — greets you on session start | NEW | `wave(8)` | ❌ |
| 24 | 67 500 | **Tree stage 2** + `watering` carried over | NEW + FX | `watering(8)` + `tree-stage-2` | tree ✅ / row ❌ |

### 2.5 Adult — L25–L32

The adult stage already owns 18 rows. Its ladder is therefore mostly
**gating what exists** plus a small set of genuinely new "mastery" assets.

| Lvl | XP | Unlock | Kind | Sheet row | Exists? |
|---|---|---|---|---|---|
| 25 | 73 242 | **Evolution → adult** — full 18-row set goes live | ART | all shipped rows | ✅ |
| 26 | 79 219 | `flush` gag + `toilet` full routine | — | `flush(8) toilet(8)` | ✅ |
| 27 | 85 430 | **Tree stage 3** (fully grown) | FX | `tree-stage-3` | ✅ |
| 28 | 91 875 | `read` — glasses + book (easter-egg idea, NOTE.md) | NEW | `read(8)` | ❌ |
| 29 | 98 555 | `meeting` — speech/presentation pose (M5/P11, #18) | NEW | `meeting(8)` | ❌ |
| 30 | 105 469 | `sports` variant #2 (M5/P7, #13) — e.g. push-ups | NEW | `sports(8)` | ❌ |
| 31 | 112 617 | `angry` — reacts to repeated clicking (easter egg) | NEW | `angry(8)` | ❌ |
| 32 | 120 000 | **Golden hard hat** — the L32 badge cosmetic | COSM | overlay layer | ❌ |

### 2.6 Unlock summary

| Stage | Rows at stage entry | Rows at stage exit | New rows to generate |
|---|---|---|---|
| baby | 2 | 7 | 2 (`sleep`, `speak`) |
| young baby | 2 | 9 | 7 |
| teen | 2 | 13 | 11 |
| older teen | 2 | 14 | 12 |
| adult | 18 | 22 | 4 + 1 cosmetic |

**Total new animation rows to reach the L32 plan: 36** (+ 5 turnarounds §4,
+ outfits §5).

---

## 3. Animation catalog — the canonical row vocabulary

One name = one meaning across every stage. A row name must never mean
different things on two sheets.

| Row | Type | Frames | Row height | Meaning | Stages planned |
|---|---|---|---|---|---|
| `idle` | pose | 1 | 96 | standing rest pose | all 5 |
| `walk` | loop | 2 | 96 | side-profile step cycle | all 5 |
| `struggle` | loop | 8 | 96 | grabbed, kicking | all 5 |
| `parachute-wind` | loop | 8 | **128** | canopy glide | all 5 |
| `land` | one-shot | 8 | 96 | touchdown → idle | all 5 |
| `sleep` | loop | 8 | 96 | curled up, zzz pulse | all 5 |
| `stretch` | one-shot | 8 | 96 | wake-up → idle | young-baby+ |
| `speak` | loop | 8 | 96 | forward-facing, mouth cycles | all 5 |
| `drink` | loop | 8 | 96 | mug lift, sip, steam | young-baby+ |
| `type` | loop | 8 | 96 | sits, codes on a laptop | teen+ |
| `watering` | loop | 8 | 96 | watering-can pour | teen+ |
| `collect-sticks` | one-shot | 8 | 96 | gathers a bundle, non-idle end pose | teen+ |
| `throw-stick` | one-shot | 8 | 96 | winds up, throws, settles | teen+ |
| `exercise` | loop | 8 | **128** | short-log overhead lift, 2 reps | older-teen+ |
| `brainrot` | loop | 8 | 96 | glazed phone scroll | older-teen+ |
| `wave` | loop | 8 | 96 | wave-goodbye, ~2 cycles | older-teen+ |
| `flush` | one-shot | 8 | 96 | flush gag, no toilet prop | adult |
| `toilet` | one-shot | 8 | **128** | full routine incl. sweep wave | adult |
| `read` | loop | 8 | 96 | glasses + book, page turn | adult ⚠ new |
| `meeting` | loop | 8 | 96 | presenting/speech pose | adult ⚠ new |
| `sports` | loop | 8 | 96 | second workout (push-ups) | adult ⚠ new |
| `angry` | one-shot | 8 | 96 | click-spam reaction | adult ⚠ new |

**Loop vs one-shot is not encoded in `<sheet>.json`** — it is runtime
knowledge. Keep this table as the reference until a `loop: boolean` field is
added to `SheetRow` (⚠ decision, cheap and backward-compatible).

### 3.1 Per-stage row matrix

`✅` shipped · `▢` planned · `—` not planned for this stage.

| Row | baby | young baby | teen | older teen | adult |
|---|---|---|---|---|---|
| `idle` / `walk` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `struggle` / `parachute-wind` / `land` | ✅ | ▢ | ▢ | ▢ | ✅ |
| `sleep` | ▢ | ▢ | ▢ | ▢ | ✅ |
| `stretch` | — | ▢ | ▢ | ▢ | ✅ |
| `speak` | ▢ | ▢ | ▢ | ▢ | ✅ |
| `drink` | — | ▢ | ▢ | ▢ | ✅ |
| `type` | — | — | ▢ | ▢ | ✅ |
| `watering` | — | — | ▢ | ▢ | ✅ |
| `collect-sticks` / `throw-stick` | — | — | ▢ | ▢ | ✅ |
| `exercise` | — | — | — | ▢ | ✅ |
| `brainrot` | — | — | — | ▢ | ✅ |
| `wave` | — | — | — | ▢ | ✅ |
| `flush` / `toilet` | — | — | — | — | ✅ |
| `read` / `meeting` / `sports` / `angry` | — | — | — | — | ▢ |

---

## 4. 360° turnaround sheets — the character template

### 4.1 What problem this solves

Every generated row so far was reference-conditioned on **one committed tile**
(usually adult `idle`). That works for side-profile actions and has already
failed twice for forward-facing ones (the BL-7 `speak` grid drifted body/tail/
shading; BL-6/T3's front-facing walk didn't read as walking and was reverted).
The root cause both times: the model had to *invent* the unseen sides of the
character.

A **turnaround sheet** — the same beaver seen from every direction, in one
consistent pose and lighting — is the standard fix. It becomes the reference
image bundle for every future generation, for every stage.

### 4.2 View set ⚠ decision

**8 compass directions, 5 authored + 3 mirrored.**

| Index | View | Compass | How produced |
|---|---|---|---|
| 0 | front | S | authored |
| 1 | three-quarter front-right | SE | authored |
| 2 | side right | E | authored |
| 3 | three-quarter back-right | NE | authored |
| 4 | back | N | authored |
| 5 | three-quarter back-left | NW | **mirror of 3** |
| 6 | side left | W | **mirror of 2** |
| 7 | three-quarter front-left | SW | **mirror of 1** |

Mirroring the left half is deliberate: it costs nothing, it is pixel-exact by
construction, and it matches the renderer's own left-facing convention. It
also removes the class of bug where a generated left view drifts from the
right one.

### 4.3 File layout

```
assets-src/reference/turnaround/beaver-<stage>-turnaround.png   (committed)
assets-src/reference/turnaround/beaver-<stage>-turnaround.json  (committed)
```

- 96×96 tiles, **8 columns × 1 row** → 768×96 sheet, identical geometry to a
  normal animation row so the existing ingest/crop code applies unchanged.
- Manifest mirrors the sheet-meta shape with one extra field:

```json
{
  "tile": 96,
  "fps": 0,
  "sheetWidth": 768,
  "sheetHeight": 96,
  "rows": [{ "name": "turnaround", "frames": 8 }],
  "views": ["front", "front-right", "right", "back-right",
            "back", "back-left", "left", "front-left"],
  "mirrored": [5, 6, 7]
}
```

- `fps: 0` marks it as a non-animated reference sheet.
- **These live under `assets-src/reference/`, not `assets/sprites/`.** They are
  build-time references. Nothing in `src/` loads them, so they cannot break the
  overlay, and `assets/sprites/` keeps meaning "shipped runtime art".

### 4.4 Runtime use — explicitly out of scope for now

Multi-directional roaming (the beaver actually walking toward the viewer) would
require per-direction `walk` rows and a facing model in `roam.ts`. That is a
**renderer-architecture change and needs its own ADR** — it is not unlocked by
producing turnaround sheets. This document produces the templates only.

### 4.5 Generation recipe

Per stage, one generation, 8 cells is wrong — generate **5 cells (0–4) in one
image**, then mirror. Constraints, all learned the hard way:

- Green `#00FF00` chroma-key background, **no divider lines between cells**
  (BL-4/BL-8: a seam touching a cell edge poisons `cropToBbox`).
- Pin the layout explicitly ("5 columns × 1 row, landscape") — BL-4 came back
  transposed when the orientation wasn't pinned.
- Reference-condition on the stage's own committed `idle` tile, plus the adult
  turnaround once it exists (dual conditioning, BL-5 precedent).
- Identical pose, lighting, and scale in all 5 cells — that is the entire point
  of the sheet. Reject and regenerate on any drift; do not "fix it in ingest".
- Expect RGB output from `partner_generate` → normalize to RGBA before ingest
  (`decodePng` only accepts `colorType 6`).

### 4.6 Build order

**Baby first (owner decision, 2026-07-27), and baby only** until the whole
approach is verified end-to-end — see
[`asset-production-todo.md`](asset-production-todo.md).

The original proposal here was adult-first (richest accepted art to condition
on). The owner overrode it: the baby turnaround doubles as the test subject for
the two competing animation routes (full-character vs. parts + puppet studio),
so verifying the approach on one cheap stage beats optimizing the reference
quality of a route we have not yet chosen.

Once the route is settled, the remaining four run as a lineage — each
conditioned on its neighbour so all five read as one character growing, the
same trick that made the three tree stages consistent.

---

## 5. Costumes & outfits

### 5.1 Architecture decision ⚠ decision — read this first

There are two ways to ship an outfit, and the wrong one is unshippable:

| | Baked variants | **Overlay layer (recommended)** |
|---|---|---|
| How | regenerate every row wearing the outfit | separate transparent sheet, drawn on top of the same frame rect |
| Cost for 12 outfits | 12 × 5 stages × ~15 rows ≈ **900 rows** | 12 × 5 stages × N *visible* rows |
| Consistency risk | every regeneration can drift the character | body pixels never change |
| Combinability | one outfit at a time | hat + glasses + cape stack |
| Renderer change | none | one extra `drawFrame` with the same `frameRect` |

**Recommendation: overlay layers.** The renderer change is a handful of lines
(`drawFrame` already takes an explicit sheet and scale; an outfit sheet is just
a second sheet with identical row/frame geometry). The combinatorial math makes
baked variants impossible at this scale.

Consequence for the pipeline: an outfit sheet must be **row- and
frame-aligned** with its stage sheet — same row names, same frame counts, same
tile geometry, transparent everywhere the outfit isn't. Generation must
therefore derive the outfit *from the baked stage frames*, not from an
independent prompt.

### 5.2 File layout

```
assets/sprites/outfits/<outfit>-<stage>.png    # runtime overlay sheet
assets/sprites/outfits/<outfit>-<stage>.json   # row manifest, mirrors the stage sheet
```

Manifest gains one field: `"base": "beaver-adult"` — the sheet it must align
with. A validation test (⚠ new, cheap) should assert that every outfit sheet's
row names/frame counts/heights match its base exactly. Misalignment shows up as
a hat floating next to the head, which no design gate should have to catch by
eye.

### 5.3 Slot model ⚠ decision

Three stackable slots, at most one item each:

| Slot | Covers | Draw order |
|---|---|---|
| `body` | torso/full-body garments | below head slot |
| `head` | hats, helmets, hair | above body |
| `face` | glasses, masks | topmost |

Handheld props are **not** a slot — they belong to the animation row itself
(the mug in `drink`, the log in `exercise`), because they move with the pose.

### 5.4 Outfit catalog ⚠ decision

Tier 1 = build first (needed by the L32 ladder or by an existing feature).
Tier 2 = seasonal/cosmetic backlog, post-Cycle-1 per the monetization note in
`.planning/NOTE.md`.

| # | Outfit | Slot | Tier | Unlock | Rationale |
|---|---|---|---|---|---|
| 1 | Golden hard hat | head | 1 | **L32** | the max-level badge (§2.5) |
| 2 | Reading glasses | face | 1 | L28 with `read` | the glasses+book easter egg |
| 3 | Builder hard hat + hi-vis | body+head | 1 | L16 | matches the dam/sticks theme |
| 4 | Dev hoodie | body | 1 | L12 with `type` | the coding identity |
| 5 | Headphones | head | 1 | L22 | pairs with `brainrot` |
| 6 | Sunglasses | face | 2 | cosmetic | cheapest possible overlay |
| 7 | Winter scarf + beanie | body+head | 2 | seasonal | December |
| 8 | Party hat | head | 2 | anniversary | first-launch anniversary |
| 9 | Raincoat | body | 2 | cosmetic | reads well at 96 px |
| 10 | Superhero cape | body | 2 | cosmetic | animates with `walk` — costlier |
| 11 | Lab coat | body | 2 | cosmetic | pairs with glasses |
| 12 | Wizard hat + robe | body+head | 2 | cosmetic | high silhouette contrast |

**Silhouette rule for outfits:** at 96 px an outfit only reads if it changes
the *silhouette* or a large color block. Subtle texture is invisible. Rank
candidates by silhouette impact before spending a generation on them.

### 5.5 Coverage scope per outfit

An outfit does **not** need every row on day one. Minimum viable coverage:

| Coverage | Rows | Use |
|---|---|---|
| Minimal | `idle`, `walk` | cosmetics, Tier 2 |
| Standard | + `speak`, `sleep`, `stretch` | Tier 1 |
| Full | every row of the base sheet | only if an outfit becomes default |

The renderer must **fall back to no-overlay** on a row the outfit doesn't
cover, rather than drawing a mismatched frame. Encode covered rows in the
outfit manifest; anything absent = not drawn.

---

## 6. Production plan

### 6.0 Regeneration campaign — scope and sequencing (owner, 2026-07-27)

**Every existing character row is regenerated, not just the missing ones.** The
shipped rows were produced over many sessions from different references and do
not read as one consistent character; the turnaround pipeline exists to fix
exactly that. This supersedes the earlier assumption that shipped art stays.

**One figure at a time, completed before the next starts.** All of the baby's
animations are planned first (§6.0.1), then generated sequentially, and only
when the baby is finished does the next age stage begin. No parallel work
across figures — a wrong call in a figure's base would otherwise propagate into
work already done elsewhere.

Inventory to regenerate: **29 existing rows** — baby 5, young-baby 2, teen 2,
older-teen 2, adult 18 — plus the planned new rows and four more turnarounds.

**Not decided yet:** whether the lodge and the three tree stages are in scope.
They are not characters, the lodge is the only remaining fully palette-bound,
deterministically reproducible asset, and the trees are their own consistent
lineage. Parked until the beaver figures are done.

**Order within a figure is forced by the reference chain.** Nearly every row is
conditioned on the figure's committed idle tile, so: turnaround → idle → walk →
everything else. Mixing rows built on the old base with rows built on the new
one reproduces the very inconsistency this campaign removes.

**Carry the hard-won fixes forward.** Regenerating does not re-solve these for
free — each is documented in `assets/STYLE.md` and must be applied again:
`exercise` and `toilet` need a 128 px `rowHeight` or the scale lock shrinks the
whole row; `brainrot` and `wave` are only usable because `frameOrder`
ping-pongs their body-consistent half; `speak` must NOT be generated at all
(see §6.0.1).

**Byte-pin tests will fail, by design.** `ingest-animation-frames.test.ts` pins
the committed tiles byte-for-byte because a placeholder script once clobbered
eight finished rows. Re-pin deliberately, row by row after acceptance — never
blanket-delete the pins.

**Branch model:** one long-lived integration branch for the campaign, with a
sub-branch per figure. A figure's sub-branch carries several commits (one per
animation or small group), and merges into the campaign branch when that figure
is complete.

#### 6.0.1 Baby — complete animation plan

The baby stage is L1–L4 ≈ **1.5 days** of exposure at the calibrated rate, but
it is also the stage *every* user sees. Scope is set accordingly: complete
daily loop, nothing decorative.

| # | Row | Frames | Type | Status | Runtime today | Notes |
|---|---|---|---|---|---|---|
| 1 | `idle` | 1 | pose | regenerate | ✅ active | sitting pose — the anchor every other row conditions on. Do this one first and accept it before anything else runs. |
| 2 | `walk` | **8** | loop | regenerate | ✅ active | quadruped crawl, side view, right-facing. **Upgraded from 2 frames** (owner, 2026-07-27): the sprite-sheet workflow emits 8 cells anyway, the sheet is already 8 tiles wide, and `SheetRow.frames` is per-row — so a full cycle costs nothing over two poses ping-ponging. Step frames only, never the idle pose in a walk row. |
| 3 | `struggle` | 8 | loop | regenerate | ✅ active | grabbed, kicking |
| 4 | `parachute-wind` | 8 | loop | regenerate | ✅ active | 128 px row — canopy extends upward, feet stay on the ground line |
| 5 | `land` | 8 | one-shot | regenerate | ✅ active | touchdown → settles into `idle` |
| 6 | `sleep` | 8 | loop | **new** | ❌ art only | curled up, gentle breathing, pulsing zzz that grow 1→4 and shrink 5→8 so the 8→1 seam reads as a continuous pulse |
| 7 | `stretch` | 8 | one-shot | **new** | ❌ art only | wake-up. Frame 1 continuous with the sleep pose, frame 8 with `idle`. Added to the baby (the ladder had it at young-baby+): shipping `sleep` without it means the baby snaps from curled-up to idle in one frame. |
| 8 | `speak` | 8 | loop | **new, NOT generated** | ❌ art only | mouth open/closed cycle — built mechanically, see below |

**`speak` is built, not generated.** The adult's first attempt at this row was
an 8-cell AI grid and it failed the design gate: independent cells do not agree
on body pose, tail side or shading, so the row read as whole-body flicker
rather than a talking mouth. The shipped solution patches a small mouth-region
box onto the accepted `idle` tile, resampling colours from the tile's own nose,
outline and tooth pixels — every pixel outside that box is byte-identical
across all 8 frames *by construction*, and a zero-tolerance test enforces it.
The baby reuses that builder against its own accepted `idle`. No Comfy run, no
credits, no flicker risk.

**Every prompt must state its own pose.** The turnaround is a standing model
sheet supplying character, colours and proportions — never posture. The baby
sits and crawls; a row that does not say so will drift toward an upright adult.

**Sequence:** `idle` → accept → `walk` → `struggle`/`parachute-wind`/`land` →
`sleep` → `stretch` → `speak` (mechanical). Rows 6–8 have no runtime state yet
(`roam.ts` knows six animation names today); they ship as WAVE-1 art, wired
later.

**Generation route (owner, 2026-07-27):** animation rows use the saved
`pixelart-builder` workflow — `LoadImage` → `GeminiNanoBanana2` →
`BiRefNetRMBG` (learned matting, alpha out) → dynamic cell math → 8 cropped
frames + the full sheet + an 8 fps GIF and WebP. Two consequences worth
knowing: the **8 fps GIF falls out for free**, which is exactly the temporal
evidence the design gate demands (a static contact sheet cannot show flicker —
how the first adult `speak` row slipped through); and the frames arrive
**already alpha-cut**, so the ingest runs `preKeyed: true` and does not
chroma-key at all.

Backgrounds: the **green** turnaround goes in as the reference image, the
workflow generates on **white** and BiRefNet cuts it out. The
white-eats-white-detail warning in `docs/dev-guardrails.md` applies to our own
naive border flood-fill, not to a learned matting model.

**Open cleanup:** `idle` was generated with a throwaway minimal graph before
this route was chosen, so it is the one row that did not come through
`pixelart-builder`. Accepted for now as the conditioning anchor; re-do it on
the common route when convenient (and decide then whether it becomes an 8-frame
breathing loop instead of a static pose).

### 6.1 Batches

Ordered so that each batch unblocks the next (turnarounds first — everything
downstream conditions on them).

> **Superseded by §6.0 (owner, 2026-07-27).** The batch table below was written
> for an "add the missing rows" plan. The campaign is now "regenerate
> everything, one figure at a time", so the batches survive only as a map of
> *what* each figure eventually needs — not as the work queue. The live queue
> is [`asset-production-todo.md`](asset-production-todo.md), and the baby's
> complete list is §6.0.1. The baby turnaround (B0, done) also doubles as the
> test subject for choosing between the full-character and parts-based
> animation routes.

| Batch | Content | Output | Blocks |
|---|---|---|---|
| **B0** | turnaround sheets (§4) — **baby first and alone**, remaining 4 as a lineage after the route decision | 5 reference sheets | everything |
| **B1** | Baby `sleep`, `speak` | 2 rows | L3, L4 |
| **B2** | Young-baby full set: parachute×3, `sleep`, `stretch`, `speak`, `drink` | 7 rows | L6–L8 |
| **B3** | Teen full set: parachute×3, `sleep`, `stretch`, `speak`, `type`, `drink`, `collect-sticks`, `throw-stick`, `watering` | 11 rows | L10–L16 |
| **B4** | Older-teen full set: B3 minus sticks, plus `exercise`, `brainrot`, `wave` | 12 rows | L18–L24 |
| **B5** | Adult mastery rows: `read`, `meeting`, `sports`, `angry` | 4 rows | L28–L31 |
| **B6** | Tier-1 outfits (5 × standard coverage) | 5 overlay sheets ×  stages | L12/16/22/28/32 |
| **B7** | Tier-2 outfits (7) | backlog | post-Cycle-1 |

Batch sizes are deliberately per-stage, not per-animation: one generation
session conditioned on one turnaround produces a whole stage's set far more
consistently than 12 sessions weeks apart.

### 6.2 Effort estimate

| Batch | Generations | Notes |
|---|---|---|
| B0 | 5 | +regeneration budget: turnarounds are the highest-stakes asset here |
| B1–B4 | 32 rows | historical rate: ~1.4 generation attempts per accepted row |
| B5 | 4 | new poses, expect 2 attempts each |
| B6 | ~25 sheets | derived mechanically from baked frames, not free-generated |

Against M5's "~1 week per animation" convention, batching by stage should
compress B1–B4 substantially — the expensive part has consistently been
*consistency*, and one shared turnaround reference is the lever on it.

### 6.3 Per-asset definition of done

Unchanged from the existing pipeline, restated so a build item can copy it:

1. Generated per §4.5 constraints (chroma key, no dividers, pinned layout,
   reference-conditioned).
2. Ingested through `scripts/gen-sprites/ingest-animation-frames.mjs` — never
   hand-placed into `assets/sprites/`.
3. Byte-preserving append: every earlier row of the sheet unchanged (the pin
   test in `ingest-animation-frames.test.ts` enforces this).
4. Contact sheet **and** an 8 fps GIF under `docs/design-reviews/` — a static
   contact sheet cannot catch temporal flicker (BL-7).
5. Loop rows: frame N→1 wraparound checked. One-shots: frame 1 continuous with
   the entry pose, frame 8 with the exit pose.
6. Verdict file `docs/design-reviews/<item>-verdict.md`.
7. Registered in [`asset-gallery.md`](asset-gallery.md), provenance in
   [`assets/STYLE.md`](../assets/STYLE.md).

### 6.4 What this plan deliberately excludes

- **L33+ art.** The XP curve continues past 32; the *art* does not. Prestige
  (`.planning/NOTE.md`: back to L1 with stars/seasonal content) is the intended
  answer and is post-Cycle-1.
- **Multi-directional roaming** (§4.4) — needs an ADR.
- **The full-screen wall-of-water** toilet sweep — deferred WAVE-2 runtime
  effect, already scoped out in `assets/STYLE.md`.
- **Runtime wiring.** Every unlock in §2 needs a WAVE-2 runtime item
  (`stage-capabilities.ts`, `roam.ts`, the character-map JSON in M4/P4). This
  document is the asset plan; it does not implement gating.

---

## 7. Open decisions for the owner

| # | Decision | Proposal | Impact if changed |
|---|---|---|---|
| D1 | Unlock ladder §2 | as tabled | reorders batches, not their content |
| D2 | Turnaround = 5 authored + 3 mirrored | yes | 8 authored costs ~60% more and risks left/right drift |
| D3 | Turnarounds live in `assets-src/reference/` | yes | putting them in `assets/sprites/` implies runtime use |
| D4 | Outfits as overlay layers, not baked variants | overlay | baked = ~900 rows, effectively unshippable |
| D5 | Three outfit slots (`body`/`head`/`face`) | yes | fewer slots = no stacking; more = draw-order complexity |
| D6 | Add `loop: boolean` to `SheetRow` | yes | otherwise loop/one-shot stays tribal knowledge |
| D7 | Add an outfit↔base alignment test | yes | misalignment is a class of bug the eye catches late |
| D8 | Adult mastery rows `read`/`meeting`/`sports`/`angry` at L28–31 | yes | alternative: stop new art at L27 and make L28–32 cosmetic-only |
| D9 | Lodge + tree stages in the regeneration campaign? | **open** | parked until the five beaver figures are done (§6.0) |

**Decided since (2026-07-27):** regenerate every existing character row, one
figure at a time, baby first and complete before the next stage — §6.0.
Turnarounds are standing model sheets for every figure; pose comes from each
row's own prompt.
