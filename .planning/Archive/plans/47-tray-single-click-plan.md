# Plan #47 — Tray context menu also opens on left-click under Windows

## 1. Goal & acceptance criteria

Under Windows, a single **left-click** on the tray icon opens the same context menu that today only appears on right-click (Electron: `tray.on('click')` + `tray.popUpContextMenu()`).

Acceptance criteria:

- Left-click on the tray icon opens the current context menu under Windows (identical content to right-click: pet label, Pause/Resume, Growth submenu, Quit).
- Right-click keeps working exactly as before (the default behavior of `setContextMenu()` is not touched).
- macOS behavior stays **byte-identical**: no handler, no double-opening. Linux likewise unchanged.
- The menu still shows the current state after a `refresh()` (e.g. XP update, pause toggle) — the left-click handler must not hold onto a stale `Menu` object.
- No handler stacking: `refresh()` runs on every XP update (`main.ts:307`) — registration happens exactly once, not per rebuild.
- Change limited to `src/main/tray.ts` + `src/main/tray.test.ts`. No new dependencies, `package.json`/`package-lock.json` unchanged.
- `npm test` (389 existing tests + new ones) green, `npm run typecheck` and `npm run lint` clean.

## 2. Design decision

### 2.1 Handler placement: once in `createTray()`, never in `rebuildMenu()`

`rebuildMenu()` (`src/main/tray.ts:96-104`) is called again on every state change — among others on every XP tick via `tray.refresh()` in `main.ts:307`. A listener registered there would accumulate per rebuild (N pop-ups per click). The handler is therefore registered **once** in `createTray()` right after `tray.setToolTip(...)` (`tray.ts:94`), **before** the first `rebuildMenu()` call.

### 2.2 Rebuild safety: `popUpContextMenu()` without an argument

The handler calls `tray.popUpContextMenu()` **without arguments**. Per the Electron API, a call without the `menu` parameter opens whichever menu was most recently set via `setContextMenu()`. The closure thus captures only `tray`, never a `Menu` object — after every `refresh()` the same handler automatically shows the freshly built menu. No additional state, no update path needed.

### 2.3 Platform gate: yes, `process.platform === 'win32'`

**Decision: the handler is registered only on Windows.**

Rationale:

