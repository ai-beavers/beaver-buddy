# Area 2 — Connect-UI Parity (Tray + Settings)

Date: 2026-07-17 · Branch: bl-item/windows-native/BL-WIN (merge d7acaf0) · read-only analysis

## 1. Verdict

**GAP(S) FOUND** — 1 [gap] (Mac-only UI text), 1 [risk] (window height → Reset section below the fold). Tray Connect, radio logic, and the secrets backend are verified at parity.

Correction of a briefing assumption: upstream **no longer has** a Connect submenu in the tray. Commit 32335bb (Connect submenu) was replaced by da3e863/9fa8bf2 — `git show upstream/main:src/main/tray.ts` shows the same flat `Connect…` item as our merge (`src/main/tray.ts:66`). So there is no conflict between an "upstream submenu" and our win32 single-click.

## 2. Findings

### B2.1 [gap] Connect hint says "on this Mac"

- **Location:** `src/main/mrr/settings.html:63`
- **Text:** "Opt in to read local Claude Code / Codex usage logs **on this Mac** — no API keys."
- Visibly wrong on Windows. A full grep for `Mac|macOS|Keychain|Windows|win32` over `settings.html` + `tray.ts`: this is the **only** visible Mac-only text (all tray.ts hits are code comments, tray.ts:99-106). No "Keychain" in visible UI texts — the handlers' error messages are already platform-neutral (`'secret write failed'`, settings-window.ts:126-128, 174-176).
- **Fix:** neutralize the wording, e.g. "on this computer" (one line, no dependency). The text comes from upstream — submitting the fix upstream as well makes sense.

### B2.2 [risk] Window height 680: Pet/Reset section + status line sit below the fold

- **Location:** `src/main/mrr/settings-window.ts:250-255` (420×680, `resizable: false`)
- **Sections (5 fieldsets + status):** Connect (`settings.html:60-82`), Stripe (`84-93`), RevenueCat (`95-106`), Growth source (`108-112`), Pet (`114-123`), `#status` (`125`).
- **Calibrated height estimate:** The BL-9 screenshot (`docs/design-reviews/BL-9-settings.png`, 840×904 @2x ⇒ viewport 420×452 at the then-current height of 480) proves the measurement model: macOS viewport = window height − 28 px title bar, and Stripe+RevenueCat+Growth+Status ≈ 450 CSS px — an exact fit. The same model with the two new sections (Connect ≈ 150–165 px, Pet ≈ 100–115 px) yields **content ≈ 700 CSS px** (up to ≈ 730 when both token rows are filled).
- **Viewport:** macOS ≈ 652 px; Windows ≈ 649 px (title bar ~31 px, `useContentSize` not set). ⇒ **Overflow ≈ 50–80 px**: vertical scrollbar; Pet/Reset (the last section) and `#status` are not fully visible on open. On Windows the scrollbar is permanently visible (no macOS overlay style) and takes an extra ~15 px of width.
- Aggravated by our branch: the Pet hint is one line longer than upstream (`settings.html:116-119`, +~15 px) with no height adjustment — upstream has historically increased the height with every section (480→560→640→680, `git log -p upstream/main -- src/main/mrr/settings-window.ts`).
- Nothing is functionally broken (mouse-wheel scrolling works in the non-resizable window), but the discoverability of the Reset danger zone suffers; on Windows it is marginally worse than on macOS.
- **Fix:** measure first, then set — launch the app with `--open-growth-settings --remote-debugging-port=<port>` (flag exists, `main.ts:335`) and read the real `document.body.scrollHeight` via CDP `Runtime.evaluate`; then raise `height` to ~750–760 (or `useContentSize: true` + a matching content height). No new dependencies. Note: `scripts/cdp-screenshot.mjs` picks the first page target (the overlay) — for the settings-window screenshot the target selection must be extended by title/URL.

## 3. Verified OK

- **Tray menu structure 1:1 with upstream:** `Connect…` as a flat menu item before `Growth` (`src/main/tray.ts:66-67`), labels/radio/checked logic identical (`git diff upstream/main HEAD -- src/main/tray.ts` shows only the win32 icon split, the win32 click handler, and the `void | Promise<void>` type widening). Tested: `tray.test.ts:142-154` (position/click), `177-204` (MRR hidden/shown, radio checked).
- **win32 single-click ↔ menu compatibility:** `popUpContextMenu()` without arguments (`tray.ts:106-108`) always opens the menu most recently set via `setContextMenu`; handlers registered once outside `rebuildMenu()` → refresh-safe, no stacking (tested: `tray.test.ts:270-295`, incl. darwin/linux gates `297-313`).
- **Radio checkmarks correct on Windows:** Electron does not toggle `checked` for radio items on Windows/Linux automatically — solved here via `rebuild()` after every click (`tray.ts:36-39, 47-50`); `growthSettings` is set synchronously before the first `await` (`main.ts:324`), i.e. `rebuild()` already reads the new mode. The MRR item is hidden-not-disabled until a source is connected (`tray.ts:42-52`, `main.ts:321`).
- **Tray icon split:** win32/linux → `tray-icon.png` without the template flag, darwin → `tray-iconTemplate.png` + `setTemplateImage(true)` (`tray.ts:84-91`; tests `tray.test.ts:221-249`).
- **Secrets backend for settings save present on Windows:** DPAPI via Electron `safeStorage`, encrypted files under `<stateDir>/secrets/<service>/<account>.enc` (`src/main/mrr/secrets.ts:25-35, 45-56, 67-76`) — Stripe/RevenueCat save/disconnect works on win32; the Keychain CLI is gated to darwin only.
- **IPC rename RESET_PET→RESET_PROGRESS consistent:** `ipc-channels.ts:21`, `settings-preload.ts:15`, `settings-window.ts:16,194-202`; drift guard in `ipc-channels.test.ts`. Two-click arming instead of `confirm()` (`settings.html:244-271`) is platform-neutral.
- **Connect flow is opt-in, no auto-connect:** `connectUsage` only sets enabled flags + returns status (`settings-window.ts:204-226`; tests `settings-window.test.ts:144-167`). Windows log paths exist (`usage/paths.ts:54-56, 141-148`) — detailed check = Area 1.
- **Window infrastructure platform-neutral:** single instance + focus (`settings-window.ts:245-248`), hardening (`applyWindowHardening`, settings-window.ts:266), CSP (`settings.html:8-11`), sandbox/preload (`settings-window.ts:258-263`), sender frame check (`settings-window.ts:45-47`).
- **No other Mac-only texts:** all buttons/status/placeholders in `settings.html` and all tray labels/tooltips are neutral. Minor point without finding status: the font stack `-apple-system, sans-serif` (`settings.html:15`) falls back to Chromium `sans-serif` (Arial) instead of Segoe UI on Windows — purely cosmetic.
- **Note (inherent to upstream, not a Windows gap):** `onOpenConnect` and `onOpenGrowthSettings` are the same function (`main.ts:329-330`) — the window does not scroll/focus to the Connect section, even though the comment in `tray.ts:19-20` suggests it does. Identical to upstream ⇒ parity given.

## 4. Proposed Flight-Plan Items

1. **Make the Connect hint platform-neutral** — `settings.html:63` "on this Mac" → "on this computer" (1 line, optionally submit upstream).
2. **Measure and adjust the settings window height for 5 sections** — measure the real `scrollHeight` via CDP/`--open-growth-settings`, `height` 680 → ~750–760 (or `useContentSize: true`), then produce a Windows screenshot proof in the BL-9 style (mind the target selection in `cdp-screenshot.mjs`).
