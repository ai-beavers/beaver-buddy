# BL-19 Windows Design Gate — Adult Parachute (taller tile) — PENDING

**Status: PENDING — must be run on Windows.** This audit was done from macOS
(code trace + build/packaging only); no Windows screenshot exists yet. Do not
mark this feature Windows-verified until the checklist below is executed and
a verdict recorded.

**Scope:** BL-18 (adult parachute art) + BL-19 (adult `parachute-wind` row
grows from a 96×96 tile to a 96×128 tile; `drawFrame` bottom-anchors it,
`frameRect` uses cumulative row offsets, the renderer's dirty-rect extends
upward to cover the taller frame).

## Why this needs a Windows pass

macOS Retina is always integer DPR (2.0). Windows commonly runs *fractional*
display scaling (125%, 150%) which exercises `ctx.setTransform(dpr, ...)`
(`src/renderer/canvas-dpr.ts:41`) at non-integer values — a code path macOS
cannot exercise at all.

## Capture checklist

Capture on a clean/synthetic desktop (no personal windows/notifications/file
names), at:

- [ ] 100% scaling
- [ ] one fractional HiDPI scaling — 125% or 150% preferred (exercises the
      fractional-dpr path this audit couldn't); 200% acceptable as a second
      data point but does not substitute for a fractional capture

At each scaling, capture the full parachute sequence for the **adult** stage:
- [ ] grab / struggle (pre-existing square-tile row, for comparison)
- [ ] parachute-wind glide, several frames mid-animation (the taller
      96×128 row)
- [ ] land

## Pass/fail criteria

- [ ] Full-size beaver — not shrunk to fit the old square tile
- [ ] Canopy fully visible, not clipped at the top edge of the sprite/window
- [ ] Canopy's white stripes render fully opaque (no see-through/checkerboard)
- [ ] Feet stay on the same ground line across struggle → parachute-wind →
      land (bottom-anchor working, no vertical jump between rows)
- [ ] No smear/ghost trail above the beaver during the glide (dirty-rect
      correctly covers the taller frame — watch the canopy region
      specifically while it's moving)
- [ ] Click-through still holds: overlay does not steal clicks/focus during
      the animation
- [ ] No new blur vs. any other sprite at the same scaling (some
      nearest-neighbor unevenness under fractional scaling is expected and
      pre-existing across every sprite — see the code-trace note below; the
      taller tile must not look *worse* than e.g. idle/walk at the same
      scaling)

Any FAIL: fix, or record as a known limitation per CLAUDE.md's definition of
done.

## Code-trace note (from the macOS-side audit, for the human running this)

`PET_SCALE = 1` (`src/renderer/pet-config.ts:23`) and every coordinate that
feeds the taller-tile math (`petDrawY`, `frameRect`'s `sy`/`sh`, the dirty
rect) is an integer logical pixel — `Math.round`ed at the roam-state draw
call (`src/renderer/renderer.ts:473-474`) and integer arithmetic from there
(`renderer.ts:400-402`, `sprites.ts:78-89`, `113-126`). So there's no
BL-19-specific fractional-pixel risk beyond what already exists for *every*
sprite under a fractional `dpr` transform (`canvas-dpr.ts:41`,
`imageSmoothingEnabled = false` at `canvas-dpr.ts:42`) — that's a pre-existing
Canvas2D property (fractional-device-pixel edge antialiasing on `clearRect`/
`drawImage`), not something BL-19 introduces. This still needs eyes on real
Windows fractional scaling to confirm, since it hasn't been exercised on any
integer-DPR macOS run.

## Acceptance criteria reference

CLAUDE.md → "Testing & design gate": Windows-specific visual changes must be
evaluated on Windows or a Windows VM at 100% and at least one HiDPI scaling
(preferably 200%); screenshots land in `docs/design-reviews/` with verdict
notes; automated packaging (`electron-builder --win`) is required but does
not replace the visual gate.
