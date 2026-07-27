# Design gate — beaver-baby turnaround (reference sheet)

**Date:** 2026-07-27 · **Verdict: PASS** · **Asset:**
`assets-src/reference/turnaround/beaver-baby-turnaround.png` + `.json`

Evidence: [`baby-turnaround-contact.png`](baby-turnaround-contact.png) — all 8
views at 2× nearest-neighbor on a magenta backdrop (magenta so any transparency
hole is obvious).

## What this asset is

A build-time **model sheet**, not runtime art. Nothing under `src/` loads it.
It exists so later animation generations can be conditioned on one consistent
view of the character instead of on a single idle tile — the root cause behind
BL-7's body drift and BL-6/T3's rejected walk.

8 views on a 768×96 sheet, 96 px tiles: 5 generated (front, front-right, right,
back-right, back) + 3 mirrored (back-left, left, front-left). `fps: 0` marks it
as static.

## Checks

| Check | Result |
|---|---|
| One row, five distinct angles | PASS — no duplicated angle, back views show no face |
| Scale consistency across views | PASS — all five source bboxes exactly **813 px** tall (0 % deviation) |
| Common ground line | PASS — identical top (306) and foot line (1116) in the source |
| No green bleed onto the character | PASS — 0 green-dominant pixels on any figure |
| No drawn ground line / props / text | PASS — darkest image row **39 %** (figure outlines only); a drawn line reads ~95 %, which is what attempt 2 showed |
| No transparency holes | PASS — every view has opaque content (test-enforced) |
| Mirror contract | PASS — views 5/6/7 are byte-exact horizontal mirrors of 3/2/1 (test-enforced) |
| Stray fragments | FIXED — one 336 px detached blob beside the side view (0.12 % of that figure) removed by `dropStrayFragments`; everything else untouched |

## Known deviations

- **Background is `(30, 195, 55)`, not the repo-conventional `#00FF00`.**
  Cause: hardening the prompt dropped the hex from its English header.
  Harmless here — the colour is uniform (±5 across all four corners) and
  `chromaKeyGreen`'s test is relative (`g > 90 && g > r*1.3 && g > b*1.3`), so
  it keys cleanly without tuning. The hex belongs back in the template for the
  remaining four figures.
- **The character stands upright on two legs**, while the shipped baby sits and
  crawls on all fours. Deliberate (owner decision, 2026-07-27): the turnaround
  is a neutral model sheet for every stage, supplying character, colours and
  proportions — not pose. Consequence: every later animation prompt must state
  its own pose explicitly, or the baby will drift toward an upright adult.

## Reproduce

```bash
npm run assets:turnaround            # all figures
node scripts/gen-sprites/ingest-turnaround.mjs beaver-baby
```

Source dump (gitignored): `assets-src/comfyui/baby-turnaround/attempt-03.png`.
Attempt log and the winning prompt: [`../asset-production-todo.md`](../asset-production-todo.md).
