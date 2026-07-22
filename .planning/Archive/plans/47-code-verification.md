# Code Verification #47 — Tray left-click opens the context menu (Windows)

Reviewed: only the #47 hunks in `src/main/tray.ts` and `src/main/tray.test.ts` (`git diff`), against the pinned Electron API (`node_modules/electron/electron.d.ts`, electron **43.1.0**), `src/main/main.ts`, `package.json`/`package-lock.json`. Plan: `47-tray-single-click-plan.md`, plan verification: `47-tray-single-click-verification.md`.

## Verdict: APPROVED

No blockers, no minor findings requiring action. The implementation matches the plan exactly (the §3 sketch was adopted verbatim) and is technically correct.

## Verified points

### 1. Correctness of the production change (`tray.ts:96-105`)

- **One-time registration:** the `click` handler sits in `createTray()` right after `tray.setToolTip()` (`tray.ts:94`) and **outside** `rebuildMenu()` (`tray.ts:107-115`). `createTray()` runs exactly once (`main.ts:279`, only call site) → no handler stacking possible. ✔
- **Gate:** `process.platform === 'win32'` (`tray.ts:103`), a runtime check as in `loadTrayIcon()` (`tray.ts:82-85`) — same pattern, same testability. ✔
- **`popUpContextMenu()` without arguments:** d.ts:15382 confirms the signature `popUpContextMenu(menu?: Menu, position?: Point)` with the doc "Pops up the context menu of the tray icon. When `menu` is passed, the `menu` will be shown instead…" → without an argument it opens the menu most recently set via `setContextMenu()`. The closure captures only `tray`, never a `Menu` object → rebuild-safe. ✔
- **Comment technically correct:** "popUpContextMenu() exists only on darwin/win32 (not Linux)" — confirmed by `@platform darwin,win32` (d.ts:15380). "Electron only shows a setContextMenu() menu on right-click there [Windows]" — correct (right-click default; `click` fires on Windows only for left-click, right-click fires `right-click` → no double popup with the default menu). No false Electron claims; the darwin-emission claim noted in the plan verification (M1) was avoided in the comment. ✔

### 2. Tests (`tray.test.ts`)

- **Real asserts, not smoke:** listener count (`toHaveLength(1)`), argument-lessness (`popUpContextMenuCalls` `toEqual([[]])` — empty arg list), stacking test after 2× `refresh()` (3× `setContextMenu`, still 1 listener, listener works afterwards), darwin/linux negative tests incl. menu-build check (`setContextMenuCalls` `toHaveLength(1)`). ✔
- **Honest mock:** `FakeTray` covers all APIs used by `createTray()` (`on` with a listener map per event, `popUpContextMenu` with an arg log, `setContextMenu` counter, `setToolTip`); instances collected statically, accessed via `FakeTray.instances` instead of `handle.tray` (avoids casts, as recommended in M4 of the plan verification). ✔
- **`process.platform` mocked and restored cleanly:** `withPlatform` (`tray.test.ts:79-87`) saves the original descriptor and restores it in the `finally` — no leak, not even on a throw. The helper was lifted unchanged from the `loadTrayIcon` describe to module level (plan §3). Works because `defineProperty` on an existing property only changes the given attributes (configurable is preserved). The full suite is green → no cross-test leak detectable. ✔
- **`vi.hoisted` correct:** the `vi.mock` factory references `FakeTray` at mock evaluation time, which precedes module-wide `const` initializations — a TDZ error without hoisting. The rationale in the comment (`tray.test.ts:8-11`) is correct; the test run confirms it. ✔
- **Isolated + full suite stable:** `npx vitest run src/main/tray.test.ts` → 18/18 green; full suite see below. ✔

### 3. Side effects

- Existing suites (`formatPetLabel`, `buildMenuTemplate` ×2, `loadTrayIcon`) content-wise unchanged; the only touch: the `withPlatform` move and a more precise mock explanation comment. ✔
- `main.ts`: no intervention needed and none happened in the #47 scope (handler registration entirely within `createTray()`). ✔
- `package.json`: the diff contains only two asset-script lines from older rounds, **no** #47-related change, no new dependency. `package-lock.json`: unchanged. ✔
- Electron stays pinned at 43.1.0 (`package.json:27`). ✔

### 4. Executed checks

- `npx vitest run` → **42 files passed, 393 passed | 6 skipped (399)** — exactly the claimed number (baseline 389 + 4 new). ✔
- `npx vitest run src/main/tray.test.ts` → 18/18 passed (stable in isolation). ✔
- `npx eslint src/main/tray.ts src/main/tray.test.ts` → clean, no messages. ✔

### 5. Technical risk assessment (click-handler scenarios)

- **Double-click (win32):** `double-click` fires in addition to two `click` events → two `popUpContextMenu()` calls (menu closes/reopens). Cosmetic, deliberately accepted without code in plan §5 (KISS). **acceptable.**
- **Menu open + another left-click:** focus loss closes the menu, the handler reopens it immediately (brief flicker possible). Standard behavior of `popUpContextMenu`, cosmetic. **acceptable.**
- **Rapid repeated clicking:** only one listener registered → no accumulating pop-ups; repeated `popUpContextMenu()` is idempotent-like (re-popup). **acceptable.**
- **Tray in pause state:** the handler captures no state and holds no `Menu` object; pause toggling runs via menu-item `click` → `onTogglePause` → `rebuildMenu()` → `setContextMenu()`. The left-click handler then automatically shows the fresh menu (covered by the stacking test with `refresh()`). **no risk.**
- **Right-click unchanged:** `click` fires on Windows only for left-click; the `setContextMenu()` default behavior (right-click) is not touched. **no risk.**
- **darwin/linux:** the gate keeps both paths byte-identical; on Linux `popUpContextMenu` without the gate would not exist (`@platform darwin,win32`) — the gate is mandatory and correctly set. **no risk.**

## Findings

None (neither blocker nor minor). The points left open by the plan verification — M1 (darwin comment claim), M2 (Linux rationale in the comment), and M4 (static FakeTray access) — are all addressed in the implementation: the comment names the Linux platform restriction explicitly and avoids the darwin-emission claim that is not provable from the repo alone; the tests access via `FakeTray.instances`.

## Deliberate non-verification

Native Windows runtime behavior (the actual menu popup on left-click) cannot be checked by unit test — the tests verify the wiring against a fake `Tray` class. Per plan §4, a manual live verification on Windows is planned for that; it lies outside this code verification.
