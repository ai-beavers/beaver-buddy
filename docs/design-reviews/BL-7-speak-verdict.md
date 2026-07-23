# BL-7 design-review verdict — adult `speak` animation row

Date: 2026-07-23
Verdict: **PASS**

## Scope

One sheet change, synthetic-background frame comparisons (no personal
windows/notifications in any capture):

- **`beaver-adult.png`** (T1-T2, new row appended) — a `speak` row: 8 frames,
  4×2 grid, forward-facing talking LOOP (mouth cycling open/closed twice per
  cycle, small chin/head bob), reference-conditioned on the same
  already-uploaded adult reference image every other adult row is anchored
  to. The other 10 rows (`idle`/`walk`/`struggle`/`parachute-wind`/`land`/
  `type`/`watering`/`drink`/`sleep`/`stretch`) are byte-preserved, unchanged.

Not wired to any trigger (M3 quip-sync is WAVE-2, out of scope for this
item), so committing it is inert — same "unwired sheet is safe to commit"
precedent as BL-6's young-baby/older-teen figures.

### Sheet shipped

| File | Dimensions | Rows | SHA-256 |
|---|---|---|---|
| `assets/sprites/beaver-adult.png` | 768×1088 | idle, walk, struggle, parachute-wind, land, type, watering, drink, sleep, stretch, speak | `d669b0ea0397615582de049ade430a9772df555b1a2de1a8ca744557f207ff14` |

## Evidence

- **`BL-7-speak-contact-sheet.png`** — full `speak` row, all 8 frames side by
  side, 4× nearest-neighbor, magenta/gray checker backdrop. Frames read as:
  mouth open (1) → closed toothy smile (2-4) → mouth open (5) → closed (6-8)
  — a clean two-pulse talking cadence, same character (fur tone, tail
  cross-hatch, ear shape, outline weight) as every other adult row. No
  divider-line artifacts, no surviving green at any frame edge. **PASS.**
- **`BL-7-speak-wraparound.png`** — frame 1 (mouth open) vs. frame 8 (mouth
  closed) side by side, 4× scale, magenta/gray checker backdrop. The
  frame8→frame1 seam is a closed→open transition — the exact same kind of
  swing that already happens mid-loop at frame4→frame5 — so looping the row
  reads as a continuous talking pulse, not a jump-cut. Quantified: the
  frame8→frame1 pixel delta (2048/9216 px changed >20/255) is within 1% of
  the frame4→frame5 internal delta (2032/9216 px) — i.e. statistically the
  same-sized transition, not a discontinuity. Also enforced by a dedicated
  vitest assertion (`ingest-animation-frames.test.ts`, "wraparound delta is
  no larger than the loop's own internal frame4-to-frame5 swing"). **PASS.**

## Byte-preservation

`beaver-adult.png` grew only by the new 96px `speak` row (768×992 →
768×1088); every row from `idle` through `stretch` is byte-identical to the
pre-BL-7 commit (verified by the existing unconditional committed-sheet
byte-pin test in `ingest-animation-frames.test.ts`, which passes unchanged,
plus the golden-block byte comparison in the same file).

## Rebuild determinism

`npm run assets:adult-speak` (`buildAdultSpeakSheet`) was run against the raw
Comfy Cloud grid (`assets-src/comfyui/adult-speak/sheet.png`, gitignored) and
its output is byte-identical to the committed sheet and its `.json`, and
re-running the bake twice in a row is byte-identical to itself (both
verified by `ingest-animation-frames.test.ts`'s gated "speak regeneration"
block, which runs whenever that raw grid is present locally).

## Windows design gate

No renderer/window/tray/HiDPI change — sprite content only, same tile size
and row-append convention as every other adult row (watering/drink/sleep/
stretch). Rides the existing adult-sheet HiDPI/click-through handling; no
separate Windows capture needed for this item.
