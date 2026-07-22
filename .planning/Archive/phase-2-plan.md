# Beaver Buddy — Phase 2: Core Windows Experience

**Status:** Plan / Not started  
**Build items:** BL-WIN-3, BL-WIN-4  
**Goal:** Overlay and tray behave natively on Windows; the beaver always stays visible and is never obscured by the taskbar.

---

## 1. Phase summary

Phase 1 stabilized build, packaging, and CI for Windows. Phase 2 focuses on the two visible main blockers:

1. **BL-WIN-3 Overlay adapter for Windows**  
   The overlay window must not slide behind the taskbar on Windows. This requires platform-specific handling of the `setAlwaysOnTop` level, window size/position, and roaming bounds. The available work area (`screen.getPrimaryDisplay().workArea`) replaces the raw screen resolution as the reference size for movement, climbing behavior, and hatch positioning.

2. **BL-WIN-4 Tray adapter for Windows**  
   On Windows the colored `assets/tray-icon.png` must be loaded. `setTemplateImage` is only allowed on macOS. The menu itself remains unchanged.

Both items are small, isolated adapter changes. They introduce no new dependencies, change no renderer animation logic, and leave the existing unit tests untouched.

---

## 2. Dependencies

| Build item | Needed by | Rationale |
|------------|-----------|-----------|
| BL-WIN-3   | —         | Can be implemented independently. |
| BL-WIN-4   | BL-WIN-2  | The colored `assets/tray-icon.png` was created in Phase 1 (BL-WIN-2). |
| Phase 2    | Phase 1   | Build/packaging/CI must already run on Windows. |

**Order within Phase 2:**
1. Implement BL-WIN-3.
2. Implement BL-WIN-4 (quick, since the asset exists).
3. Run the full build + tests.
4. Perform manual smoke tests on Windows.

---

## 3. BL-WIN-3: Overlay adapter for Windows

### 3.1 Problem statement

`src/main/main.ts` currently contains:

```ts
win.setAlwaysOnTop(true, 'floating');
```

On macOS `'floating'` correctly keeps the window above normal apps. On Windows, however, a window at this level ends up **below the taskbar** when positioned at the bottom edge. In addition, the roaming bounds are currently based on the window size, which coincidentally matches the `workArea` as long as the taskbar does not change. But there is no reaction to taskbar changes (position, auto-hide, size) and no explicit guarantee that the beaver always stays inside the `workArea`.

### 3.2 Approach

A small platform-specific adapter that takes over the following three tasks:

1. Choose the `setAlwaysOnTop` level per platform.
2. Provide the available work area (`workArea`) and observe changes.
3. Smoothly realign the overlay window on changes.

### 3.3 New file: `src/main/overlay-adapter.ts`

```ts
import { BrowserWindow, screen, type Display } from 'electron';

export type TaskbarEdge = 'top' | 'bottom' | 'left' | 'right' | 'none';

export interface WorkAreaInfo {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly taskbarEdge: TaskbarEdge;
}

function detectTaskbarEdge(bounds: Electron.Rectangle, workArea: Electron.Rectangle): TaskbarEdge {
  if (workArea.y > bounds.y) return 'top';
  if (workArea.x > bounds.x) return 'left';
  if (workArea.x + workArea.width < bounds.x + bounds.width) return 'right';
  if (workArea.y + workArea.height < bounds.y + bounds.height) return 'bottom';
  return 'none';
}

function toWorkAreaInfo(display: Display): WorkAreaInfo {
  return {
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workArea.width,
    height: display.workArea.height,
    taskbarEdge: detectTaskbarEdge(display.bounds, display.workArea),
  };
}

export function getPrimaryWorkAreaInfo(): WorkAreaInfo {
  return toWorkAreaInfo(screen.getPrimaryDisplay());
}

export function configureAlwaysOnTop(win: BrowserWindow): void {
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
  } else {
    // 'normal' is sufficient on Windows to stay above normal windows
    // without reaching into the screensaver level.
    // 'pop-up-menu' is the fallback in case 'normal' fails under
    // certain taskbar configurations.
    win.setAlwaysOnTop(true, 'normal');
  }
}

export function fitWindowToWorkArea(win: BrowserWindow, info: WorkAreaInfo): void {
  win.setBounds({
    x: info.x,
    y: info.y,
    width: info.width,
    height: info.height,
  }, true); // true = animate, smooth shift on changes
}

export function onWorkAreaChanged(callback: (info: WorkAreaInfo) => void): () => void {
  const handler = () => callback(getPrimaryWorkAreaInfo());
  screen.on('display-added', handler);
  screen.on('display-removed', handler);
  screen.on('display-metrics-changed', handler);
  return () => {
    screen.off('display-added', handler);
    screen.off('display-removed', handler);
    screen.off('display-metrics-changed', handler);
  };
}
```

