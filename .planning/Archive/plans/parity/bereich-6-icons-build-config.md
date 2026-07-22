# Area 6 — Icons & Build Config After Merge (electron-builder.yml, tray.ts loadTrayIcon, installer-config.test.ts)

Checked: merge d7acaf0 (merge base a6108ed, parents 4667082 + a6108ed), state HEAD bl-item/windows-native/BL-WIN.

## 1. Verdict: PARITY OK

No gap found. The electron-builder.yml merge is line-correct (both sides fully preserved), all referenced asset files exist and are format-valid, loadTrayIcon was not touched by upstream, and installer-config.test.ts passes against the merged yml (5/5). The only residual risk: the BrowserWindow icons (PNG) newly set by upstream d1b4ebe are functional on Windows, but untested.

## 2. Findings

### [risk] BrowserWindow.icon uses a 1024² PNG instead of ICO on Windows
- **File:line:** `src/main/mrr/settings-window.ts:257` (`icon: path.join(app.getAppPath(), 'assets', 'beaver-buddy-icon.png')`), `src/main/main.ts:124` (`appIconPath()` → `assets/beaver-buddy-icon.png`), call site `src/main/main.ts:204`
- **Description:** Upstream d1b4ebe sets the window icon as a PNG path. The pet overlay window is irrelevant on Windows (`skipTaskbar: true`, `main.ts:138`); but the settings window appears in the taskbar. Electron accepts PNG on Windows (scaled internally), but recommends ICO for sharp taskbar icons. No test verifies the icon under win32; a 530 KB PNG for a taskbar icon is also oversized. Purely cosmetic, no functional loss.
- **Fix proposal (no new dependencies):** platform-gate in `settings-window.ts`: `process.platform === 'win32' ? assets/icon.ico : assets/beaver-buddy-icon.png`. `assets/icon.ico` already exists and contains 16–256 px levels. Optional mini-test analogous to the `loadTrayIcon` tests (withPlatform pattern in `tray.test.ts:221-249`).

## 3. Verified-OK List

- **electron-builder.yml merge resolution:** conflict resolution in d7acaf0 correct — `git diff upstream/main HEAD` shows exclusively our appended win/nsis block, no upstream loss. `mac.icon: assets/beaver-buddy-icon.icns` (yml:14) and the complete win/nsis block (yml:15-34) coexist.
- **All asset references exist & are format-valid:**
  - `assets/beaver-buddy-icon.icns` (yml:14) — valid icns, 273 KB
  - `assets/icon.ico` (yml:19, 27, 28) — valid ICO, 7 levels 16/24/32/48/64/128/**256** px → satisfies the electron-builder 256 px requirement
  - `assets/tray-icon.png` (tray.ts:85, win/linux path) — valid PNG, 32×32 RGBA, 2312 B (generated from a real beaver sprite, commit 94ace5c)
  - `assets/tray-iconTemplate.png` (tray.ts:85, darwin path) — valid PNG, 16×16 gray+alpha (template convention, macOS only)
  - `assets/beaver-buddy-icon.png` (main.ts:124, settings-window.ts:257) — exists, 1024², 530 KB
  - Packaging covered: `files: assets/**/*` (yml:7) packs all icons.
- **win/nsis block fully preserved (yml:15-34):** target nsis+portable, signtoolOptions sha256 + rfc3161TimeStampServer, installerIcon/uninstallerIcon, createDesktopShortcut/createStartMenuShortcut, shortcutName, installerLanguages [en_US, de_DE].
- **loadTrayIcon unchanged by upstream:** `git diff a6108ed upstream/main -- src/main/tray.ts` is empty — upstream has not touched tray.ts since the merge base. Our platform branching (tray.ts:84-91: darwin→template+setTemplateImage, otherwise tray-icon.png) and the win32 single-click handler (tray.ts:106-108) are intact. The upstream legacy code would have unconditionally used the 16×16 template icon on all platforms — our branch is strictly better for Windows.
- **installer-config.test.ts passes against the merged yml:** 5/5 green (run live). The regex tolerates CRLF (`\r?\n` — the yml is CRLF) and block lists; the nsis: extraction (installer-config.test.ts:13) matches yml:26-34 cleanly; en_US before de_DE confirmed.
- **Related tests green (live):** tray.test.ts 20/20 (incl. loadTrayIcon win32/darwin/linux, tray.test.ts:221-249), app-icon.test.ts 6/6.
- **app-icon.ts Windows-safe:** `setUnpackagedDockIcon` is darwin-gated and a no-op on Windows (`src/main/app-icon.ts:128`); squircle/dock logic never runs on win32.

## 4. Proposed Flight-Plan Items

1. **Switch the Windows window icon to ICO** — use `assets/icon.ico` instead of the 1024² PNG in settings-window.ts (and possibly appIconPath) on win32; platform gate + mini-test following the loadTrayIcon pattern.
