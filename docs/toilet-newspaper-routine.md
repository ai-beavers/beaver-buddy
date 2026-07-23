# Toilet + Newspaper + Recovery Routine

Item spec for the full gag that extends the shipped 8-frame `toilet` row
(BL-14). The shipped `toilet` row stays untouched; this doc is the WAVE-1 /
WAVE-2 plan for the longer choreography.

## Storyboard (beats)

| # | Beat | Frames (approx) | Source |
|---|------|-----------------|--------|
| 1 | Toilet rises from the bottom (out of nothing) | 2 | **NEW** `toilet-read` |
| 2 | Beaver sits down on the toilet | 1 | **NEW** `toilet-read` |
| 3 | Pulls up a newspaper | 1 | **NEW** `toilet-read` |
| 4 | Reads (small page-flip / glance beats) | 2–3 | **NEW** `toilet-read` |
| 5 | Puts newspaper away | 1 | **NEW** `toilet-read` |
| 6 | Stands up from the toilet | 1 | **NEW** `toilet-read` (fills remaining slot) |
| 7 | Flushes | 8 | **REUSE** `flush` |
| 8 | Wave surges / sweeps beaver away | 4–8 | **REUSE** `wave` (forward) |
| 9 | Wave carries beaver back | 4–8 | **REUSE** `wave` (reverse / second half) |
| 10 | Shakes off water (wet) | 6–8 | **NEW** `shake-dry` |
| 11 | Settles to idle | 1 | **REUSE** `idle` |
| 12 | Walks off | 2+ | **REUSE** `walk` |

Total narrative length ≈ 24–32 frame-times at 8 fps (~3–4 s), assembled from
four reusable rows rather than one wide strip.

## Layout decision (locked)

**Split into reusable ≤8-frame rows sequenced at runtime.**

Rationale ([`src/renderer/sprites.ts`](../src/renderer/sprites.ts) `frameRect`):
`sx = frame * meta.tile` with no column wrap; the sheet is fixed at
`sheetWidth = 768` (8 × 96). A single 24–32 frame row would force a ~3072px-wide
sheet and an ingest/pipeline change. Multi-row sequencing matches hatch /
evolution / landing patterns already in the renderer and maximizes reuse of
`flush` / `wave` / `idle` / `walk`.

### New rows (WAVE-1)

| Row | Frames | Height | Narrative |
|-----|--------|--------|-----------|
| `toilet-read` | 8 | 128 | Toilet rises → sit → newspaper pull / read ×2–3 / put away → stand. ONE-SHOT. |
| `shake-dry` | 8 | 96 | Wet beaver shakes water off, settles toward idle. ONE-SHOT. |

### Untouched / reused

- `toilet` (BL-14) — keep as the short sit→flush→tile-wave gag.
- `flush`, `wave`, `idle`, `walk` — chained by the WAVE-2 sequencer.

## WAVE-1 deliverable

1. Generate 4×2 green-chroma grids for `toilet-read` and `shake-dry`
   (reference-conditioned on the adult idle tile).
2. Ingest via `ingest-animation-frames.mjs` (`adult-toilet-read`,
   `adult-shake-dry`); register configs + `npm run assets:adult-*`.
3. STYLE.md + asset-gallery provenance; design-gate contact sheet + GIF +
   verdict under `docs/design-reviews/`.

## WAVE-2 deliverable

Runtime sequencer (hatch/evolution style) that:

1. Plays `toilet-read` once (frame-count gated).
2. Plays `flush` once.
3. Plays `wave` forward (sweep away), then reverse or second pass (carry back).
4. Plays `shake-dry` once.
5. Hands off to `idle`, then resume normal roam (`walk`).

LOOP-vs-ONE-SHOT stays a runtime concern (not encoded in sheet JSON).

## Out of scope

- Full-screen wall-of-water effect (already deferred from BL-14).
- Editing or replacing the shipped `toilet` row.
- Baby / teen stage variants.
