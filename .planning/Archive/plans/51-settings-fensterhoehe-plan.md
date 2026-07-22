# Item #51 — Settings window height: measure, then set

Date: 2026-07-17 · Branch: bl-item/windows-native/BL-WIN · Status: Implementation round 2
(2026-07-17) — verification corrections B1–B5 from
`51-settings-fensterhoehe-verification.md` (verdict: PLAN OK WITH CORRECTIONS) incorporated.

## 1. Goal & acceptance criteria

The Growth settings window (`src/main/mrr/settings-window.ts:250-255`, currently 420×680,
`resizable: false`, no `useContentSize`) shows after the merge 5 fieldsets + status line.
The parity analysis (`.flightplan/Archive/plans/parity/bereich-2-connect-ui.md`, B2.2) estimates
content ≈ 700–730 CSS px vs. Windows viewport ≈ 649 px → Pet/Reset section and `#status`
are ~50–80 px below the fold; under Windows the scrollbar is permanently visible.

Acceptance criteria:

1. **Measured, not estimated:** The real content height is determined via CDP `Runtime.evaluate`
   (`document.body.scrollHeight` / `document.documentElement.scrollHeight`) on Windows and
   documented in the commit/verdict — incl. worst-case (both token lines
   `#claudeTokens`/`#codexTokens` filled, status spans `#claudeStatus`/`#codexStatus` filled,
   `#status` occupied).
2. When opened, **all 5 fieldsets incl. complete reset danger zone and the status line are
   visible without scrolling** — on Windows **and** macOS (same `height` applies cross-platform;
   macOS viewport will not be smaller than today).
3. Post-fix CDP measurement proves: `scrollHeight ≤ innerHeight` (no vertical overflow) and no
   horizontal overflow (`scrollWidth ≤ innerWidth`).
4. **Screenshot proof (Windows):** `docs/design-reviews/BL-51-settings.png` shows the opened
   window with all sections incl. reset button, without visible scrollbar.
5. `npm test` (434 tests + new size pin test), `npm run lint`, `npm run typecheck` green.

## 2. Measurement approach: extend cdp-screenshot.mjs

Current state (`scripts/cdp-screenshot.mjs`, 45 lines, plain Node, built-in `fetch`/`WebSocket`):
currently selects the **first** `page` target → that is the pet overlay, not the settings window.

### 2.1 Changes to `scripts/cdp-screenshot.mjs` (minimal, backwards-compatible)

- **Arg parsing:** Positional args (`port`, `outfile`, `delayMs`) as before; new optional
  flags are filtered from `process.argv` (`--target=…`, `--measure`).
  `outfile` may be `-` → no screenshot (pure measurement run).
- **`--target=<substring>`** (case-insensitive substring match on `t.title` **or** `t.url`):
  ```js
  const page = list.find((t) =>
    t.type === 'page' &&
    (!targetMatch ||
      (t.title || '').toLowerCase().includes(targetMatch) ||
      (t.url || '').toLowerCase().includes(targetMatch)));
  ```
  Without flag: exactly the previous behavior (first page target). Match for the
  settings window: `--target=settings.html` (URL is `file://…/dist/main/mrr/settings.html`;
  window title „Beaver Buddy — Settings" / HTML-`<title>` „Settings" → also
  `--target=settings` matches).
- **`--measure`:** before the screenshot a `Runtime.evaluate` with `returnByValue: true`,
  output as one `METRICS {…}` line to stdout. The expression measures the **worst case**:
  It first fills the status spans (`#claudeStatus`, `#codexStatus`), the two token lines
  (`#claudeTokens`, `#codexTokens`) and `#status` with representative text, reads the heights
  synchronously (read forces layout), and restores the DOM in the same evaluate — so the
  screenshot taken afterwards remains unchanged:
  ```js
  (() => {
    const fill = [['claudeStatus','enabled — logs not found'],
                  ['codexStatus','enabled — logs not found'],
                  ['claudeTokens','today: 12,345 · lifetime: 1,234,567'],
                  ['codexTokens','today: 12,345 · lifetime: 1,234,567'],
                  ['status','connected']];
    const saved = fill.map(([id, t]) => { const el = document.getElementById(id);
      if (!el) return null; const old = el.textContent; el.textContent = t; return [el, old]; });
    const m = {
      bodyScrollH: document.body.scrollHeight,
      docScrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight, innerW: window.innerWidth,
      docScrollW: document.documentElement.scrollWidth,
    };
    m.hasVScroll = m.docScrollH > m.innerH;
    m.hasHScroll = m.docScrollW > m.innerW;
    saved.forEach((s) => { if (s) s[0].textContent = s[1]; });
    return m;
  })()
  ```
  (Verification nit B5: `#claudeStatus`/`#codexStatus` are now included in the fill, so the
  worst case is formally maximal.)
