# Critical Review: Phase 2 — Core Windows Experience

**Reviewed plan:** `.flightplan/Archive/phase-2-plan.md`  
**Main plan reference:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md`, section "Phase 2: Core Windows Experience"  
**Source files:** `src/main/main.ts`, `src/main/tray.ts`, `src/renderer/roam.ts`, `src/main/ipc-channels.ts`, `src/main/preload.ts`, `src/renderer/renderer.ts`, `src/main/tray.test.ts`  
**Review date:** 2026-07-15  
**Reviewer:** Critical review agent

---

## 1. Summary of the reviewed plan

Phase 2 addresses the two most visible Windows blockers from the main plan:

- **BL-WIN-3:** Introduction of a `src/main/overlay-adapter.ts` that encapsulates the `setAlwaysOnTop` level, taskbar detection via `screen.getPrimaryDisplay().workArea`, and realignment of the overlay window on display/taskbar changes. The adapter communicates new bounds to the renderer via the new IPC channel `state:bounds`.
- **BL-WIN-4:** Platform-specific icon selection in `src/main/tray.ts` — on Windows `assets/tray-icon.png` is loaded and `setTemplateImage` is only called on macOS.

The plan is small, focused, introduces no new dependencies, and is largely confined to the main process. The basic architecture (adapter module, platform-specific branches, manual smoke tests) is solid.

**However, the plan overestimates the robustness of taskbar detection and underestimates the synchronization between the main process and the renderer during window resizes.** On Windows, auto-hide taskbars and the asynchronous nature of Electron window animations lead to concrete gaps that should be closed before implementation.

---

## 2. Found problems / gaps / errors

### 2.1 Auto-hide taskbar is not detected — the plan suggests the opposite

**Severity:** Blocker

The proposed `detectTaskbarEdge` compares `display.bounds` with `display.workArea`. With an **auto-hide taskbar**, `workArea` on Windows is typically **identical to `bounds`** as long as the bar is hidden. When it slides in, it visually reserves space but does not necessarily change the Electron display's `workArea`.

This means:
- `detectTaskbarEdge` returns `'none'` with auto-hide.
- The overlay window is aligned to the full screen size.
- The beaver can disappear behind the taskbar when it slides in — exactly the opposite of BL-WIN-3.

The plan states in the acceptance criterion: "When the taskbar position, size, or auto-hide state changes, the workArea is recalculated and the window smoothly adjusted" and in the test plan: "detectTaskbarEdge for all four edges + auto-hide (simulated by different bounds/workArea)". That is misleading: different `bounds`/`workArea` simulate a **visible** taskbar, not auto-hide.

**Reference:** `src/main/overlay-adapter.ts` (planned), section 3.3; acceptance criteria section 5.

---

### 2.2 `fitWindowToWorkArea` with `animate: true` is problematic for transparent overlays

**Severity:** High

The plan uses `win.setBounds({...}, true)` (animate: `true`) to "smoothly" move the window on taskbar changes. This is problematic for two reasons:

1. **Asynchronous renderer synchronization:** While the window animates its resize, `window.innerWidth`/`innerHeight` do not change atomically. The renderer receives the `resize` event and/or the IPC message `state:bounds` at an arbitrary point during the animation. The plan claims: "The window size was adjusted by the main process; innerWidth/innerHeight should already match next" — that is an invalid assumption.
2. **Artifacts with a transparent window:** Electron window animations on transparent, click-through windows can cause flickering or ghosting on Windows, because the window manager recomposites the window during the animation.

**Reference:** `src/main/overlay-adapter.ts` (planned), section 3.3; `src/renderer/renderer.ts` (planned), section 3.5.

---

### 2.3 `setAlwaysOnTop(true, 'normal')` is unverified and possibly insufficient

**Severity:** High

The central design decision of BL-WIN-3 is that the overlay stays above the Windows taskbar. The plan relies on `setAlwaysOnTop(true, 'normal')` with the fallback `'pop-up-menu'`. That is well considered, but:

- On Windows, `setAlwaysOnTop` makes the window `HWND_TOPMOST`. Whether it lies above the taskbar (`Shell_TrayWnd`, also topmost) depends on the activation order and the specific level.
- `'normal'` is a valid Windows level per the Electron documentation, but there is no guarantee it lies above the taskbar.
- `'pop-up-menu'` lies higher, but can cause the overlay to stay above fullscreen apps and even above the Task Manager — which the "fullscreen app" acceptance criterion wants, but which can be disruptive in games/videos.

The plan treats this as a "Medium" risk and accepts manual tests. That is acceptable, but the implementation agent must **test both levels empirically** and not simply adopt `normal` as the finished solution.

**Reference:** `src/main/overlay-adapter.ts` (planned), `configureAlwaysOnTop`; section 3.3; risk table section 6.

---

### 2.4 No deduplication of work-area changes

**Severity:** Medium

`onWorkAreaChanged` calls `fitWindowToWorkArea` immediately on every `display-added`, `display-removed`, and `display-metrics-changed`. However, `display-metrics-changed` also fires on DPI/scaling changes that do not alter the `workArea`. This leads to unnecessary `setBounds` calls and potential flickering.

**Recommended fix:** Store the previous `workArea` and only reapply on an actual change.

**Reference:** `src/main/overlay-adapter.ts` (planned), `onWorkAreaChanged`.

---

### 2.5 Renderer does not receive initial bounds explicitly

**Severity:** Medium

The plan initially sets the canvas size from `window.innerWidth`/`window.innerHeight`. That works as long as the window already has its final size when loading. With the planned `fitWindowToWorkArea` call with animation after `createWindow()`, however, the window may still be animating when the renderer reaches `did-finish-load`. Then `canvas.width/height` temporarily do not match the actual workArea.

**Reference:** `src/main/main.ts` (planned), section 3.4; `src/renderer/renderer.ts` (planned), section 3.5.

---

### 2.6 Renderer handler mixes `window.innerWidth/Height` with explicit IPC bounds

**Severity:** Medium

The planned handler:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  resizeCanvas(); // sets canvas.width = window.innerWidth
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

- `resizeCanvas()` uses `window.innerWidth/Height` but ignores the explicit `next` payload.
- If `window.innerWidth/Height` has not been updated yet (see 2.2 and 2.5), the canvas is set to wrong values.
- `clampRoamStateToBounds` is only called once. While the beaver is in a `walk` or `climb`, it can briefly be drawn outside the new bounds until `tick()` pulls it back.

**Reference:** `src/renderer/renderer.ts` (planned), section 3.5.

---

### 2.7 No automated tests for the renderer integration

**Severity:** Medium

The plan's test plan provides unit tests for `overlay-adapter.ts`, but no tests for the interaction between `main.ts` → IPC → `preload.ts` → `renderer.ts`. Yet exactly this chain is the risky part of BL-WIN-3. The complexity lies not in the pure `detectTaskbarEdge`, but in the synchronous/asynchronous interaction between the main process and the renderer.

**Reference:** Section 7.2 of the plan.

---

### 2.8 Tray icon quality on Windows not checked

**Severity:** Low

The plan loads `assets/tray-icon.png` on Windows. Windows tray icons should typically be 16×16 px (or 20×20/32×32 depending on DPI). A large PNG is scaled by Electron, which can look blurry on HiDPI displays. This is planned for Phase 4 (BL-WIN-10/HiDPI), but should be explicitly noted in the test plan as a manual check.

**Reference:** `src/main/tray.ts` (planned), section 4.3; risk table section 6.

---

### 2.9 Smoke test `--smoke` does not check the work-area alignment

**Severity:** Low

The existing smoke test in `src/main/main.ts` checks `windowCreated`, `alwaysOnTop`, `ignoresMouse`, `transparent`, and `paused`. It could easily be extended with `win.getBounds()` vs. `screen.getPrimaryDisplay().workArea` to automatically detect regressions in the work-area alignment.

**Reference:** `src/main/main.ts:136-150`; test plan section 7.1/7.3.

---

### 2.10 Redundant first `fitWindowToWorkArea` call

**Severity:** Low

`createWindow()` in `src/main/main.ts` already creates the window with `x/y/width/height = workArea` (lines 95-101). The plan then adds another `fitWindowToWorkArea(mainWindow, workAreaInfo)`. That is redundant and should either be dropped or explained with a comment. If `fitWindowToWorkArea` animates, this creates an unnecessary animation step from size 0.

**Reference:** `src/main/main.ts` (planned), section 3.4.

---

## 3. Concrete improvement suggestions

### 3.1 Handle auto-hide correctly

**Files:** `src/main/overlay-adapter.ts`, `WINDOWS_PORT_PLAN.md`

- **Option A (recommended):** Document that `workArea/bounds` does **not** reliably detect auto-hide. Adjust the acceptance criterion: "The beaver stays visible with a visible taskbar; with auto-hide it can briefly be obscured by the bar sliding in, unless the native AppBar API is used."
- **Option B:** Call the Windows AppBar API (e.g. `SHAppBarMessage`) via a small native Node addon or `node-ffi-napi`. That would require a native dependency and violates the CLAUDE.md principle of introducing no new dependencies. Therefore only recommendable if auto-hide is treated as a hard requirement.
- **Option C (compromise):** When the taskbar edge is unclear, keep a small safety margin (e.g. 8 px) from the respective screen edge until the edge is unambiguous.

### 3.2 Use `fitWindowToWorkArea` without animation

**File:** `src/main/overlay-adapter.ts`

```ts
export function fitWindowToWorkArea(win: BrowserWindow, info: WorkAreaInfo): void {
  win.setBounds({ x: info.x, y: info.y, width: info.width, height: info.height }, false);
}
```

Instead, achieve the "smoothness" in the renderer: when the bounds shrink, the renderer sets the next roaming target (`targetX`, possibly `climbTargetY`) so that the beaver walks itself into the new area. This avoids window animations and keeps the pixel art integer-aligned.

### 3.3 Renderer uses explicit IPC bounds, not `window.innerWidth/Height`

**Files:** `src/main/preload.ts`, `src/renderer/renderer.ts`

```ts
// preload.ts
onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void): void => {
  ipcRenderer.on(BOUNDS_CHANGED_CHANNEL, (_event, bounds) => callback(bounds));
},