**Rationale for `normal` vs. `pop-up-menu`:**  
The main plan names both options. We start with `'normal'` because it is closest to the macOS behavior (above normal windows, but not above everything). If tests show that the taskbar still obscures the beaver with auto-hide, we switch to `'pop-up-menu'`. This decision is documented in a code comment and in the acceptance criteria.

### 3.4 Changes in `src/main/main.ts`

#### Step 1: Import the adapter

```ts
import { configureAlwaysOnTop, fitWindowToWorkArea, getPrimaryWorkAreaInfo, onWorkAreaChanged } from './overlay-adapter';
```

#### Step 2: Adjust `createWindow()`

Replace:

```ts
win.setAlwaysOnTop(true, 'floating');
```

with:

```ts
configureAlwaysOnTop(win);
```

The rest of the window construction remains unchanged (`skipTaskbar: true`, `focusable: false`, `transparent: true`, `frame: false`, etc.).

#### Step 3: Observe work-area changes

After `mainWindow = createWindow();` in `app.whenReady()`:

```ts
mainWindow = createWindow();

let workAreaInfo = getPrimaryWorkAreaInfo();
fitWindowToWorkArea(mainWindow, workAreaInfo);

const unsubscribeWorkArea = onWorkAreaChanged((next) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  workAreaInfo = next;
  fitWindowToWorkArea(mainWindow, next);
  // Inform the renderer about the new available area
  mainWindow.webContents.send(BOUNDS_CHANGED_CHANNEL, {
    width: next.width,
    height: next.height,
  });
});

mainWindow.on('closed', () => {
  unsubscribeWorkArea();
});
```

> **Note:** `fitWindowToWorkArea` with `animate: true` ensures the beaver smoothly walks back into the new area when the taskbar grows, instead of being cut off.

### 3.5 Changes in `src/renderer/renderer.ts`

The renderer currently uses `window.innerWidth`/`window.innerHeight` as the roaming bounds. That remains correct as long as the main window scales exactly to the `workArea`. When the `workArea` changes, however, the canvas size must be reset and the roaming state aligned to the new bounds.

#### Step 1: Extend the IPC handler in `src/main/preload.ts`

New channel in `src/main/ipc-channels.ts`:

```ts
export const BOUNDS_CHANGED_CHANNEL = 'state:bounds';
```

New entry in `src/main/preload.ts` (including inline literal, since preload cannot import sibling modules):

```ts
const BOUNDS_CHANGED_CHANNEL = 'state:bounds'; // must match src/main/ipc-channels.ts

contextBridge.exposeInMainWorld('beaverBuddy', {
  // ... existing handlers
  onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void): void => {
    ipcRenderer.on(BOUNDS_CHANGED_CHANNEL, (_event, bounds) => callback(bounds));
  },
});
```

#### Step 2: Add the renderer handler

In `src/renderer/renderer.ts`:

