# BL-6 design-review verdict — young-baby/older-teen figures + adult idle/walk final art

Date: 2026-07-22
Verdict: **PASS**

## Scope

Three sheet changes, all synthetic-background frame comparisons (no personal
windows/notifications in any capture):

1. **`beaver-young-baby.png`** (T1, new) — in-between growth stage between
   baby and teen, `idle(1)`/`walk(2)`, 192×192.
2. **`beaver-older-teen.png`** (T2, new) — in-between growth stage between
   teen and adult, `idle(1)`/`walk(2)`, 192×192.
3. **`beaver-adult.png`** (T3, replaced rows) — `idle`/`walk` replaced with
   final generated art, reference-conditioned on the same adult reference
   image every other adult row already uses; the other 8 rows
   (`struggle`/`parachute-wind`/`land`/`type`/`watering`/`drink`/`sleep`/
   `stretch`) are byte-preserved, unchanged.

Both new figures are unwired (`Stage`/`stageForLevel` don't reference them
yet — WAVE-2), so committing them is inert; the adult replacement is live.

### Sheets shipped

| File | Dimensions | Rows | SHA-256 |
|---|---|---|---|
| `assets/sprites/beaver-young-baby.png` | 192×192 | idle(1), walk(2) | `848ed70391a44d62e232864709d246264bf375fbd29768fd93a17b8269977a0c` |
| `assets/sprites/beaver-older-teen.png` | 192×192 | idle(1), walk(2) | `d6222230c820724c62b43c00c04a755d8220b0a524a8383e9883d67a8327cdab` |
| `assets/sprites/beaver-adult.png` | 768×992 | idle, walk, struggle, parachute-wind, land, type, watering, drink, sleep, stretch | `5d141d38746cb2b7e9cc2d94cf77f25d601d289c9263b71e9392b2d75eb2f673` |

## Evidence

- **`BL-6-young-baby-sheet.png`** — full `beaver-young-baby` sheet, 4×
  nearest-neighbor, magenta backdrop. Idle + both walk frames read as one
  consistent smaller-than-teen beaver: same fur tone, tail texture, ear
  shape as its baby/teen neighbors.
- **`BL-6-older-teen-sheet.png`** — full `beaver-older-teen` sheet, 4×
  nearest-neighbor, magenta backdrop. Same check, sized between teen and
  adult.
- **`BL-6-lineage-strip-5stage.png`** — baby → young-baby → teen →
  older-teen → adult idle poses side by side. Monotonic size progression,
  same character across all five stages, no discontinuity at either new
  in-between stage. **PASS.**
- **`BL-6-adult-idle-before-after.png`** — adult idle row, teen-upscale
  placeholder (before) vs. final art (after), same scale. Same pose,
  proportions, and palette; the final art reads as a cleaner, on-model
  version of the same beaver, not a different character.
- **`BL-6-adult-walk-before-after.png`** — adult walk row (2 frames),
  before/after, same layout. Step cadence and silhouette preserved.
- **`BL-6-adult-continuity-vs-8-rows.png`** — final idle/walk frames laid
  out against all 8 already-shipped adult rows (struggle, parachute-wind,
  land, type, watering, drink, sleep, stretch). Fur color, tail cross-hatch
  texture, ear shape, tooth/eye-highlight details, and outline weight are
  consistent across every row. **PASS.**

## Byte-preservation

`beaver-adult.png` grew only in the idle/walk region; every row from
`struggle` onward is byte-identical to the pre-BL-6 commit (verified by the
existing unconditional committed-sheet pin test in
`ingest-animation-frames.test.ts`, which passes unchanged).

## Windows design gate

No renderer/window/tray/HiDPI change — sprite content only, same tile size
and row layout convention as every other stage sheet. Rides the existing
adult-sheet HiDPI/click-through handling; no separate Windows capture
needed for this item.