// renderer.ts
window.beaverBuddy.onBoundsChanged((next) => {
  canvas.width = next.width;
  canvas.height = next.height;
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

This removes the unsafe assumption that `window.innerWidth/Height` has already been updated.

### 3.4 Deduplication of work-area changes

**File:** `src/main/main.ts`

```ts
let lastWorkArea = getPrimaryWorkAreaInfo();
fitWindowToWorkArea(mainWindow, lastWorkArea);

const unsubscribeWorkArea = onWorkAreaChanged((next) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (
    next.x === lastWorkArea.x &&
    next.y === lastWorkArea.y &&
    next.width === lastWorkArea.width &&
    next.height === lastWorkArea.height
  ) {
    return;
  }
  lastWorkArea = next;
  fitWindowToWorkArea(mainWindow, next);
  mainWindow.webContents.send(BOUNDS_CHANGED_CHANNEL, {
    width: next.width,
    height: next.height,
  });
});
```

### 3.5 Determine the Z-order level empirically and document it

**File:** `src/main/overlay-adapter.ts`

- `configureAlwaysOnTop` should be easily swappable (constant or parameter).
- The implementation agent must test on real Windows hardware:
  1. `'normal'` — taskbar visible + auto-hide.
  2. `'pop-up-menu'` — if `'normal'` fails.
- Document the result in a code comment and in the plan. Extend the acceptance criterion: "For the final level there is a documented smoke test on Windows 10/11."

### 3.6 Integrate `clampRoamStateToBounds` into `roam.ts`

**File:** `src/renderer/roam.ts`

Since `roam.ts` already computes `maxX(bounds)` and `groundY(bounds)`, `clampRoamStateToBounds` should live there as an export and reuse the existing helper functions:

```ts
export function clampRoamStateToBounds(state: RoamState, bounds: Bounds): RoamState {
  const max = maxX(bounds);
  const ground = groundY(bounds);
  return {
    ...state,
    x: clamp(state.x, 0, max),
    y: Math.min(state.y, ground),
    targetX: clamp(state.targetX, 0, max),
    climbTargetY: Math.min(state.climbTargetY, ground),
  };
}
```

Avoids duplication of the `BEAVER_TILE_PX * PET_SCALE` computation.

### 3.7 Extend the smoke test with a work-area check

**File:** `src/main/main.ts`

```ts
const result = {
  windowCreated: !win.isDestroyed(),
  alwaysOnTop: win.isAlwaysOnTop(),
  ignoresMouse: ignoresMouseEvents,
  transparent: true,
  paused: isPaused(pauseState),
  boundsMatchWorkArea: (() => {
    const wb = win.getBounds();
    const wa = screen.getPrimaryDisplay().workArea;
    return wb.x === wa.x && wb.y === wa.y && wb.width === wa.width && wb.height === wa.height;
  })(),
};
```

### 3.8 Extend the test plan with renderer integration

**File:** `.flightplan/Archive/phase-2-plan.md`

- Explicitly note that `renderer.ts`/`preload.ts` cannot be unit-tested without a running Electron process.
- Define at least one manual test proving that `state:bounds` arrives in the renderer and the canvas size is updated correctly (e.g. via DevTools logging or a `--debug-bounds` flag).

---

## 4. GO / NO-GO recommendation

**Recommendation: GO — with critical preconditions**

Phase 2 is sensible and feasible in principle. The general direction (adapter module, platform-specific branches, minimal interventions) is right. However, the implementation agent must not ignore the problems listed in section 2.

**Preconditions for GO:**

1. **Clarify the auto-hide reality:** Either remove auto-hide from the acceptance criterion **or** plan a concrete solution (AppBar API, safety margin). The current plan suggests a robustness the algorithm does not provide.
2. **Remove the animation from `fitWindowToWorkArea`:** Use `setBounds(..., false)` and move the smoothness of movement into the renderer/roaming code.
3. **Renderer uses explicit IPC bounds:** No assumptions about `window.innerWidth/Height` during a resize.
4. **Test the Z-order level empirically:** Document why `'normal'` or `'pop-up-menu'` was chosen, based on real Windows tests.
5. **Build in deduplication:** Only call `setBounds` when the `workArea` has actually changed.

If these preconditions are met, Phase 2 is a low-risk, well-reviewable step.

---

## 5. Important notes for the implementation agent

1. **Test on real Windows hardware (not only CI).** The Z-order and taskbar detection depend heavily on the specific Windows build, DPI settings, and taskbar configuration. In particular, auto-hide and taskbars on the left/right/top edges must be checked manually.

2. **Avoid `setBounds` with animation on transparent overlays.** It causes flickering and asynchrony. Set bounds immediately and let the beaver walk itself into the new area.

3. **Keep the IPC channel `state:bounds` tightly coupled to the actual window size.** Do not send the bounds only on `display-*` events; make sure the renderer receives the correct values initially and on every actual resize.

4. **Check `tray-icon.png` visually in the Windows tray.** Dark taskbars can swallow a colored icon. Note if a higher-contrast icon is needed for Phase 4.

5. **Keep `src/renderer/roam.ts` free of platform logic.** Move `clampRoamStateToBounds` to `roam.ts` as a pure state helper, but do not introduce any `process.platform` checks in the renderer.

6. **Extend the smoke test with `boundsMatchWorkArea`.** This is a cheap automated regression guard for the central claim of BL-WIN-3.

7. **Watch out for `win.setIgnoreMouseEvents(true)`.** It is only set in `createWindow()` and does not need to be re-applied after a `setBounds` — but verify this in the smoke tests.

8. **No new dependencies without separate agreement.** The plan adheres to CLAUDE.md. If auto-hide requires a native AppBar API, that must be explicitly agreed with the project lead.

---

## 6. Checked file assets

- `assets/tray-icon.png`: Present ✅
- `assets/tray-iconTemplate.png`: Present ✅
- `assets/icon.ico`: Present ✅

The assets created in BL-WIN-2 exist, so BL-WIN-4 is not blocked by missing files.
