# BL-19 design-review verdict — "sit and type on a laptop" animation

Date: 2026-07-21
Verdict: **PASS with one documented limitation**

## Scope

Add a low-probability "working" easter egg: while roaming, the beaver
occasionally stops, sits where it is, and frantically types on a small laptop
(the typing-cat meme) for a while, then resumes roaming. Two halves:

1. **State machine** (`src/renderer/roam.ts`) — a new stationary `working`
   phase / `type` anim, triggered from `decideNext` when an idle pause ends.
2. **Asset** — an 8-frame `type` row appended to the adult sprite sheet.

MVP per the owner handoff: no sit/open/close/stand transition frames — the
beaver snaps into the type loop and back to idle. Transition frames are later
polish.

## State machine

- `decideNext` rolls the work chance first (`WORK_PROBABILITY = 0.05`); on a
  win it enters `working` with `anim = 'type'`, leaving x/y untouched (it sits
  where it was idling — a stationary state) and a `pickWorkDuration()` timer
  (`WORK_DURATION_MIN_S..MAX_S` = 8–16s, the long "epic" loop).
- The `working` tick counts the timer down, then drops back to `idle`; normal
  walk/climb roaming resumes from there.
- `working` is included in `isRoamingPhase`, so the beaver can still be grabbed
  mid-type (a playful interruption) and click-window bookkeeping keeps ticking.
- Overlay invariants unaffected: it's a pure logical state change, no new
  window/level/click-through behavior; still bottom-aligned on the ground line.

Tuning lives in `src/renderer/pet-config.ts` (no magic numbers in `roam.ts`).
Covered by `src/renderer/roam.test.ts` (enters on a winning roll, stays put for
the whole loop then returns to idle, grabbable mid-type) plus the existing
anim-matches-phase sweep extended for `working → type`.

## Sheet intake

`scripts/gen-sprites/ingest-typing.mjs` (`npm run assets:typing`, or
`npm run assets:adult` for the full placeholder-then-type build). idle/walk
come from `buildAdultPlaceholder()` (byte-for-byte, teen-derived placeholder);
only the `type` row is generated. No beaver pixels authored or retouched.

Source: one Comfy Cloud run (Gemini Nano Banana, prompt_id `b99d59bf`) — the
beaver alone holding a small laptop, typing, on a solid `#00FF00` chroma-key
background. The model emits an irregular **6×4** grid of near-identical frames;
8 uniform typing frames from the top two rows (all holding the laptop, both
eyes open, calm face) are hand-picked. Raw sheet stays in the gitignored
`assets-src/comfyui/adult-type/`.

Pipeline per type frame:
1. **Slice** the cell out of the 6×4 grid (rounded boundaries tile exactly).
2. **Chroma-key** the green screen — a green-dominance test
   (`g > 90 && g > r*1.3 && g > b*1.3`), which keys the background and its
   anti-aliased fringe without touching the brown/tan/blue-grey character.
3. **Crop** to the opaque bbox.
4. **Downscale** with the premultiplied-alpha area-average box filter to one
   locked scale (0.2270; content ~84px tall, laptop kept inside the tile).
5. **Place** on a 96×96 tile, bottom-aligned, horizontally centered.

The `type` row is **appended** to the committed golden BL-18 adult sheet by
`ingest-typing.mjs` (`npm run assets:typing`; `npm run assets:adult` rebuilds
the golden sheet then appends). Every golden row (idle/walk/struggle/parachute-
wind/land, including the taller 128px parachute tile) is preserved byte-for-
byte; the append is idempotent (a pre-existing `type` row is stripped and
rebuilt). The golden adult beaver is the same brown Nano-Banana character as the
typing frames, so the row reads as one consistent beaver.

### Sheets shipped

| File | Rows | Frames | fps hint |
|---|---|---|---|
| `assets/sprites/beaver-adult.png` (768×608) | idle, walk, struggle, parachute-wind, land, **type** | 1, 2, 8, 8, 8, 8 | 8 |

Row heights: 96/96/96/**128**/96/96 (parachute-wind is taller). SHA-256 of the
committed sheet (for stale-asset diagnosis):
```
4c576322876feeeb19937254cbbe954ead468569d98f039a41372657f9e97c6a  assets/sprites/beaver-adult.png
```

## Contact sheet

`docs/design-reviews/BL-19-contact.png` — all six adult rows at 4×
nearest-neighbor on a clean light checkerboard (variable row heights handled).
The type row is grounded (every frame touches the tile bottom), the green screen
is fully keyed (no fringe), and the typing beaver matches the golden idle/walk/
parachute rows.

## Verdict: PASS — one known limitation

**Gentle, not frantic.** The 8 frames vary only subtly frame-to-frame, so at
8 fps the loop reads as calm typing rather than the frantic typing-cat meme.
Acceptable for now; a "more frantic" pass (frames with larger paw travel, or
sit/open/close/stand transition frames) is follow-up.

(The earlier "style pop" limitation is resolved: the type row now sits on the
golden BL-18 adult sheet, not the teen-derived placeholder, so the style
matches.)

## Manual trigger (settings button)

A **"Make the beaver work 💻"** button in the settings Pet section triggers the
working state on demand (testing + a fun manual control). It reuses the exact
reset-progress IPC path: `beaverBuddySettings.forceWork()` invoke →
`SETTINGS_FORCE_WORK_CHANNEL` handler (sender-guarded) →
`main` forwards `FORCE_WORK_CHANNEL` to the overlay → renderer sets a
`pendingForceWork` flag → `forceWorking(roamState, bounds, rng)` on the next
tick (snaps to the ground, no-ops mid grab/glide/landing).

The typing art is adult-only, so the renderer vetoes the `working` state when
the current stage's sheet has no `type` row (mirrors how grab/glide is gated to
the baby stage) — at baby/teen the button is a safe no-op rather than a missing-
row crash. This veto also protects the random trigger at non-adult stages.

## Windows design gate

No Windows-specific rendering change (no new window, tray, icon, or HiDPI
behavior — a sprite row + logical state only), so this rides the existing adult
sheet's HiDPI/click-through handling. A live Windows overlay capture of the
working state is deferred to the #7 art pass, where the adult stage gets its
full visual gate.