- No new dependencies; `Page.captureScreenshot` path remains unchanged.

### 2.2 Measurement procedure (Windows, BL-9 isolation pattern)

1. `npm run build` (the app loads `dist/main/mrr/settings.html`, build is mandatory).
2. Isolated start like BL-9/BL-10 (scratch dirs, never real logs/config):
   ```bash
   scratch=$(mktemp -d)
   CLAUDE_CONFIG_DIR="$scratch/claude" CODEX_HOME="$scratch/codex" \
     npx electron . --user-data-dir="$scratch/ud" \
     --open-growth-settings --remote-debugging-port=9222 &
   ```
   (`--open-growth-settings` verifies: `src/main/main.ts:335` → `openGrowthSettings()`
   → exactly the tray code path.)
3. Measure (worst-case thanks to fill logic):
   ```bash
   node scripts/cdp-screenshot.mjs 9222 - 3000 --target=settings.html --measure
   ```
   Expected: `hasVScroll: true`, `docScrollH` ≈ 700–760 → that is **H**.
4. Set height (see §3), rebuild, relaunch, measure again → now
   `hasVScroll: false`, `hasHScroll: false`, `innerH ≥ docScrollH` must hold.
5. Proof screenshot:
   ```bash
   node scripts/cdp-screenshot.mjs 9222 docs/design-reviews/BL-51-settings.png 3000 --target=settings.html
   ```
   Then check PNG with the read tool: 5 fieldsets, reset button, status line, no scrollbar.

## 3. Decision: `useContentSize: true` + measured content height, capped to workArea

**Decision: set `useContentSize: true` and `height` to the measured content height plus a
small buffer, capped to the usable screen height.** Measured target value:
H = 705 (worst-case, §7) ⇒ **`height` = 713** (final value =
`min(Math.ceil(H) + 8, screen.getPrimaryDisplay().workAreaSize.height - 40)`,
from the measurement §2.2, step 3).

Rationale:

- The bug is exactly a frame semantics problem: content ≈ 700–730 vs. viewport =
  window height − title bar (macOS ~28 px, Windows ~31 px, calibrated per BL-9 screenshot).
  Only increasing the number (680 → 760) reproduces the same implicit coupling to
  title-bar arithmetic — the next section or a platform difference silently breaks it again.
- With `useContentSize: true`, `width`/`height` mean the **content size** (documented
  Electron behavior on win32/darwin). The measured `scrollHeight` maps 1:1 to the option value
  — measurement → setting without title-bar conversion per platform.
  For non-resizable windows this is the usual, documented use case.
- **workArea capping (verification finding B1):** With `useContentSize`, `height` refers to
  the content; the total window height is content + title bar (~31 px Win). On small/logically
  shrunk screens (1366×768 laptop: workArea ≈ 728 px; 1920×1080 @ 150 % scaling: workArea ≈
  688 px) an uncapped value of ~740 px content (total ~771 px) would stick out at the bottom
  — exactly the lower sections (Pet/Reset + `#status`) would be outside again. Therefore:
  `height = Math.min(SETTINGS_WINDOW_CONTENT_HEIGHT, screen.getPrimaryDisplay().workAreaSize.height - TITLE_BAR_ALLOWANCE)`
  with `TITLE_BAR_ALLOWANCE = 40` (conservative: title bar ~31 px + rounding/frame buffer).
  `workAreaSize` is logical (DIP), so directly comparable to the content height. `screen` is
  available in the main process. On small screens the window remains functionally scrollable
  (no data loss), but does not extend beyond the usable area.
- macOS does not get worse: content area is then exactly `height` (today 680−28 = 652 px
  viewport) → with ~740 clearly larger; `width: 420` remains content width (macOS effectively
  already had 420 px content, Windows slightly more total width — no reflow risk, s. §6).
- The +8 px buffer covers rounding at fractional DPI scaling and font metric differences
  (Windows falls back to Chromium `sans-serif`/Arial instead of `-apple-system`); the worst-case
  fill in the measurement covers the filled state (status spans + token lines + status) — so
  it also fits after connecting both sources without scrollbar.