```ts
function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  needsDraw = true;
}

window.addEventListener('resize', resizeCanvas);

window.beaverBuddy.onBoundsChanged((next) => {
  // The window size was adjusted by the main process; innerWidth/innerHeight
  // should already match next, but we set the canvas explicitly.
  resizeCanvas();
  // Ensure the beaver stays within the new area.
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

#### Step 3: Helper function `clampRoamStateToBounds`

In `src/renderer/renderer.ts` or `src/renderer/roam.ts`:

```ts
function clampRoamStateToBounds(state: RoamState, b: Bounds): RoamState {
  const maxX = Math.max(0, b.width - BEAVER_TILE_PX * PET_SCALE);
  const ground = Math.max(0, b.height - BEAVER_TILE_PX * PET_SCALE);
  return {
    ...state,
    x: Math.min(Math.max(state.x, 0), maxX),
    y: Math.min(state.y, ground),
    targetX: Math.min(Math.max(state.targetX, 0), maxX),
    climbTargetY: Math.min(state.climbTargetY, ground),
  };
}
```

**Alternative:** If `roam.ts` should hold this logic (pure state), `clampRoamStateToBounds` can live as an export in `roam.ts` and be imported into `renderer.ts`. This avoids duplication with `maxX`/`groundY`.

### 3.6 Tests

`src/main/overlay-adapter.ts` is testable in isolation from Electron UI APIs:

- `detectTaskbarEdge` for all four edges + auto-hide (simulated by different bounds/workArea).
- `configureAlwaysOnTop` is pure pass-through; a unit test with a mock `BrowserWindow` verifies that `'normal'` is used on `win32` and `'floating'` on `darwin`.
- `onWorkAreaChanged` registers/deregisters the three `screen` events correctly.

**Existing tests stay green:**

- `roam.test.ts` does not change.
- `tray.test.ts` does not change.
- No new dependencies.

---

## 4. BL-WIN-4: Tray adapter for Windows

### 4.1 Problem statement

In `src/main/tray.ts`:

```ts
const iconPath = path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');
const icon = nativeImage.createFromPath(iconPath);
icon.setTemplateImage(true);
```

- `tray-iconTemplate.png` is meant for macOS and is rendered there as a template image.
- `setTemplateImage(true)` has no effect on Windows and can lead to an invisible/wrong icon.
- In Phase 1, `assets/tray-icon.png` (colored) was created.

### 4.2 Approach

Platform-specific icon selection and template-image flag.

### 4.3 Changes in `src/main/tray.ts`

Replace the hardcoded lines with:

```ts
const iconFileName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
const iconPath = path.join(app.getAppPath(), 'assets', iconFileName);
const icon = nativeImage.createFromPath(iconPath);
if (process.platform === 'darwin') {
  icon.setTemplateImage(true);
}
```

Alternatively, a small helper function `loadTrayIcon()` can encapsulate the logic:

```ts
function loadTrayIcon(): NativeImage {
  const iconFileName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', iconFileName));
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}
```

### 4.4 Tests

`tray.test.ts` tests only `buildMenuTemplate` and `formatPetLabel`. Icon loading is not covered, so the tests stay green.

Optionally, a new test for `loadTrayIcon` can be added that mocks `process.platform` and checks whether the correct filename is chosen and `setTemplateImage` is only called on `darwin`. This is not strictly required, however.

---

## 5. Acceptance criteria for the whole phase

### BL-WIN-3

- [ ] On Windows the overlay window starts with `setAlwaysOnTop(true, 'normal')` (or `'pop-up-menu'` if validated).
- [ ] On macOS `setAlwaysOnTop(true, 'floating')` is retained.
- [ ] The window is aligned exactly to `screen.getPrimaryDisplay().workArea`.
- [ ] When the taskbar position, size, or auto-hide state changes, the `workArea` is recalculated and the window smoothly adjusted.
- [ ] The beaver always stays within the available work area; it does not disappear behind the taskbar.
- [ ] `skipTaskbar: true`, `focusable: false`, `transparent: true` are retained.
- [ ] Click-through keeps working (`setIgnoreMouseEvents(true)`).
- [ ] No focus stealing by the overlay.

### BL-WIN-4

- [ ] On Windows `assets/tray-icon.png` is shown as the colored tray icon.
- [ ] On macOS `assets/tray-iconTemplate.png` with `setTemplateImage(true)` remains unchanged.
- [ ] The tray context menu opens and all entries work.

### Whole phase

- [ ] `npm run build` completes on Windows and macOS.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` are green.
- [ ] `npx electron-builder --win --publish never` continues to produce working installers.
- [ ] Manual smoke tests on Windows confirm: beaver visible, tray menu works, taskbar changes are survived.

---

## 6. Risks and mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `'normal'` is not enough to stay above the auto-hide taskbar | Beaver is briefly obscured | Medium | Document the fallback to `'pop-up-menu'` and check it in the acceptance test. |
| `screen` events do not fire for every taskbar change | Beaver stays outside the new workArea | Low | Consider an additional `resize` event on `BrowserWindow` or a periodic check (only if empirically needed). |
| `fitWindowToWorkArea` with animation causes a brief visual jump | Beaver "stutters" on taskbar change | Low | Animation can be set to `false` if disruptive. |
| Renderer receives `state:bounds` before `did-finish-load` | Message is lost | Low | Send the initial bounds request only after `did-finish-load`, or have the renderer ignore early events. |
| Colored tray icon on Windows is hard to see on a dark taskbar background | Poor UX | Medium | Plan a design gate for a high-contrast icon in Phase 4 (BL-WIN-10/HiDPI). |
| `nativeImage.createFromPath` with a missing `tray-icon.png` does not throw immediately, but the icon is empty | Empty tray icon | Low | Build script/CI checks the existence of the asset files; manual smoke test. |

