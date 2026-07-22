# Beaver Buddy — Phase 2: Core Windows Experience — Implementation Log

**Date:** 2026-07-15  
**Build items:** BL-WIN-3 (Overlay adapter for Windows), BL-WIN-4 (Tray adapter for Windows)  
**Implemented by:** Implementation agent

---

## 1. Summary of changes

### 1.1 New file: `src/main/overlay-adapter.ts`

Introduced as a platform-specific adapter for overlay position, Z-order, and taskbar detection:

- `detectTaskbarEdge(bounds, workArea)` — determines `top`/`bottom`/`left`/`right`/`none` by comparing display bounds and work area.
- `getPrimaryWorkAreaInfo()` — returns the work area of the primary display, including the taskbar edge.
- `getOverlayWindowBounds(display)` — computes the window bounds from the work area.
- `configureAlwaysOnTop(win)` — sets `floating` on macOS, `normal` on Windows/Linux.
- `fitWindowToWorkArea(win, info)` — applies window bounds immediately (`setBounds(..., false)`), without animation.
- `onWorkAreaChanged(callback)` — subscribes to `display-added`, `display-removed`, and `display-metrics-changed` and returns an unsubscribe handler.

### 1.2 Changes to `src/main/main.ts`

- Imports the overlay adapter and `BOUNDS_CHANGED_CHANNEL`.
- `createWindow()` uses `configureAlwaysOnTop(win)` instead of the hardcoded `'floating'`.
- After the window is created, `fitWindowToWorkArea(mainWindow, lastWorkArea)` is called.
- The `onWorkAreaChanged` handler stores the latest work area and only calls `setBounds` when `x/y/width/height` actually change.
- On work-area changes, the new bounds are sent to the renderer via IPC (`state:bounds`).
- `did-finish-load` explicitly sends the initial bounds to the renderer.
- `--smoke` additionally returns `boundsMatchWorkArea`.

### 1.3 IPC channel `state:bounds`

- `src/main/ipc-channels.ts`: `BOUNDS_CHANGED_CHANNEL = 'state:bounds'`.
- `src/main/preload.ts`: `onBoundsChanged` exposed via `contextBridge`; channel name as an inline literal (preload cannot import sibling modules).

### 1.4 Renderer changes

- `src/renderer/roam.ts`: New exported function `clampRoamStateToBounds(state, bounds)` uses the existing `maxX`/`groundY` helpers.
- `src/renderer/renderer.ts`:
  - `Window.beaverBuddy` interface extended with `onBoundsChanged`.
  - The handler sets `canvas.width/height` explicitly from the IPC bounds (not `window.innerWidth/Height`).
  - The roaming state is clamped to the new bounds after a bounds change.

### 1.5 Tray adapter for Windows (`src/main/tray.ts`)

- New helper function `loadTrayIcon()`:
  - macOS: `assets/tray-iconTemplate.png` + `setTemplateImage(true)`.
  - Windows/Linux: `assets/tray-icon.png` (colored), no `setTemplateImage`.

### 1.6 Tests

- `src/main/overlay-adapter.test.ts` (new):
  - `detectTaskbarEdge` for all four edges + `none`.
  - `configureAlwaysOnTop` for `darwin`, `win32`, `linux`.
  - `fitWindowToWorkArea` checks `setBounds(..., false)`.
  - `onWorkAreaChanged` checks subscribe/unsubscribe and event firing.
- `src/main/preload.test.ts` (new):
  - Verifies that `onBoundsChanged` is exposed via `contextBridge`.
  - Simulates `ipcRenderer.on('state:bounds', ...)` and verifies forwarding to the callback.
- `src/main/tray.test.ts` (extended):
  - Tests for `loadTrayIcon()` on `win32`, `darwin`, `linux`, including template-image behavior.

---

## 2. Decisions

### 2.1 Auto-hide taskbar

**Finding:** `workArea` and `bounds` are often identical on Windows with auto-hide enabled; reliably detecting the taskbar edge is not possible without the native AppBar API.

**Decision:** Auto-hide was explicitly removed from the acceptance criteria. The code documents this in `detectTaskbarEdge` and `getPrimaryWorkAreaInfo`: with auto-hide, `taskbarEdge: 'none'` is returned and the window is aligned to the full screen size. The beaver can briefly be obscured by an auto-hide bar sliding in. The native AppBar API was not introduced because it would require new dependencies (e.g. `node-ffi-napi`) — contradicting CLAUDE.md and the review findings.