- Alternative „fixed 750–760 without useContentSize" rejected: although a 1-number diff in the
  existing style (upstream historically bumped 480→560→640→680), it is platform-dependent
  (Win viewport = 750−31 = 719 vs. macOS = 722 — with content 730 again below the fold under
  Windows) and guessing again instead of measuring.

Width remains 420. `resizable: false` remains. The comment about `height`
(`settings-window.ts:252-253`) is updated to the measurement + useContentSize rationale +
capping logic.

## 4. Change list per file

1. **`src/main/mrr/settings-window.ts`** (~lines 250-264): `useContentSize: true` into the
   `BrowserWindow` options; `height: 680` → `Math.min(SETTINGS_WINDOW_CONTENT_HEIGHT,
   screen.getPrimaryDisplay().workAreaSize.height - TITLE_BAR_ALLOWANCE)`;
   `SETTINGS_WINDOW_CONTENT_HEIGHT` = measured worst-case + 8 = **713** (was estimated in the
   plan at ~735–750; measurement §7) as a constant with short comment (measurement + date +
   capping logic); `TITLE_BAR_ALLOWANCE = 40` (title bar ~31 px Win + buffer, because `height`
   with `useContentSize` only means the content, but `workAreaSize` is the total area); add
   `screen` to the Electron import. No other changes (hardening, preload, single-instance
   remain untouched).
2. **`scripts/cdp-screenshot.mjs`**: flag parsing (`--target=`, `--measure`, `outfile === '-'`
   = no screenshot), target selection by title/URL, `Runtime.evaluate` measurement block with
   worst-case fill (incl. `#claudeStatus`/`#codexStatus`, nit B5). Existing calls remain
   compatible.
3. **`src/main/mrr/settings-window.test.ts`**: previously **no** size assertions (grepped: no
   hits for `height`/`width`/`680`; the file only tests Electron-free handlers). New:
   regression pin on the window options:
   - `vi.mock('electron', …)` with `app.getAppPath: () => '/app'`, `ipcMain.handle: vi.fn()`,
     `screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 4000, height: 4000 } }) }`
     (large workArea → the pin asserts the uncapped constant),
     **`BrowserWindow: vi.fn().mockImplementation(() => fakeWin)`** (verification nit B4:
     `vi.fn()` alone returns an empty object as constructor, `win.loadFile(...)` would throw —
     therefore `mockImplementation` with fake window); `vi.mock('../hardening', …)` no-op.
     Safe for existing tests — they do not call any Electron APIs (comment lines 1-4 of the file).
     Module state (`settingsWindow`, `handlersRegistered`, `settings-window.ts:42-43`) is global —
     uncritical for exactly one new test (no `vi.resetModules()` needed).
   - One test: call `openSettingsWindow(deps())` with fake window (`loadFile:
     vi.fn().mockResolvedValue(undefined)`, `on`, `focus`, `isDestroyed: () => false`,
     `webContents: {}`) and `expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
     width: 420, height: 713, useContentSize: true, resizable: false }))`.
4. **`docs/design-reviews/BL-51-settings.png`** (generated artifact, naming pattern like
   `BL-9-settings.png`). Recommended, but optional: short `BL-51-verdict.md` with the measured
   numbers (before/after `METRICS` lines) — every BL-* there has one.
5. **Flight-plan (final step, verification finding B3):**
   `.flightplan/Reference/windows-native-flight-plan.md` Item `### 51`: set status to
   „Implemented (Round 2, 2026-07-17) — verification pending" + `Implementation:` line
   (changed files, measured height, final height). Only after successful screenshot.

## 5. Test plan

- **Unit:** new pin test (§4.3) + full run `npm test` (434 existing tests must stay green;
  `openSettingsWindow` is otherwise not called anywhere in tests, `main.ts` untouched).
- **Static:** `npm run lint`, `npm run typecheck` (cdp-screenshot.mjs is plain JS and
  effectively outside eslint scope — verified against `eslint.config.js`).
- **Live (Windows, manually during implementation step):**
  1. Pre-measurement documents overflow (`hasVScroll: true`) → baseline.
  2. Post-measurement: `hasVScroll: false`, `hasHScroll: false`, `innerH ≥ docScrollH`.
  3. Screenshot `BL-51-settings.png` visually checked: reset button + status visible,
     no scrollbar on the right edge.
- **macOS non-regression:** not live-testable from here — secured by reasoning
  (content area grows 652 → ~740 px, width unchanged); note in the verdict.
