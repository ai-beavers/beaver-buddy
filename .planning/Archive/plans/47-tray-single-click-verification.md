# Verification Plan #47 — Tray left-click opens the context menu (Windows)

Reviewed: `.flightplan/Archive/plans/47-tray-single-click-plan.md` against `src/main/tray.ts`, `src/main/tray.test.ts`, `src/main/main.ts`, `package.json`, and the Electron API pinned in the project (`node_modules/electron/electron.d.ts`, electron **43.1.0**).

## Verdict: PLAN OK (no blockers, only clarifications/minor)

The plan is technically correct, matches the real codebase and the pinned Electron API. Implementable as written.

## Verified assumptions

1. **`click` fires on Windows on left-click despite a set `setContextMenu()`** — event suppression with a set context menu is a macOS restriction (documented in `electron.d.ts` on the darwin-only events `mouse-up`/`mouse-down`: "This will not be emitted if you have set a context menu… as a result of macOS-level constraints", d.ts ~line 15230). No such note exists for Windows; the pattern `tray.on('click')` + a set context menu is the standard approach documented for years. ✔
2. **`popUpContextMenu()` without an argument opens the menu most recently set via `setContextMenu()`** — d.ts:15382 doc: "Pops up the context menu of the tray icon. When `menu` is passed, the `menu` will be shown instead of the tray icon's context menu." Since `rebuildMenu()` (`tray.ts:96-104`) calls `setContextMenu()` again on every `refresh()`, the once-registered handler always shows the fresh menu. Rebuild-safe as claimed. ✔
3. **macOS behavior / gate justification** — On macOS a set context menu opens natively on left-click; the win32 gate leaves darwin byte-identical. Even if the gate were forgotten, there would be no double-opening risk on darwin (click emission is suppressed on macOS when a menu is set — see finding M1 regarding the strength of that evidence). **Additionally verified, not mentioned in the plan:** `popUpContextMenu` is `@platform darwin,win32` (d.ts:15382) — not available on Linux at all. The gate is therefore not just conservative for Linux, but mandatory. ✔
4. **Pitfalls** — the `bounds` argument of the `click` event: irrelevant, the handler ignores arguments. `double-click` fires in addition to two `click` events → on a double-click two `popUpContextMenu()` calls: cosmetic, already covered by the plan (§5) for the analogous case "menu open + another click". Electron 43.1.0 is pinned (`package.json:27`); the tray API has been stable for many major versions, signatures verified against the bundled `electron.d.ts`. ✔
5. **Code fit** — `createTray()` runs exactly once (`main.ts:279`, only call site; the only `new Tray` is in `tray.ts:93`; no second tray creation path). Placement after `tray.setToolTip(...)` (`tray.ts:94`) and before the first `rebuildMenu()` (`tray.ts:106`) is correct; the closure captures only `tray`, no `Menu` object. No handler stacking since registration is outside `rebuildMenu()`. The plan's line references (`tray.ts:82-85`, `94`, `96-104`; `main.ts:307`; `tray.test.ts:8-29`, `31-35`, `154-162`, `165`) are all correct. ✔
6. **Test mock structure supports the new tests** — the `vi.mock('electron')` factory (`tray.test.ts:8-29`) spreads `...actual` and overrides `app`/`nativeImage`; adding the fake `Tray` + `Menu.buildFromTemplate` follows exactly this pattern. Existing suites (`formatPetLabel`, `buildMenuTemplate`, `loadTrayIcon`) never call `Tray`/`Menu` at runtime → no breakage. The `withPlatform` helper (`tray.test.ts:154-162`) must be lifted to module level — the plan says so explicitly. ✔
7. **Scope/constraints plausible** — no new dependencies needed (Electron built-ins), no `main.ts` change needed (handler registration entirely within `createTray()`). ✔
8. **Test baseline is correct** — `npm test` run locally: **42 files, 389 passed, 6 skipped** — exactly the number the plan states as the baseline. ✔

## Findings

- **[minor] M1 — Evidence strength of the macOS click claim** (plan §2.3, planned comment in `tray.ts`): "Electron does not emit the `click` event on macOS at all while a context menu is set" — in the pinned `electron.d.ts` (43.1.0) the suppression note appears only on the darwin events `mouse-up`/`mouse-down`, not on the `click` event itself. To my knowledge the behavioral claim matches the official tray docs, but it cannot be proven from the repo alone. Consequence: none — the gate leaves macOS untouched and the behavior thereby irrelevant. Optionally soften the comment ("macOS opens the context menu on left-click natively") instead of stating the emission claim as fact.
- **[minor] M2 — Linux rationale worth adding** (plan §2.3 / code comment): `popUpContextMenu` is `@platform darwin,win32` (d.ts:15382) — on Linux an ungated handler would call a non-existent API. The gate is therefore necessary, not merely cautious. A half-sentence in the comment would document that.
- **[minor] M3 — Double-click opens the menu twice** (Windows): `double-click` fires in addition to two `click` events. Cosmetic; plan §5 covers the analogous case. No code needed (KISS), possibly record as known behavior in the implementation comment.
- **[minor] M4 — Test implementation detail** (`tray.test.ts`): `TrayHandle.tray` stays typed as the real `Tray`; the new tests should access listeners/counters via `FakeTray.instances` (static), not via `handle.tray` — otherwise casts are needed. Matches the plan sketch (§3, `static instances`), just a reminder for the implementation.

## Nothing forgotten?

- Pause/refresh interaction: verified — `refresh()` only calls `setContextMenu()`, the once-registered handler stays valid (acceptance criterion 4 of the plan is achievable).
- ToolTip, QA seam (`onMenuBuilt`, `--debug-tray-menu`), `--inject-xp` path: untouched, no interaction.
- "Menu open + another left-click": addressed by plan §5 (cosmetic, no code).
- Manual live verification on Windows: planned in plan §4 — sensible, since the unit tests only check the wiring (mock honesty, plan §5).

## Deliberate non-verification

The macOS behavior details (M1) are based on Electron knowledge, not on a live check of the 43.1.0 docs — explicitly flagged as required by the assignment. Impact on the verdict: none, since the win32 gate covers both sides.
