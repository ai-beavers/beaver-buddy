# BL-7 design-review verdict — adult `speak` animation row

Date: 2026-07-23
Verdict: **PASS** (redone after an initial **FAIL**; see history below)

## Scope

One sheet change, synthetic-background frame comparisons (no personal
windows/notifications in any capture):

- **`beaver-adult.png`** (T1-T2, new row appended) — a `speak` row: 8 frames,
  forward-facing talking LOOP (mouth cycling open/closed twice per cycle,
  body completely still). The other 10 rows (`idle`/`walk`/`struggle`/
  `parachute-wind`/`land`/`type`/`watering`/`drink`/`sleep`/`stretch`) are
  byte-preserved, unchanged.

Not wired to any trigger (M3 quip-sync is WAVE-2, out of scope for this
item), so committing it is inert — same "unwired sheet is safe to commit"
precedent as BL-6's young-baby/older-teen figures.

## History: initial FAIL and root cause

The first pass generated an 8-frame Comfy Cloud grid the same way as
watering/drink/sleep/stretch (reference-conditioned `GeminiImage2Node`, green
chroma-key). Review verdict: **FAIL** — the committed contact sheet showed
independently redrawn bodies per frame (tail flips sides around frames 6–8,
fur shading and pose shift throughout). At 8–12fps this reads as whole-body
flicker, not talking. The wraparound-only gate used at the time (comparing
the frame8→frame1 delta against the loop's own internal frame4→frame5 delta)
PASSED this broken art, because both deltas were inflated by the same
whole-body redraw — it measured "is the swing consistent," not "is only the
mouth moving," so it anchored on a discontinuity instead of catching it.

**Root cause**: each of the 8 grid cells is an independent generation;
nothing forces independent generations to hold an identical body pose.

**Fix**: every frame is now derived MECHANICALLY from the single
already-accepted, already-committed idle tile — no new generation, no
chroma-key, no grid. Only a small mouth-region bounding box
(`ADULT_SPEAK.mouthBox`: x 54–86, y 34–52 in the 96px tile) is patched with a
hand-authored open-mouth cavity + outline + teeth, colors resampled from the
idle tile's own nose/outline/tooth pixels (no new palette entries). The
"closed" state is the idle tile unmodified; the "open" state is the idle
tile with only that box patched. The row is
`open, closed, closed, closed, open, closed, closed, closed` — two shared
tiles, duplicated, not 8 separate renders. See `assets/STYLE.md` Provenance
for the full writeup.

### Sheet shipped

| File | Dimensions | Rows | SHA-256 |
|---|---|---|---|
| `assets/sprites/beaver-adult.png` | 768×1088 | idle, walk, struggle, parachute-wind, land, type, watering, drink, sleep, stretch, speak | `ac87c49af563e5ebe7e000c11edac0de01527657902ceacfb47fd9c07cbc315d` |

## Evidence

- **`BL-7-speak-contact-sheet.png`** — full `speak` row, all 8 frames side by
  side, 4× nearest-neighbor, magenta/gray checker backdrop. The body (tail
  side, fur shading, pose, ear shape) is now visually identical across every
  frame; only the mouth toggles open (frames 1, 5) vs. closed (frames 2-4,
  6-8). **PASS.**
- **`BL-7-speak-wraparound.png`** — frame 1 (mouth open) vs. frame 8 (mouth
  closed) side by side, 4× scale, magenta/gray checker backdrop. Same body,
  only the mouth differs — visibly the same kind of change as any other
  frame pair in the loop, not a body jump. Measured: only 217/9216 pixels
  (2.4%) differ between frame 1 and frame 8, all within the mouth box (down
  from 2048/9216, 22%, in the discarded grid attempt). **PASS.**

## The real invariant (replaces the wraparound-only gate that passed broken art)

`ingest-animation-frames.test.ts` now asserts, per adjacent frame pair
INCLUDING the 8→1 wraparound: every pixel OUTSIDE `ADULT_SPEAK.mouthBox` is
**byte-identical**, zero tolerance — not a delta threshold. This is provable
(not just eyeballed) precisely because every frame derives from one of two
shared base tiles that only differ inside that box. A second test confirms
the 6 "closed" frames are byte-identical to the committed idle tile itself.
Both pass. Body jitter is now structurally impossible, not just visually
absent this run.

## Byte-preservation

`beaver-adult.png`'s `speak` row occupies the same 96px slot as before
(768×1088, unchanged dimensions from the discarded attempt); every row from
`idle` through `stretch` remains byte-identical to the pre-BL-7 commit
(verified by the existing unconditional committed-sheet byte-pin test in
`ingest-animation-frames.test.ts`, which passes unchanged, plus the
golden-block byte comparison in the same file).

## Rebuild determinism

`npm run assets:adult-speak` (`buildAdultSpeakSheet`) reads only the
already-committed `beaver-adult.png`/`.json` (idle tile) — no gitignored
ComfyUI source dependency at all now, so its regeneration test runs
unconditionally (not gated) and always passes on a clean checkout: rebuild
output is byte-identical to the committed sheet and its `.json`, and
re-running the bake twice in a row is byte-identical to itself.

## Windows design gate

No renderer/window/tray/HiDPI change — sprite content only, same tile size
and row-append convention as every other adult row (watering/drink/sleep/
stretch). Rides the existing adult-sheet HiDPI/click-through handling; no
separate Windows capture needed for this item.
