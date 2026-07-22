# Phase 2 Verification Report — Core Windows Experience

**Date:** 2026-07-15
**Checked build items:** BL-WIN-3 (Overlay adapter for Windows), BL-WIN-4 (Tray adapter for Windows)
**Verifier:** Verification agent

---

## 1. Summary of the checked implementation

The Phase 2 implementation was checked against the plan (`.flightplan/Archive/phase-2-plan.md`), the critical review (`.flightplan/Archive/phase-2-plan-review.md`), and the implementation log (`.flightplan/Archive/phase-2-implementation-log.md`). The central architecture decisions were implemented as recommended by the review:

- `fitWindowToWorkArea` uses `setBounds(..., false)` (no animation).
- The renderer uses explicit bounds from the IPC channel `state:bounds` instead of `window.innerWidth/Height`.
- Work-area changes are deduplicated in `main.ts`.
- `clampRoamStateToBounds` lives in `roam.ts` and uses the existing `maxX`/`groundY` helpers.
- `setTemplateImage` is only called on `darwin`.

Build, typecheck, lint, tests, and Windows packaging all pass successfully. The new unit tests cover the overlay adapter, the IPC chain (`preload.ts`), and the tray icon loading.

However, `git status` shows additional changes outside the file set expected for Phase 2. These apparently come from previous phases/other work, but must be noted for this verification as a deviation from the expected change set.

---

## 2. Item-by-item check per build item

### BL-WIN-3: Overlay adapter for Windows

| Criterion | Status | Rationale |
|-----------|--------|-----------|
| Adapter module exists | ✅ | `src/main/overlay-adapter.ts` newly created. |
| Taskbar edge detection | ✅ | `detectTaskbarEdge` checks top/bottom/left/right/none. Tests exist for all cases. |
| `workArea` as reference size | ✅ | `getPrimaryWorkAreaInfo` and `getOverlayWindowBounds` use `display.workArea`. |
| Platform-specific `setAlwaysOnTop` level | ✅ | `darwin` → `'floating'`; `win32`/`linux` → `'normal'`. |
| No `setBounds` animation | ✅ | `fitWindowToWorkArea` calls `win.setBounds(..., false)`. |
| Bounds explicitly sent to renderer via IPC | ✅ | `BOUNDS_CHANGED_CHANNEL = 'state:bounds'`; sent in `main.ts` on changes and initially after `did-finish-load`. |
| Renderer uses IPC bounds | ✅ | `renderer.ts` sets `canvas.width/height` directly from the payload. |
| Work-area changes deduplicated | ✅ | `main.ts` stores `lastWorkArea` and only updates on an actual change. |
| `clampRoamStateToBounds` integrated | ✅ | Implemented in `roam.ts` and reuses `maxX`/`groundY`. |
| Smoke test extended | ✅ | `--smoke` returns `boundsMatchWorkArea`. |
| Auto-hide detection | ⚠️ | As criticized in the review, `detectTaskbarEdge` cannot reliably detect auto-hide (`workArea == bounds`). Deliberately accepted as a documented limitation. |
| Z-order verified on real Windows hardware | ⚠️ | `'normal'` is the conservative choice; empirical test on Windows 10/11 is missing. Fallback `'pop-up-menu'` documented. |

### BL-WIN-4: Tray adapter for Windows

| Criterion | Status | Rationale |
|-----------|--------|-----------|
| Platform-specific icon selection | ✅ | `loadTrayIcon` loads `tray-icon.png` on `win32`/`linux`, `tray-iconTemplate.png` on `darwin`. |
| `setTemplateImage` only on macOS | ✅ | Guard `process.platform === 'darwin'` before `setTemplateImage`. |
| Tray menu unchanged | ✅ | `buildMenuTemplate` and `createTray` contain no platform-specific menu changes. |
| Tests for icon loading | ✅ | `tray.test.ts` covers `win32`, `darwin`, `linux`. |

---

## 3. Results of the executed commands

| Command | Result |
|---------|--------|
| `npm run build` | ✅ Successful (`Assets built successfully.`) |
| `npm run typecheck` | ✅ Successful (no errors) |
| `npm run lint` | ✅ Successful (no errors) |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npx electron-builder --win --publish never` | ✅ Successful (NSIS + portable created and signed) |

**Test coverage Phase 2:**
- `src/main/overlay-adapter.test.ts`: 14 tests
- `src/main/preload.test.ts`: 3 tests
- `src/main/tray.test.ts`: +3 tests for `loadTrayIcon`

---

## 4. Found errors / gaps / deviations

### 4.1 Unexpected file changes outside the Phase 2 scope
**Severity:** Medium

`git status` shows further modifications in addition to the expected Phase 2 files:

```
 M .github/workflows/ci.yml
 M .gitignore
 M CLAUDE.md
 M PRD.md
 M README.md
 M electron-builder.yml
 M package.json
?? "## BEAVER ANIMATIONS IDEE ROHTEXT.md"
?? assets/icon.ico
?? assets/tray-icon.png
?? docs/adr/002-cross-platform-scope.md
?? scripts/build-assets.js
```

These files are not part of the list of files to be changed in Phase 2. They likely come from Phase 1 or parallel work. For the pure Phase 2 verification they are to be marked as "unexpected".

### 4.2 Auto-hide taskbar remains unsolved
**Severity:** Low – Medium

`detectTaskbarEdge` does not detect auto-hide (workArea == bounds). The implementation agent deliberately documented this as a limitation and did not introduce a native AppBar API. Acceptable in the context of the Phase 2 goals, but not fully in line with the original plan (see acceptance criteria in `phase-2-plan.md`).

### 4.3 Z-order level `'normal'` not empirically verified
**Severity:** Medium

The code correctly comments that `'normal'` must be tested on real Windows hardware. This verification agent cannot perform a GUI test. If `'normal'` lies beneath the taskbar, the documented fallback `'pop-up-menu'` is provided.

### 4.4 `display-metrics-changed` can fire without a work-area change
**Severity:** Low

The deduplication in `main.ts` catches this, but `onWorkAreaChanged` itself reacts to all three events and invokes the callback even when nothing has changed. Since `main.ts` filters, this is practically not a problem, but it would be cleaner to encapsulate it in the adapter itself.

---

## 5. Recommended fixes / follow-up

1. **Clean up the git working area:** Check whether the additional changes (CI, README, assets from Phase 1) should already be committed, so that `git status` for Phase 2 only shows the expected files.
2. **Manual Windows smoke test:** Check on real Windows hardware:
   - Beaver stays above the visible taskbar (`'normal'`).
   - Taskbar top/left/right → beaver stays within the work area.
   - Auto-hide: confirm the documented behavior.
   - If needed: test the fallback to `'pop-up-menu'` and decide definitively.
3. **Optional adapter strengthening:** `onWorkAreaChanged` could deduplicate internally so that the callback only fires on real changes.
4. **Tray icon contrast:** Plan a visual design gate for dark taskbars in Phase 4 (BL-WIN-10/HiDPI).

---

## 6. Overall status

**PASSED WITH WARNINGS**

The implementation matches the plan and the review recommendations, all automated checks are green, and the new tests are sensible. The warnings concern only:
- Runtime behavior that can only be verified on real Windows hardware (Z-order, auto-hide).
- Additional file changes in the working area that lie outside the Phase 2 scope.

Approval for Phase 2 is recommended on the condition that the listed manual smoke tests on Windows are carried out promptly.
