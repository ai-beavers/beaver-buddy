# Phase 4 Implementation Log — Beaver Buddy Windows Port

**Build-Items:** BL-WIN-8 (Renderer HiDPI / Scaling), BL-WIN-10 (Dokumentation & Design-Gate)  
**Date:** 2026-07-15  
**Status:** Completed

---

## 1. BL-WIN-8: Renderer HiDPI / Scaling

### 1.1 Changes

- **New file:** `src/renderer/canvas-dpr.ts`
  - Pure, unit-testable helpers: `computeCanvasSize` and `applyDpr`.
  - `computeCanvasSize(logicalWidth, logicalHeight, dpr)` returns physical canvas
    dimensions (rounded) and CSS dimensions.
  - `applyDpr(canvas, ctx, logicalWidth, logicalHeight, dpr)` sets
    `canvas.width/height`, `canvas.style.width/height`, `ctx.setTransform(dpr, ...)`
    and `ctx.imageSmoothingEnabled = false`.
  - Using `setTransform` instead of `scale` avoids accumulation when DPR changes.

- **Modified file:** `src/renderer/renderer.ts`
  - Removed direct `canvas.width = window.innerWidth` / `canvas.height = window.innerHeight` assignment.
  - Introduced `logicalBounds` and `currentDpr` state.
  - `bounds()` now returns `logicalBounds` (logical pixels) instead of `canvas.width/height`.
  - `onBoundsChanged` stores logical bounds and re-applies DPR scaling.
  - Added a `window.resize` listener that detects pure DPR changes
    (`window.devicePixelRatio` differs from `currentDpr`) and reconfigures the
    canvas without waiting for a main-process bounds event.
  - Fixed full-canvas clear in `draw()`:
    `ctx.clearRect(0, 0, bounds().width, bounds().height)` instead of
    `canvas.width/height`, so the transformed context clears the entire physical
    canvas.
  - Exported `bounds()` so the regression test can call it directly.

- **New tests:**
  - `src/renderer/canvas-dpr.test.ts` — DPR math and `applyDpr` behavior.
  - `src/renderer/renderer.test.ts` — DOM-mocked integration tests verifying:
    - `bounds()` stays logical after DPR scaling.
    - DPR changes on `window.resize` reconfigure the canvas.
    - `clearRect` uses logical bounds, not physical pixels.

### 1.2 Decisions

- **BL-WIN-8 was implemented, not degraded.** The change is small and isolated
  (one new helper file, targeted edits in `renderer.ts`, no new dependencies),
  and the risk of regressions is mitigated by the new tests.
- **DPR detection strategy:** `onBoundsChanged` only fires on work-area changes
  from the main process. A separate `window.resize` listener catches Windows
  display-scaling changes that alter `devicePixelRatio` without changing logical
  bounds.
- **Non-integer DPR (1.25×, 1.5×):** accepted as a known visual limitation.
  Nearest-neighbor scaling avoids bilinear blur, but the pixel grid cannot map
  1:1 to physical pixels, so some unevenness may be visible during slow
  movement. 200 % (DPR = 2) is integer-perfect.

### 1.3 Test results

- `src/renderer/canvas-dpr.test.ts`: 3/3 passed.
- `src/renderer/renderer.test.ts`: 3/3 passed.
- Full suite: 329 passed, 6 skipped.

---

## 2. BL-WIN-10: Dokumentation & Design-Gate

### 2.1 Changes

- **New file:** `docs/design-reviews/phase-4-windows/verdict.md`
  - Design-Gate verdict for app icon, tray icon, HiDPI rendering, overlay bounds,
    auto-hide taskbar, and consistency.
  - Overall: **CONDITIONAL PASS**.
  - Notes the provisional status of icons and the auto-hide limitation.

- **Modified file:** `README.md`
  - Added "HiDPI / display scaling (Windows)" section.
  - Updated troubleshooting:
    - Tray icon contrast note with Design-Gate result.
    - New entry explaining expected 125 %/150 % pixel-grid unevenness.
    - Restored fullscreen-apps note.

- **Modified file:** `PRD.md`
  - Extended R10 (Design QA gate) with Windows-specific surfaces: installer/
    Explorer icon, tray icon on light/dark backgrounds, overlay at multiple
    scaling factors.

- **Modified file:** `CLAUDE.md`
  - Added HiDPI invariant to "Overlay etiquette".
  - Extended "Definition of done" with Windows design-gate requirement.
  - Extended "Testing & design gate" with Windows/HiDPI evaluation guidance.

- **Modified file:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md`
  - Marked Phase 4, BL-WIN-8 and BL-WIN-10 as completed.
  - Added HiDPI/Scaling architecture section (3.7).
  - Added detailed Phase 4 results.
  - Added "Finales Master-Icon / Design-Pass" to Phase 5 / deferred tasks.

### 2.2 Decisions

- **No screenshots captured.** The environment is CLI-only, so the verdict is
  architecture/code-review based. The verdict file explicitly calls out that
  real Windows screenshots should be added when hardware is available.
- **Icons rated CONDITIONAL PASS.** They are recognizable and consistent with the
  sprite palette, but they are temporary sprite-generated assets and need a
  professional design pass.
- **Auto-hide taskbar rated CONDITIONAL PASS.** The limitation is documented and
  does not block MVP; a robust fix is out of scope for Phase 4.

---

## 3. Verification commands

All commands were run locally and passed:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx electron-builder --win --publish never
```

### Results

- `npm run typecheck`: ✅ green
- `npm run lint`: ✅ green
- `npm test`: ✅ 36 test files, 329 passed, 6 skipped
- `npm run build`: ✅ green
- `npx electron-builder --win --publish never`: ✅ green
  - Produced `release/Beaver Buddy Setup 0.1.0.exe`
  - Produced `release/Beaver Buddy 0.1.0.exe`

---

## 4. Open problems / follow-ups

1. **Real-hardware visual verification:** The HiDPI and icon verdicts are
   provisional. Real Windows screenshots at 100 %/125 %/150 %/200 % scaling and
   light/dark taskbar backgrounds are needed to confirm the verdict.
2. **Final master icon:** `assets/icon.ico` and `assets/tray-icon.png` are
   temporary. A professional icon design pass is tracked as a Phase 5 follow-up.
3. **Auto-hide taskbar robustness:** A native Windows AppBar API solution
   (`SHAppBarMessage`) is still a known deferred item.
4. **macOS regression smoke test:** The code changes are platform-agnostic
   (DPR math applies to macOS too), but a visual smoke test on macOS hardware is
   recommended before merging to main.

---

## 5. Files touched

- `src/renderer/canvas-dpr.ts` (new)
- `src/renderer/canvas-dpr.test.ts` (new)
- `src/renderer/renderer.test.ts` (new)
- `src/renderer/renderer.ts` (modified)
- `README.md` (modified)
- `PRD.md` (modified)
- `CLAUDE.md` (modified)
- `.flightplan/Archive/WINDOWS_PORT_PLAN.md` (modified)
- `docs/design-reviews/phase-4-windows/verdict.md` (new)
