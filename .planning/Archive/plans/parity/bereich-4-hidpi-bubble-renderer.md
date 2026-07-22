# Area 4 — HiDPI / Bubble / Renderer (Windows Parity)

## 1. Verdict: GAP(S) FOUND

1 small, conditional gap (a DPI change without a DIP bounds change is swallowed) + 2 cosmetic risks. The core of the upstream Retina fix (9c8bd00) is fully present in merge d7acaf0 and included as a true superset: **nowhere is DPR rounded/snapped to whole values** — 1.25 / 1.5 / 1.75 flow as floats all the way through backing-store size and context transform.

## 2. Findings

### F1 — [gap] DPI change with identical DIP work area produces neither BOUNDS_CHANGED nor a DOM resize → canvas permanently blurry

- `src/main/main.ts:227-234` — the guard in `onWorkAreaChanged` compares only `x/y/width/height` of the WorkAreaInfo, **not** `scaleFactor` or the display ID. Scenario: primary-monitor switch between two displays with an identical DIP work area but different scaleFactor (common combo: 1920×1080 @100% ↔ 3840×2160 @200% — e.g. docking/undocking, switching the primary monitor). `display-metrics-changed`/`display-removed` do fire (`src/main/overlay-adapter.ts:121-131`), but the guard returns early → **no** `BOUNDS_CHANGED_CHANNEL` send.
- Renderer consequence: the window keeps its DIP size → **no** DOM `resize` event → the DPR watcher `src/renderer/renderer.ts:214-221` does not fire → `currentDpr` (renderer.ts:95) stays stale. Backing store and transform stay on the old DPR → the entire canvas, incl. quip bubble text, is blurry until the next bounds event or an app restart.
- Aggravating: even if BOUNDS_CHANGED were sent, `onBoundsChanged` (renderer.ts:201-209) uses the possibly stale `currentDpr` and does not re-read `window.devicePixelRatio` — convergence today depends solely on the subsequent DOM resize, which does not occur in this case.
- Frequency: low, but a real Windows scenario; practically unreachable on macOS (a primary-display switch with identical DIP work area and a DPR jump of 1↔2 is unusual there).
- **Fix (no new dependencies):** self-healing on the renderer side: in the existing rAF loop (`frame()`, renderer.ts:365) check `window.devicePixelRatio !== currentDpr` and on drift update `currentDpr` + `applyDpr` + `needsDraw = true` (cost: one float comparison per frame; alternative: a `matchMedia('(resolution: …dppx)')` listener). Additionally re-read `currentDpr = window.devicePixelRatio || 1` in `onBoundsChanged`, so the handler does not depend on the event ordering with DOM resize. Optionally include `scaleFactor` in the change comparison on the main side (WorkAreaInfo is already display-derived, `overlay-adapter.ts:54-63`).

### F2 — [risk] The +0.5 crisp-line trick of the bubble outline is ineffective at DPR 1.25/1.5/1.75

- `src/renderer/bubble.ts:103-114` — `strokeRect(x + 0.5, …)` + tail stroke with +0.5 only lands on physical pixel centers at dpr = 1 and 2. At dpr = 1.25/1.5/1.75 the 1-CSS-px outline is 1.25/1.5/1.75 physical px wide; the edges necessarily lie on fractional positions (edge distance not integer) → outline antialiased/slightly soft.
- No functional loss: the bubble **text** stays sharp (backing-store supersampling works at any dpr > 1; `bold 12px` → 15/18/21 physical px glyphs, bubble.ts:119). Only the 1-px outline is affected — cosmetic, and 1:1 the state of every canvas app at Windows scaling 125/150/175%.
- **Fix (optional, no new dependencies):** stroke width `1/dpr` CSS px and round stroke positions to the physical raster (`Math.round(v * dpr) / dpr`); `drawBubble` would need to know the DPR for this — e.g. via `ctx.getTransform().a` (no signature change needed) or as a parameter from renderer.ts. Alternatively, deliberately document it as acceptable fractional-scaling behavior.

### F3 — [risk] Pixel-art sprites show uneven art-pixel widths at fractional DPR