---

## 7. Test and verification steps

### 7.1 Automated tests (local + CI)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx electron-builder --win --publish never
```

Expected result:

- TypeScript without errors.
- ESLint without errors.
- All existing tests green.
- Build output present in `dist/` and `release/`.

### 7.2 New unit tests

- `src/main/overlay-adapter.test.ts`:
  - `detectTaskbarEdge` for top/bottom/left/right/none.
  - `configureAlwaysOnTop` chooses the correct level for `win32` and `darwin`.
  - `onWorkAreaChanged` subscribes/unsubscribes the three events.

- (Optional) extend `src/main/tray.test.ts`:
  - Mock for `process.platform` and check the chosen icon name.

### 7.3 Manual smoke tests on Windows

1. **Start the app:**
   ```bash
   npm start
   ```
2. **Check visibility:** The beaver walks along the bottom edge and is visible above the taskbar.
3. **Move the taskbar:** Right-click taskbar → taskbar settings → change position (top/left/right). The beaver stays visible and within the workArea.
4. **Enable auto-hide:** Automatically hide the taskbar. The beaver stays visible, even when the taskbar slides in.
5. **Fullscreen app:** Editor/browser in fullscreen mode. The beaver should remain visible (no focus stealing, but the overlay stays on top).
6. **Click-through:** Mouse clicks on the beaver pass through to the application below.
7. **Task Manager:** No entry in the Windows taskbar (`skipTaskbar: true`).
8. **Tray:** Colored icon visible, right-click opens the menu, Pause/Resume/Quit work.

### 7.4 Manual regression on macOS

1. Start the app.
2. The beaver stays above the dock menu bar.
3. The tray icon is a template image and adapts to dark/light mode.
4. The menu works as before.

---

## 8. Files to be touched

| File | Change | Build item |
|------|--------|------------|
| `src/main/overlay-adapter.ts` | New: platform adapter for AlwaysOnTop, work area, taskbar edge | BL-WIN-3 |
| `src/main/main.ts` | Import adapter, `configureAlwaysOnTop` instead of `'floating'`, work-area change handler | BL-WIN-3 |
| `src/main/ipc-channels.ts` | New channel `state:bounds` | BL-WIN-3 |
| `src/main/preload.ts` | `onBoundsChanged` expose | BL-WIN-3 |
| `src/renderer/renderer.ts` | Bounds-change handler, canvas resize, clamp RoamState | BL-WIN-3 |
| `src/main/overlay-adapter.test.ts` | New tests | BL-WIN-3 |
| `src/main/tray.ts` | Platform-specific icon selection + template image only on macOS | BL-WIN-4 |
| `src/main/tray.test.ts` | Optional: test for icon loading | BL-WIN-4 |

**Not to be touched:**

- `src/renderer/roam.ts` (pure state, no platform-specific logic).
- `src/main/usage/paths.ts` (topic of Phase 3 / BL-WIN-5).
- `src/main/mrr/keychain.ts` (deferred to BL-WIN-6).
- `package.json`, `electron-builder.yml` (Phase 1 completed).

---

## 9. Open points / follow-up

- **Z-order fallback:** If `'normal'` is not sufficient on Windows, `'pop-up-menu'` must be tested and documented if applicable.
- **Multi-monitor:** Currently only `screen.getPrimaryDisplay()`. A later phase could migrate the beaver to the new primary monitor on display switches.
- **HiDPI/scaling:** Remains in Phase 4 (BL-WIN-8).
- **Tray icon design:** Colored icon works for now; design gate in Phase 4.

---

## 10. Summary for the team

Phase 2 is a lean, low-risk step: two platform-specific adapters fix the most visible Windows behavior (overlay Z-order + tray icon). The changes are confined to a few files in the main process, require no new dependencies, and leave the renderer logic and tests largely untouched. After implementation, the beaver should always stay visible on Windows and the colored tray icon should be displayed correctly.