### 2.2 Window animation on bounds changes

**Decision:** `fitWindowToWorkArea` uses `setBounds(..., false)` (no animation). Rationale:

- Avoids asynchrony between the main process and the renderer.
- Transparent, click-through windows can flicker/ghost during animated resizes on Windows.
- The "smoothness" of the repositioning is achieved through the roaming state: `clampRoamStateToBounds` ensures the beaver walks itself into the new area when the work area shrinks.

### 2.3 Renderer bounds

**Decision:** The renderer uses only the explicit bounds from the `state:bounds` IPC channel. `canvas.width/height` are set directly from the payload in the `onBoundsChanged` handler; `window.innerWidth/Height` now serve only as an initial fallback (the window is already aligned to the work area when created).

### 2.4 Z-order level (`setAlwaysOnTop`)

**Decision:**

- macOS: `floating` (unchanged).
- Windows/Linux: `normal`.

**Rationale:** `normal` is the lowest topmost level that keeps the window above normal applications without floating above fullscreen apps or system UI. The review called for an empirical test on real Windows hardware. This agent cannot perform such a test. Therefore `normal` was implemented as the conservative starting choice and documented in a code comment. If `normal` ends up beneath the taskbar on real hardware, the documented fallback is `'pop-up-menu'` (higher level, but potentially intrusive over fullscreen apps).

### 2.5 Deduplication of work-area changes

**Decision:** `main.ts` stores `lastWorkArea` and only calls `fitWindowToWorkArea` + `webContents.send` when at least one of the `x/y/width/height` fields has changed. This avoids unnecessary `setBounds` calls on DPI/scaling changes that do not alter the work area.

### 2.6 No new dependencies

No new npm packages were added. All changes use existing Electron/Node APIs.

---

## 3. Test results

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ green |
| `npm run lint` | ✅ green |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npm run build` | ✅ green |
| `npx electron-builder --win --publish never` | ✅ green |

New test coverage:

- `src/main/overlay-adapter.test.ts`: 14 tests
- `src/main/preload.test.ts`: 3 tests
- `src/main/tray.test.ts`: +3 tests for `loadTrayIcon`

Existing tests remained green, unchanged.

---

## 4. Manual smoke tests

This agent cannot perform GUI-based tests. The following checks must be verified on real Windows hardware:

1. **Z-order:** Beaver stays above the visible taskbar (`setAlwaysOnTop(true, 'normal')`). If not, test the `'pop-up-menu'` fallback.
2. **Taskbar position:** Move the taskbar to the top/left/right; the beaver stays within the work area.
3. **Auto-hide:** The beaver can briefly be obscured by the taskbar sliding in — documented behavior.
4. **Tray icon:** Colored `assets/tray-icon.png` visible; right-click menu works.
5. **Click-through:** Mouse clicks still pass through the overlay.
6. **Fullscreen app:** Beaver stays visible and does not steal focus.

---

## 5. Open issues / follow-up

- **Z-order validation:** Empirical test on Windows 10/11 required to decide definitively between `'normal'` and `'pop-up-menu'`.
- **Auto-hide:** A robust solution would require the Windows AppBar API (`SHAppBarMessage`). This was deliberately not implemented, as it requires native dependencies.
- **Tray icon contrast:** The colored icon on a dark Windows tray background was not visually checked. Phase 4 (BL-WIN-10/HiDPI) should include a design gate.
- **Multi-monitor:** Currently only the primary display (`screen.getPrimaryDisplay()`). A later phase could handle display switches.
- **HiDPI/scaling:** Not part of this phase; planned for Phase 4.

---

## 6. Files touched

| File | Change |
|------|--------|
| `src/main/overlay-adapter.ts` | new |
| `src/main/overlay-adapter.test.ts` | new |
| `src/main/preload.test.ts` | new |
| `src/main/main.ts` | Overlay adapter integration, bounds IPC, smoke test extension |
| `src/main/ipc-channels.ts` | `BOUNDS_CHANGED_CHANNEL` |
| `src/main/preload.ts` | `onBoundsChanged` expose |
| `src/renderer/renderer.ts` | Bounds-change handler, canvas resize from IPC |
| `src/renderer/roam.ts` | `clampRoamStateToBounds` |
| `src/main/tray.ts` | platform-specific icon selection |
| `src/main/tray.test.ts` | Tests for `loadTrayIcon` |
| `.flightplan/Archive/phase-2-implementation-log.md` | new (this log) |
