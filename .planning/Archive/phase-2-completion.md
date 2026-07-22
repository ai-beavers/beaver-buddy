# Beaver Buddy — Phase 2 Completion: Core Windows Experience

**Date:** 2026-07-15
**Build items:** BL-WIN-3 (Overlay adapter for Windows), BL-WIN-4 (Tray adapter for Windows)
**Status:** ✅ Completed

---

## Summary

Phase 2 resolved the two central visible Windows blockers:

- **BL-WIN-3:** The overlay window now behaves natively on Windows. It is aligned
  to the available work area (`workArea`) of the primary display, reacts to
  display/taskbar changes, and communicates new bounds to the renderer via the
  IPC channel `state:bounds`.
- **BL-WIN-4:** The tray icon loads the colored `assets/tray-icon.png` on
  Windows and retains the template-image behavior on macOS.

All automated checks (typecheck, lint, tests, build, Windows packaging)
pass successfully.

---

## Implemented build items

| Build item | Status | Short description |
|------------|--------|-------------------|
| BL-WIN-3 | ✅ Completed | Overlay adapter for Windows: Z-order, work area, taskbar edge, bounds IPC |
| BL-WIN-4 | ✅ Completed | Tray adapter for Windows: colored icon on Windows, template image on macOS |

---

## Changed files

| File | Change |
|------|--------|
| `src/main/overlay-adapter.ts` | New: platform adapter for AlwaysOnTop, work area, taskbar edge |
| `src/main/overlay-adapter.test.ts` | New: 14 unit tests for the overlay adapter |
| `src/main/preload.test.ts` | New: 3 tests for `onBoundsChanged` |
| `src/main/main.ts` | Overlay adapter integration, bounds IPC, deduplication, smoke test extension |
| `src/main/ipc-channels.ts` | New channel `BOUNDS_CHANGED_CHANNEL = 'state:bounds'` |
| `src/main/preload.ts` | `onBoundsChanged` exposed via `contextBridge` |
| `src/renderer/renderer.ts` | Bounds-change handler, canvas resize from IPC payload |
| `src/renderer/roam.ts` | `clampRoamStateToBounds` for smooth clamping into the new work area |
| `src/main/tray.ts` | Platform-specific icon selection (`loadTrayIcon`) |
| `src/main/tray.test.ts` | +3 tests for `loadTrayIcon` |

---

## Verification results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ green |
| `npm run lint` | ✅ green |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npm run build` | ✅ green |
| `npx electron-builder --win --publish never` | ✅ green (NSIS + portable) |

**New test coverage:**

- `src/main/overlay-adapter.test.ts`: 14 tests
- `src/main/preload.test.ts`: 3 tests
- `src/main/tray.test.ts`: +3 tests for `loadTrayIcon`

---

## Remaining open points / warnings

1. **Auto-hide limitation**
   - `detectTaskbarEdge` compares `display.bounds` with `display.workArea`.
   - With an auto-hide taskbar both are often identical on Windows, so the
     taskbar edge is not detected.
   - The overlay is aligned to the full screen size; the beaver can
     briefly be obscured by the taskbar when it slides in.
   - A complete solution would require the native Windows AppBar API, which
     would mean new dependencies.

2. **Z-order hardware test pending**
   - `setAlwaysOnTop(true, 'normal')` is the conservative starting choice for Windows.
   - Whether the overlay stays above the visible taskbar must be verified on
     real Windows hardware.
   - Documented fallback: `setAlwaysOnTop(true, 'pop-up-menu')`.

3. **Tray icon contrast**
   - The colored `assets/tray-icon.png` was not visually checked against dark
     Windows taskbar backgrounds.
   - Phase 4 (BL-WIN-10 / HiDPI) should include a design gate for a
     high-contrast icon.

4. **Multi-monitor and HiDPI/scaling**
   - Currently only the primary display (`screen.getPrimaryDisplay()`).
   - HiDPI/scaling is not part of this phase and is planned for Phase 4.

---

## Next phase

**Phase 3: Windows Integrations (BL-WIN-5)**

- **Goal:** Claude Code usage tracking works on Windows.
- **Build item:** BL-WIN-5 — Claude usage log path Windows adapter
- **Acceptance:** App finds `%USERPROFILE%\.claude` and parses logs correctly;
  the `CLAUDE_CONFIG_DIR` override is preserved; the XDG path is ignored on
  Windows; Codex tracking remains deferred for now.