- `src/renderer/sprites.ts:91-116` (drawFrame, nearest-neighbor via `imageSmoothingEnabled = false`, canvas-dpr.ts:42) + integer draw positions on the **CSS** raster (renderer.ts:320-321). At dpr 1.25/1.5/1.75 the device ratio is not integer → art pixels alternate between 2/3 physical px wide; while roaming there is minimal "shimmering", because the CSS integer raster ≠ the physical raster.
- Inherent to fractional scaling (affects every pixel-art app on Windows at 125/150/175%), cannot be sensibly fixed without changing the pet pixel size → wontfix candidate, document only as known behavior. Not a parity deficit in the strict sense (macOS has no native fractional DPRs).

## 3. Verified OK

- **No integer DPR snapping:** grep over `src/` — the only rounding is `Math.round(logical * dpr)` on the final product (`src/renderer/canvas-dpr.ts:17-18`, correct: physical pixels must be integer); `window.devicePixelRatio` is taken over as a float (`src/renderer/renderer.ts:95,215`).
- **Merge superset confirmed:** `git diff upstream/main HEAD -- src/renderer/` shows: upstream's `syncCanvasResolution()` (9c8bd00) is fully replaced by our `applyDpr` (identical semantics) **plus** the `onBoundsChanged` handler, the `resize` DPR watcher, and `clampRoamStateToBounds`; `bubble.ts` is diff-free = upstream's Retina text fix (bold, `textAlign='left'`, rounded glyph origins, bubble.ts:116-126) taken over unchanged.
- **DPR transform idempotent:** `setTransform` (not `scale`) — repeated `applyDpr` calls do not accumulate (`canvas-dpr.ts:41`); `imageSmoothingEnabled = false` is set again after every canvas resize (canvas-dpr.ts:42).
- **Test coverage for fractional DPRs present:** dpr 1.25 + 1.5 in `src/renderer/canvas-dpr.test.ts:6-18`; the dpr 1.5 resize path in `src/renderer/renderer.test.ts:130-139`; dpr 2 in renderer.test.ts:112-128. (1.75 is missing, trivial to add — same code paths.)
- **BOUNDS_CHANGED wiring:** `display-added`/`display-removed`/`display-metrics-changed` subscribed (`src/main/overlay-adapter.ts:121-131`); initial bounds after `did-finish-load` (`src/main/main.ts:380-386`); preload channel `state:bounds` correctly forwarded (`src/main/preload.ts:18,61-65`); the renderer uses explicit bounds instead of innerWidth/Height (`renderer.ts:201-209`).
- **Event ordering IPC ↔ resize converges** (as long as both fire): both handlers end in the idempotent `applyDpr` with an eventually consistent (bounds, dpr) pair, regardless of order (renderer.ts:201-221).
- **Clear/dirty-rect DPR-safe:** `clearRect` in logical coordinates under the DPR transform (`renderer.ts:300-306`, test renderer.test.ts:141-156); tail-stroke bleed +1 CSS px (renderer.ts:355-359) also covers the 1.25× physical bleed of the fractional outline.
- **Canvas state reset unproblematic:** setting `canvas.width =` resets the 2D state, but all draw paths set styles per call (`bubble.ts:91,107,119`; `sprites.ts` drawFrame with save/restore, sprites.ts:107).
- **Backing-store rounding:** `Math.round(logical*dpr)` with integer DIP bounds (Electron workArea) → max ±0.5 physical px deviation from ideal; Chromium layer snapping keeps the 1:1 texel mapping — standard pattern, no visible blur.

## 4. Proposed Flight-Plan Items

1. **DPR drift guard in the renderer** — check `devicePixelRatio` against `currentDpr` in the rAF loop (or via `matchMedia('(resolution: …dppx)')`) and re-apply `applyDpr` on drift; closes the "DPI change without DIP bounds change" gap (primary-monitor switch 100% ↔ 200%), incl. re-reading `currentDpr` in `onBoundsChanged`.
2. **Bubble outline: physical pixel snapping at fractional DPR (optional/cosmetic)** — stroke width `1/dpr` + positions rounded to the device raster via `ctx.getTransform().a`, so the 1-px outline stays crisp at 125/150/175% too.
