# Toilet + Newspaper — design gate verdict

**Date:** 2026-07-24  
**Scope:** WAVE-1 assets for the longer toilet+newspaper+recovery choreography
(`docs/toilet-newspaper-routine.md`). Shipped BL-14 `toilet` row unchanged.

## Rows

| Row | Frames | Height | Intent |
|-----|--------|--------|--------|
| `toilet-read` | 8 | 128 | ONE-SHOT: toilet present → sit → newspaper pull/read/put-away → stand → reach flush |
| `shake-dry` | 8 | 96 | ONE-SHOT: wet shake → settle toward idle |

## Generation

- `partner_generate` / `vertexai/nano-banana-pro`, reference-conditioned on the
  BL-14 `toilet-seq2` character continuity image (public signed URL; GitHub raw
  of the private sheet 404'd).
- Green `#00FF00` chroma-key 4×2 grids; RGB→RGBA normalize; mechanical ingest
  via `buildAdultRowSheet` / `spliceRow`.
- Sheet grew 768×1824 → 768×2048.

## Visual gate

| Check | toilet-read | shake-dry |
|-------|-------------|-----------|
| Beaver visible every frame | PASS | PASS |
| Newspaper readable in mid frames | PASS (frames 3–6) | n/a |
| No green holes after chroma key | PASS (eyeballed contact) | PASS |
| Grounded near tile bottom | PASS | PASS |
| Continuity with adult idle/toilet | PASS (same beaver) | PASS |

Evidence:

- [`toilet-newspaper-toilet-read-contact.png`](toilet-newspaper-toilet-read-contact.png) /
  [`toilet-newspaper-toilet-read.gif`](toilet-newspaper-toilet-read.gif)
- [`toilet-newspaper-shake-dry-contact.png`](toilet-newspaper-shake-dry-contact.png) /
  [`toilet-newspaper-shake-dry.gif`](toilet-newspaper-shake-dry.gif)

## Notes / known limits

- Frame 1 of `toilet-read` shows the toilet already fully risen (soft rise),
  not a multi-frame bottom-up emerge. Acceptable for WAVE-1; refine later if
  owner wants a stronger rise beat.
- LOOP-vs-ONE-SHOT and the flush→wave→shake chaining are WAVE-2 runtime
  (see `src/renderer/toilet-routine.ts`).

## Verdict

**PASS** for WAVE-1 asset bake.