- **macOS:** A menu set via `setContextMenu()` already opens natively on left-click there (the desired behavior exists). Whether Electron suppresses the `click` event on darwin when a menu is set is not documented in the pinned `electron.d.ts` (43.1.0) (the suppression note only appears on `mouse-up`/`mouse-down`) — the implementation does not speculate about it: the gate keeps macOS byte-identical, regardless of darwin click behavior.
- **Linux:** per the pinned `electron.d.ts`, `popUpContextMenu` is marked `@platform darwin,win32` (d.ts:15380) — not available on Linux; an ungated handler would call a non-existent API there. The gate is therefore **mandatory**, not merely cautious. (Additionally, tray-click support is inconsistent depending on the desktop/AppIndicator.)
- **Windows:** left-click = "action/open menu" is the established tray convention (owner's wish). The `click` event fires on Windows only for left-click; right-click continues to trigger the default context menu (plus the `right-click` event, which we do not use). No conflict, no double popup.
- `process.platform` is read at runtime in `createTray()` — the same pattern as `loadTrayIcon()` (`tray.ts:82-85`), which makes it testable with the existing `withPlatform` test helper.

### 2.4 Testability without extracting new production functions

`createTray()` is deliberately untestable today (`tray.test.ts:31-35`: the Electron import under Node only yields a path string; the tests never call `Tray`/`Menu` APIs). Instead of contorting production code (an extracted `attachSingleClickMenu` helper function was discarded as a fallback), the **existing Electron mock in `tray.test.ts`** is extended with a minimal fake `Tray` class and `Menu.buildFromTemplate`. That makes `createTray()` itself testable end-to-end — including the two risky properties (exactly-one registration, platform gate) that an extracted helper function would precisely *not* cover. The change stays limited to the two target files.

## 3. Concrete change list per file

### `src/main/tray.ts` (only production change, ~8 lines incl. comment)

In `createTray()`, insert right after line 94 (`tray.setToolTip('Beaver Buddy');`):

```ts
// Windows convention: a single left-click opens the tray menu, but Electron
// only shows a setContextMenu() menu on right-click there — wire it manually.
// win32-gated: popUpContextMenu() exists only on darwin/win32 (not Linux),
// and the gate keeps macOS/Linux behavior byte-identical. Registered once,
// outside rebuildMenu(): popUpContextMenu() without arguments always pops
// the menu most recently passed to setContextMenu(), so refresh() needs no
// handler changes.
if (process.platform === 'win32') {
  tray.on('click', () => tray.popUpContextMenu());
}
```

Comment style follows the file (English, explanatory block comments like `tray.ts:26-27`, `77-80`). No change to `buildMenuTemplate`, `rebuildMenu`, `TrayHandle`, `main.ts`, or other files.

### `src/main/tray.test.ts` (test infrastructure + new tests)

1. **Extend the `vi.mock('electron', …)` factory** (today lines 8-29): in addition to `app`/`nativeImage`, the mock exports
   - a fake `Tray` class: collects instances (`static instances`), stores listeners per event (`on(event, listener)` → `Map<string, Array<() => void>>`), counts `popUpContextMenu()` calls incl. argument list, logs `setContextMenu()` calls. The constructor accepts the icon (the mock `nativeImage` already returns a plain object).
   - `Menu: { buildFromTemplate: vi.fn((template) => ({ template })) }` — the return value is irrelevant since only `setContextMenu` calls are counted.
   - The `...actual` spread and the existing `app`/`nativeImage` mocks stay unchanged → no breakage of the running tests.
2. **Update the explanation comment (lines 31-35)**: sharpen the statement "never calling Tray/Menu/app APIs" — from now on the *mocked* `Tray`/`Menu` APIs are called; still no real Electron process needed.
3. **New `describe('createTray single-click menu')`** with the `withPlatform` helper (pattern from the `loadTrayIcon` tests, lines 154-162, lift to module level if needed so both describes can use it) and the existing `callbacks()` factory pattern:
   - **win32 registers exactly one `click` listener** whose invocation calls `popUpContextMenu` exactly once **without arguments** (rebuild safety: no menu object captured).
   - **No stacking:** after `handle.refresh(); handle.refresh();` there is still exactly **one** `click` listener; the listener keeps working afterwards (`popUpContextMenu` counter increments).
   - **darwin:** `createTray()` registers **no** `click` listener; `setContextMenu` was still called (rebuild path unchanged).
   - **linux:** no `click` listener (the gate is win32-specific).
   - `beforeEach`: reset `FakeTray.instances.length = 0` (pattern: `createdIcons.length = 0`, line 165).
   - Access listeners/counters statically via `FakeTray.instances`, not via `handle.tray` (`TrayHandle.tray` stays typed as the real `Tray` — otherwise casts would be needed).
   - The fake class is defined via `vi.hoisted`: the `vi.mock` factory runs before module-wide declarations, a direct reference to a top-level class would be in the TDZ (the existing `createdIcons` reference only works because it is lazily evaluated inside the `createFromPath` callback).

## 4. Test plan

- `npm test` — all 389 existing tests plus the ~4 new ones green. Existing suites (`formatPetLabel`, `buildMenuTemplate`, `loadTrayIcon`) must not change.
- `npm run typecheck` — clean (the fake `Tray` is typed only in the test file; production types of `TrayHandle.tray: Tray` untouched).
- `npm run lint` — clean.
- **Manual live verification on Windows** (after implementation, not part of the unit tests — same category as "visual tray verified live", cf. `docs/design-reviews`): start the app, single left-click on the tray icon → menu opens; right-click → menu opens identically; toggle pause / inject XP (`--inject-xp`), then left-click again → menu shows the updated label. Optionally record in the verification report.

## 5. Risks / open questions

- **Double popup on Windows with the menu open:** with the menu already open, another left-click may close the menu and immediately reopen it (standard behavior of `popUpContextMenu`) — cosmetic, acceptable, no code needed.
- **Double-click on Windows:** `double-click` fires in addition to two `click` events → two `popUpContextMenu()` calls (menu closes and opens). Cosmetic, known, deliberately no code (KISS).
- **Electron version drift:** the claim about argument-less `popUpContextMenu()` is based on the pinned Electron API (43.1.0), so no acute risk. Deliberately no assumption is made about the darwin `click` behavior (see §2.3); the gate makes the Windows change independent of it.
- **Mock honesty:** the fake `Tray` class checks wiring, not native behavior — a deliberate trade-off, covered by the manual Windows live verification (section 4). The risk of the fakes deviating from the real API is minimal with three methods (`on`, `popUpContextMenu`, `setContextMenu`).
- **Open (not a blocker):** whether left-click should long-term get a different primary action instead of the menu (e.g. overlay focus) is a separate product decision — this change implements exclusively the owner's wish "left-click = menu".
