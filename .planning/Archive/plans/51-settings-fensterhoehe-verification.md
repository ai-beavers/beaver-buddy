# Item #51 — Plan verification: Settings window height

Date: 2026-07-17 · Reviewed: `.flightplan/Archive/plans/51-settings-fensterhoehe-plan.md` against
`src/main/mrr/settings-window.ts`, `src/main/mrr/settings.html`, `scripts/cdp-screenshot.mjs`,
`src/main/mrr/settings-window.test.ts`, `package.json`, `eslint.config.js`, `vitest.config.ts`,
`scripts/build-assets.js`, `node_modules/electron/electron.d.ts` (Electron 43.1.1),
`.flightplan/Reference/windows-native-flight-plan.md`, `.flightplan/Archive/plans/parity/bereich-2-connect-ui.md`,
`docs/design-reviews/`.

## Verdict: PLAN OK WITH CORRECTIONS

Core decision (`useContentSize: true` + measured content height + 8 px buffer), measurement
method (CDP `Runtime.evaluate`, worst-case fill), CDP script extension and test approach are
verified against the codebase and viable. No blocker. Three minor findings (workArea capping,
Windows text scaling, Flight-plan update step) to be added before implementation.

## Findings

### [minor] B1 — No capping to usable screen height (workArea)

Plan §3 sets `height ≈ 735–750` (content, via `useContentSize`). Total window height incl.
title bar ≈ 766–781 px. The plan discusses DPI scaling only as a rounding problem (<1 px, §6),
not as a **logical shrinkage of the workArea**:

- 1366×768 laptop @100 %: workArea ≈ 728 px → window sticks out ~40–50 px at the bottom.
- 1920×1080 @150 % scaling: logical height 720 px, workArea after taskbar ≈ 688 px →
  content 740 > 688; exactly the lower sections (Pet/Reset + `#status`) that the fix is
  supposed to make visible are again outside.

