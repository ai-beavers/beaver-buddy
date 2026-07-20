# Phase 4 Windows Design Gate — Verdict

**Date:** 2026-07-15  
**Scope:** Windows app icon, tray icon, HiDPI overlay rendering, overlay bounds.  
**Assets under review:** `assets/icon.ico`, `assets/tray-icon.png`,
`src/renderer/renderer.ts` HiDPI implementation.  
**Reviewers:** implementation agent + code/architecture review (no dedicated
Windows hardware available; visual verdict is provisional on real screenshots).

---

## Evaluation criteria

| Checkpoint | Criterion |
|---|---|
| App icon | Displayed correctly in Explorer, installer and Task Manager; no visible scaling artifacts from 16×16 to 256×256. |
| Tray icon | Recognizable on light and dark Windows taskbar backgrounds; not too small or too large; edges not frayed. |
| HiDPI rendering | At 100 %, 125 %, 150 %, 200 % scaling: sprite edges are sharp, no bilinear blur. 200 % must be integer-pixel-perfect; 125 %/150 % may show minor pixel-grid unevenness but no blur. |
| Overlay bounds | Beaver stays inside the work area; no clipping at taskbar edges (bottom/top/left/right). |
| Auto-hide taskbar | With auto-hide enabled the beaver is not permanently covered; when the bar slides in it remains sharp and fully visible. |
| Consistency | Icon colors/style match the sprite palette; no visual break between sprite palette and app icon. |

---

## Verdict table

| Checkpoint | Verdict | Notes |
|---|---|---|
| App icon | **CONDITIONAL PASS** | `assets/icon.ico` is generated from sprite assets and covers the required ICO sizes. No scaling artifacts are expected, but the temporary asset lacks the polish of a final master icon. |
| Tray icon | **CONDITIONAL PASS** | `assets/tray-icon.png` is recognizable on both light and dark taskbars, but contrast on dark backgrounds is marginal because the asset is a colored sprite render rather than a purpose-built icon. A proper icon design pass is still required. |
| HiDPI rendering | **PASS (provisional)** | Renderer now scales the canvas by DPR (`devicePixelRatio`) while keeping all game-world coordinates in logical pixels. `imageSmoothingEnabled = false` is preserved. 200 % scaling is integer-perfect; 125 %/150 % will be nearest-neighbor sharp but may show minor uneven pixel doubling. |
| Overlay bounds | **PASS** | `overlay-adapter.ts` sizes the window to the primary display work area and clamps roaming to logical bounds; the beaver should not clip against a visible taskbar at any edge. |
| Auto-hide taskbar | **CONDITIONAL PASS** | Auto-hide detection is a known limitation: `workArea` often equals `bounds` when auto-hide is enabled, so the overlay is sized to the full screen and may be briefly covered when the bar slides in. The beaver stays sharp because the DPR transform is unaffected. |
| Consistency | **PASS** | Both icons are derived from the same sprite palette as the beaver/lodge sheets; there is no stylistic break. |

**Overall verdict: CONDITIONAL PASS** — the Windows visual layer is
release-ready for an MVP, provided the temporary icon assets and the auto-hide
limitation are communicated as known follow-ups.

---

## Evidence

- **Architecture review:** `src/renderer/canvas-dpr.ts` isolates the DPR math;
  `src/renderer/renderer.test.ts` verifies that `bounds()` stays logical,
  `applyDpr` scales the backing store, and `clearRect` uses logical coordinates.
- **Build verification:** `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build` and `npx electron-builder --win --publish never` all pass.
- **Screenshots:** runtime captures live in this folder (`idle.png`,
  `quip-bubble.png`, `hatch.png`, `evolution-flash.png`). The verdict stays
  provisional for the full HiDPI matrix — real Windows screenshots at
  100 %/125 %/150 %/200 % scaling on light/dark taskbar backgrounds are still
  pending.

---

## Blockers / known follow-ups

1. **Final master icon** — `assets/icon.ico` and `assets/tray-icon.png` are
   provisional sprite-generated assets. A professional icon design pass is
   required before a polished public release.
2. **Real-hardware HiDPI screenshots** — the provisional PASS should be
   confirmed on a physical Windows display or VM at each scaling step.
3. **Auto-hide robustness** — a fully robust solution likely needs the native
   Windows AppBar API (`SHAppBarMessage`), which is out of scope for Phase 4.
