# Phase 4 Completion — Polish & Release-Readiness

**Build-Items:** BL-WIN-8 (Renderer HiDPI / Scaling), BL-WIN-10 (Documentation & Design-Gate)  
**Date:** 2026-07-15  
**Status:** ✅ Completed — passed with warnings

---

## Summary

Phase 4 finishes the Windows port's polish and release-readiness work. The renderer now scales the overlay canvas by the native device pixel ratio on Windows while keeping all game-world coordinates in logical pixels, so the beaver stays sharp at 100 %, 125 %, 150 % and 200 % display scaling. Documentation (`README.md`, `PRD.md`, `CLAUDE.md`) and a provisional design-gate verdict for Windows icons and HiDPI rendering were completed.

---

## BL-WIN-8 — Renderer HiDPI / Scaling

**Status:** ✅ Implemented (not degraded).

- Added `src/renderer/canvas-dpr.ts` with pure, unit-testable helpers `computeCanvasSize` and `applyDpr`.
- Updated `src/renderer/renderer.ts`:
  - Introduced `logicalBounds` separate from the physical canvas backing store.
  - `bounds()` now returns logical pixels.
  - Full-canvas `clearRect` uses logical bounds so the DPR-transformed context clears the entire physical canvas.
  - Added a `window.resize` listener that reconfigures the canvas when `window.devicePixelRatio` changes without a main-process bounds event.
- Added tests:
  - `src/renderer/canvas-dpr.test.ts` — 3 tests covering DPR math and `applyDpr` behavior.
  - `src/renderer/renderer.test.ts` — 3 tests covering logical `bounds()`, DPR reconfiguration, and correct `clearRect` coordinates.

**Result:** 200 % scaling is integer-pixel-perfect; 125 %/150 % are nearest-neighbor sharp with no bilinear blur, but may show minor pixel-grid unevenness due to non-integer DPR.

---

## BL-WIN-10 — Documentation & Design-Gate

**Status:** ✅ Completed.

- Updated `README.md`:
  - Added "HiDPI / display scaling (Windows)" section.
  - Added troubleshooting entries for tray-icon contrast on dark taskbars and 125 %/150 % scaling unevenness.
- Updated `PRD.md`:
  - Extended R10 (Design QA gate) with Windows-specific surfaces: installer/Explorer icon, tray icon on light/dark backgrounds, overlay scaling.
- Updated `CLAUDE.md`:
  - Added HiDPI invariant to "Overlay etiquette".
  - Extended "Definition of done" and "Testing & design gate" with Windows/HiDPI requirements.
- Created `docs/design-reviews/phase-4-windows/verdict.md`:
  - Overall verdict: **CONDITIONAL PASS**.
  - App icon and tray icon are conditional because the assets are provisional sprite-generated placeholders.
  - HiDPI rendering: **PASS (provisional)**.
  - Overlay bounds: **PASS**.
  - Auto-hide taskbar: **CONDITIONAL PASS** (known limitation).
  - Consistency: **PASS**.

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/canvas-dpr.ts` | New — DPR math helpers |
| `src/renderer/canvas-dpr.test.ts` | New — DPR math tests |
| `src/renderer/renderer.test.ts` | New — renderer regression tests |
| `src/renderer/renderer.ts` | Modified — logical bounds, DPR scaling, clear-rect fix |
| `README.md` | Modified — HiDPI section + troubleshooting |
| `PRD.md` | Modified — R10 Windows surfaces |
| `CLAUDE.md` | Modified — HiDPI invariant, definition of done, testing guidance |
| `.flightplan/Archive/WINDOWS_PORT_PLAN.md` | Modified — Phase 4 status, BL-WIN-8/BL-WIN-10 details, Phase 5 follow-ups |
| `docs/design-reviews/phase-4-windows/verdict.md` | New — design-gate verdict |

---

## Verification

All automated checks passed locally on Windows:

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ PASS |
| `npm run lint` | ✅ PASS |
| `npm test` | ✅ PASS — 36 test files, **329 passed**, 6 skipped |
| `npm run build` | ✅ PASS |
| `npx electron-builder --win --publish never` | ✅ PASS — produced `release/Beaver Buddy Setup 0.1.0.exe` and `release/Beaver Buddy 0.1.0.exe` |

---

## Remaining open points / warnings

1. **Real Windows screenshots missing.** The design-gate verdict is architecture/code-review based. Clean synthetic-desktop screenshots at 100 %/125 %/150 %/200 % scaling and light/dark taskbar backgrounds should be added to `docs/design-reviews/phase-4-windows/` once a Windows test machine or VM is available.
2. **Visual verdict is provisional.** HiDPI PASS and icon CONDITIONAL PASS should be re-confirmed on real Windows hardware.
3. **125 % / 150 % scaling limitation.** Non-integer DPR (1.25×, 1.5×) can produce an uneven pixel grid during slow movement. This is a fundamental nearest-neighbor limitation, documented in `README.md` and the verdict.
4. **Auto-hide taskbar remains a known limitation.** The overlay may be briefly covered when an auto-hide taskbar slides in; a robust fix would require the native Windows AppBar API (`SHAppBarMessage`).
5. **Final master icon pending.** `assets/icon.ico` and `assets/tray-icon.png` are provisional sprite-generated assets; a professional design pass is required for a polished public release.
6. **macOS regression smoke test recommended.** The DPR changes are platform-agnostic, but a visual smoke test on macOS hardware is advised before merging to `main`.

---

## Next phase: Phase 5 — Deferred / Follow-up

Phase 5 is the next open phase. It tracks the remaining deferred items:

- **BL-WIN-6** — Windows Secret-Store / MRR-Mode (pending administrator decision on Credential Manager vs. `safeStorage`).
- **BL-WIN-7** — Atomic file writes on Windows (research Windows-native approach).
- **Codex-Tracking on Windows** — research official Codex CLI log path on Windows.
- **Final Master-Icon / Design-Pass** — replace provisional `assets/icon.ico` and `assets/tray-icon.png` with professional assets.