- **Conclusion:** Flight-plan status update (§4.5) as the last step.

## 6. Risks / open items

- **Order relative to Item #50** (changes `settings.html:63` „on this Mac" → neutral, +5
  characters in the wrapping hint ⇒ ±1 line ≈ ±15 px): **#50 has already landed** (verified:
  `settings.html:63` „usage logs on this computer") — the measurement sees the final text
  state. Original recommendation thus done.
- **Horizontal scrollbar at 420 px + 15-px scrollbar:** checked on `settings.html` — inputs
  are `width:100%` with `box-sizing: border-box` (lines 27-32), `.row` has `flex-wrap: wrap`
  (33-38), no fixed widths ⇒ no horizontal overflow possible; after the height fix there is no
  vertical scrollbar anyway. Post-fix measurement additionally asserts `hasHScroll === false`.
  No CSS change needed.
- **`useContentSize` semantics change:** only affects this one window; overlay window untouched.
  Known Electron inaccuracies mainly affect exotic Linux WMs — no issue for target platforms
  win32/darwin; note residual risk in the verdict.
- **DPI rounding:** at 125/150 % scaling the content height may round by <1 px; the +8 buffer
  absorbs it. Whoever wants can additionally measure at 150 % scaling (optional).
- **Small screens / high DPI scaling (B1):** on screens with workArea < content + 40 px (e.g.
  768 px laptops, 1080p @ 150 %) the capping from §3 applies — the window then stays within
  the workArea, the content is functionally scrollable. „Everything visible without scrolling"
  is physically impossible on such screens; accepted residual risk.
- **Windows text scaling >100 % (B2, accepted residual risk):** „Make text bigger"
  (accessibility) scales the renderer fonts and increases the content height independently of
  DPI; the +8 px buffer does not cover that, and no fixed height can be robust against it (only
  runtime measurement). Result: with active text scaling a scrollbar may appear again —
  functional without data loss. Accepted within the scope of this item.
- **Screenshot target:** `Page.captureScreenshot` only delivers the window viewport (no OS
  chrome) — exactly right for the „no overflow" proof; a window-with-title-bar proof would be
  an OS screenshot and is not part of this plan.

## 7. Implementation result (Round 2, 2026-07-17, Windows)

**Pre-measurement** (current state 420×680, no `useContentSize`), worst-case fill active:
`METRICS {"bodyScrollH":673,"docScrollH":705,"innerH":619,"innerW":407,"docScrollW":392,"hasVScroll":true,"hasHScroll":false}`
→ Overflow confirmed (content 705 > viewport 619). **H = 705** (`docScrollH`).

**Set height:** `SETTINGS_WINDOW_CONTENT_HEIGHT = 713` (= ⌈705⌉ + 8), with
`useContentSize: true` and capping `min(713, screen.getPrimaryDisplay().workAreaSize.height - 40)`
(`TITLE_BAR_ALLOWANCE = 40`, because `height` with `useContentSize` only means the content,
`workAreaSize` is the total area incl. title bar ~31 px).

**Post-measurement** (same machine, same worst-case fill):
`METRICS {"bodyScrollH":673,"docScrollH":740,"innerH":740,"innerW":426,"docScrollW":426,"hasVScroll":false,"hasHScroll":false}`
→ `hasVScroll: false`, `hasHScroll: false` — acceptance criterion 3 fulfilled. Notes on
interpretation: `docScrollH == innerH` because `documentElement.scrollHeight` is clamped to the
viewport height when content fits; the real content is unchanged 705 (`bodyScrollH` 673 +
2×16 px body margin). Observed Electron/win32 inaccuracy: viewport was 740×426 instead of
exactly 713×420 (≈ +27 px height, +6 px width — DWM/frame rounding under Windows 11) — benign
(window slightly larger rather than smaller), macOS statement unchanged (content area ≥ 713 >
652 today).

**Screenshot:** `docs/design-reviews/BL-51-settings.png` — all 5 fieldsets (Connect, Stripe,
RevenueCat, Growth source, Pet incl. reset button) plus status line area visible, no scrollbar.
Visually checked 2026-07-17.

**Tests:** 435 passed, 6 skipped (434 baseline + 1 pin test); typecheck, lint, build green.

**Residual risks (accepted):** Windows text scaling >100 % (B2) and workArea capping on very
small screens (B1, window remains scrollable there, no data loss); `useContentSize` inaccuracies
on exotic Linux WMs (not a target).