Functionally scrolling remains possible (no data loss), but acceptance criterion 1/2
(„visible without scrolling") is impossible on such screens. Recommendation (1–2 lines):
`height: Math.min(measured + 8, screen.getPrimaryDisplay().workAreaSize.height - 40)` —
`screen` is available in the main process, `workAreaSize` is logical (DIP), so directly
comparable. Alternatively document explicitly as accepted residual risk in the verdict.
Source: Plan §3 (lines 100-131), `settings-window.ts:250-255`.

### [minor] B2 — Windows text scaling (>100 %, accessibility) not addressed

„Make text bigger" scales the renderer fonts and increases the content height independently of
DPI; the +8-px buffer does not cover that. The plan does not mention it. Since no fixed height
can be robust against it (unless measured at runtime), note as accepted residual risk in the
verdict — more is not sensible within the scope of this item. Source: Plan §6.

### [minor] B3 — Flight-plan status update missing as a step

`windows-native-flight-plan.md:267-271` keeps Item #51 on „Status: Open"; Item #50 shows the
convention (✅ + reference to verification report + test numbers, line 265). Plan §4 only lists
code/artifacts — the Flight-plan entry (status + reference to this report or the implementation
verdict) should be added as an explicit final step.

### [nit] B4 — Pin test: `BrowserWindow: vi.fn()` alone is not enough

Plan §4.3 sketches `BrowserWindow: vi.fn()` — when called as a constructor this returns an
empty object, and `win.loadFile(...)` (`settings-window.ts:268`) would throw. Implementation
must use `BrowserWindow: vi.fn().mockImplementation(() => fakeWin)` (or `mockReturnValue`) with
the sketched fake window. The plan names the fake window with all necessary members (`loadFile`
resolving, `on`, `focus`, `isDestroyed`, `webContents`) — feasible, only the sketch is abbreviated
at this point. In addition: module state (`settingsWindow`, `handlersRegistered`,
`settings-window.ts:42-43`) is global — uncritical for exactly one new test, for several tests
`vi.resetModules()`/import isolation needed.

### [nit] B5 — Worst-case fill omits status spans

The fill covers `#claudeTokens`/`#codexTokens`/`#status` (IDs verified: `settings.html:72,80,125`),
but not `#claudeStatus`/`#codexStatus` („enabled — logs not found", `settings.html:159`). Wrap
risk low (button ≈ 160 px + span ≈ 120 px + gap < content width 388 px), but the „worst-case"
is formally not maximal. No action needed beyond a half-sentence in the verdict.

## Verified assumptions (spot-check against codebase)

1. **useContentSize semantics (Electron 43.1.1):** `electron.d.ts:4017-4021` — „The `width` and
   `height` would be used as web page's size, which means the actual window's size will include
   window frame's size and be slightly larger." Applies to win32/darwin; known inaccuracies affect
   exotic Linux WMs (not a target here) and the min/max interaction (`minWidth`/`minHeight` are
   frame-based) — both irrelevant, since neither min/max is set nor Linux supported. DPI rounding
   ±1 px covered by +8 buffer. **Plan claim §3 correct.**
2. **Window status quo:** `settings-window.ts:250-255` — `width: 420` (line 251), `height: 680`
   (line 254), `resizable: false` (255), no `useContentSize`. **Exactly as claimed**, incl. comment
   lines 252-253.
3. **Item #50 has landed:** `settings.html:63` — „usage logs on this computer". Measurement can be
   done against the final text state.
4. **Launch flag:** `main.ts:335` — `process.argv.includes('--open-growth-settings')` →
   `openGrowthSettings()` (`main.ts:272-273` → `openSettingsWindow`). Tray code path identical
   (`main.ts:329-330`). **Verified.**
5. **CDP script:** `cdp-screenshot.mjs:6` selects first `page` target (= overlay). Plain Node,
   built-in `fetch` (line 5) and `WebSocket` (line 12, global from Node 22; `engines: node 24.x`
   in `package.json:8-10`). The `--target` extension (substring match on `t.title`/`t.url`) fits the
   data structure of `/json`; `Page.enable` (line 37) already exists; `Runtime.evaluate` does not
   need `Runtime.enable`. `returnByValue: true` is correct for the metrics object. **No new
   dependencies — verified.**
6. **Measurement metric body vs. documentElement:** `settings.html:16` sets `body { margin: 16px }`;
   `document.documentElement.scrollHeight` contains the pushed-through body margins,
   `body.scrollHeight` can be up to ~32 px lower here. The plan measures both and takes `docScrollH`
   as H (§2.2.3) — **the right choice**. `innerH`/`innerW` are also reported (plan line 64) → overflow
   directly visible (`hasVScroll`/`hasHScroll`).
7. **Test realism:** `settings-window.test.ts` has no size assertions at all (grepped) and currently
   only calls Electron-free handlers. `vi.mock('electron', …)` is an established repo pattern
   (`src/main/tray.test.ts:46`, `overlay-adapter.test.ts:17`, `preload.test.ts:13`,
   `mrr/secrets.test.ts:8`). `hardening.ts:8` imports `session` from `electron` at top level — the
   planned `vi.mock('../hardening')` prevents its loading, so safe. `app.getAppPath()` is used in
   `settings-window.ts:257,268` → Mock must provide it (Plan does that). **Feasible as planned**
   (with B4 precision).
8. **Test count:** `npx vitest run` on 2026-07-17: **434 passed, 6 skipped, 43 files** — exactly the
   plan claim (§1 AC 5).
9. **dist rebuild:** `scripts/build-assets.js:8` copies `src/main/mrr/settings.html` →
   `dist/main/mrr/settings.html`; `npm run build` is therefore sufficient (Plan §2.2.1). dist state
   currently present and contains `settings.html`.
10. **eslint scope:** `eslint.config.js` has no `files` group for `scripts/*.mjs` → no rules apply to
    `cdp-screenshot.mjs` (only default parse). Plan note §5 correct („if in eslint scope" — it is
    factually not).
11. **Naming convention:** `docs/design-reviews/BL-9-settings.png` + `BL-9-verdict.md` exist →
    `BL-51-settings.png` / optional `BL-51-verdict.md` fit. Screenshot only delivers the viewport
    (`Page.captureScreenshot`) — correct for the overflow proof (Plan §6 last point).
12. **Horizontal-overflow analysis:** `settings.html:27-32` (`width:100%` + `border-box`), `.row` with
    `flex-wrap: wrap` (33-38), no fixed widths — **Plan §6 correct**, no CSS change needed.
13. **Parity source:** `.flightplan/Archive/plans/parity/bereich-2-connect-ui.md` B2.2 (lines 20-28)
    exists and contains the quoted estimate (content ≈ 700–730 px, viewport Win ≈ 649 px) and the
    same fix proposal (measure via CDP, extend target selection).
14. **Constraints:** no new dependencies (script remains builtin-only), change minimal (3 files + 1
    artifact), macOS not worse (content area 652 → ~740 px, width unchanged; by reasoning, not
    live-testable from here — correctly marked in the plan).

## Recommended plan changes before implementation

1. B1: add workArea capping (`screen.getPrimaryDisplay().workAreaSize.height`) in §3/§4.1 or
   declare as residual risk.
2. B2: add text scaling as accepted residual risk in §6.
3. B3: final step „Set Flight-plan Item #51 to ✅ + link report" in §4/§5.
4. B4/B5: refine test sketch around `mockImplementation`; half-sentence about status spans.
