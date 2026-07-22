# Beaver Buddy — Cross-Platform / Windows Implementation Plan

**Status:** Phases 1, 2, 3, and 4 completed. Phase 5 partially completed — BL-WIN-7 and Codex tracking are implemented; BL-WIN-6 (Windows secret store / MRR mode) remains deferred pending the admin decision.  
**Goal:** Build Beaver Buddy as a cross-platform Electron app for macOS and Windows;
the current focus is the **Windows implementation**.  
**Scope decision:** See ADR 002 (`docs/adr/002-cross-platform-scope.md`).  
**Starting point:** Electron app with macOS-specific assumptions (Node 24.x,
Electron 43.1.0, TypeScript strict).

---

## Overall Status

| Phase | Status | Build Items |
|-------|--------|-------------|
| **Phase 1: Foundation** | ✅ Completed | BL-WIN-1, BL-WIN-2, BL-WIN-9 |
| **Phase 2: Core Windows Experience** | ✅ Completed | BL-WIN-3, BL-WIN-4 |
| **Phase 3: Windows Integrations** | ✅ Completed | BL-WIN-5 |
| **Phase 4: Polish & Release Readiness** | ✅ Completed | BL-WIN-8, BL-WIN-10 |
| **Phase 5: Deferred / Follow-up** | ✅ Partially completed | BL-WIN-7 ✅, Codex tracking ✅, BL-WIN-6 ⏸️ deferred |
| **Post-Phase-5 Bugfix: Single-Instance Protection** | ✅ Completed | Duplicate app instances are prevented (`app.requestSingleInstanceLock`). |

---

## 1. Summary / Executive Summary

The codebase is mostly platform-neutral. The hard blockers for the
Windows implementation sit in four areas:

1. **Build & Packaging:** `npm run build` uses Unix shell commands;
   `electron-builder.yml` has no `win:` target.
2. **Overlay window:** `setAlwaysOnTop(true, 'floating')` places the window
   on Windows **below the taskbar**; the beaver would disappear at the
   bottom edge.
3. **Tray:** `setTemplateImage(true)` and the template PNG are macOS-only.
4. **Secrets:** the `security` CLI for the macOS Keychain has no Windows equivalent.
5. **Usage logs:** the legacy path `~/.claude` already works on Windows
   (`%USERPROFILE%\.claude`). The XDG path `~/.config/claude` is not
   documented on Windows and must be reviewed/replaced.
6. **HiDPI/scaling:** the canvas renderer works in logical pixels; on
   Windows with 125%/150%/200% scaling, the canvas must be scaled physically
   by the DPR so the pixel art stays sharp.

Renderer, sprite animation, and state logic are largely portable. The
biggest uncertainties are the Windows z-order of the overlay and the choice
of a robust Windows secret store.

---

## 2. Platform-Specific Spots Found

| # | File:Line | Problem | Severity |
|---|-----------|---------|----------|
| 1 | `package.json:12` | Build script uses `cp`, `rm -rf`, `mkdir -p` (Unix-only). | Blocker |
| 2 | `electron-builder.yml:9-12` | Only `mac:` target configured, no `win:`. | Blocker |
| 3 | `src/main/main.ts:118` | `setAlwaysOnTop(true, 'floating')` — below the taskbar on Windows. | Blocker |
| 4 | `src/main/tray.ts:82-84` | `setTemplateImage(true)` and `tray-iconTemplate.png` are macOS-only. | Blocker |
| 5 | `src/main/mrr/keychain.ts:54-85` | Uses the macOS `security` CLI to read/write/delete secrets. | Blocker |
| 6 | `src/main/usage/paths.ts:40` | XDG path `~/.config/claude` is not documented on Windows. | Medium |
| 7 | `src/main/atomic-file.ts:18` | `fs.renameSync` can fail on Windows with transient locks (`EPERM`). | Medium |
| 8 | `.github/workflows/ci.yml:17` | CI runs only on `ubuntu-latest`. | Medium |
| 9 | `src/renderer/renderer.ts:81-82` | Canvas works in logical pixels; possibly blurry on Windows HiDPI. | Low-Medium |
| 10 | `assets/tray-iconTemplate.png` | No Windows icon asset (`.ico`/colored PNG). | Medium |

---

## 3. Architecture Decisions

### 3.1 Platform Adapters Instead of `if (platform)` Spaghetti

Small adapter modules are introduced for Keychain, usage paths, and
possibly overlay/tray:

```text
src/main/mrr/keychain.ts          → interface + factory
src/main/mrr/keychain-darwin.ts   → existing security-CLI logic
src/main/mrr/keychain-win32.ts    → Windows secure storage
src/main/usage/paths.ts           → keep/extend platform-dependent defaults
```

Advantage: testability, clear separation, future extensibility.

### 3.2 Secret Storage on Windows

Options:

| Option | Implementation | Pros / Cons |
|--------|----------------|-------------|
| A. Windows Credential Manager | PowerShell `CredentialManager` module or `cmdkey.exe` + possibly a small native addon | Native store, CLI dependency, more complex tests, restricted reading of secrets. |
| B. `electron.safeStorage` + encrypted JSON in `userData` | DPAPI-encrypted, no external CLI | Simple, no new dependency, historically violates CLAUDE.md ("secrets never in app-support dir") — requires ADR/scope update. |
| C. `keytar`-like dependency | Would require native bindings; CLAUDE.md makes new dependencies difficult. | Avoid. |

**Recommendation:** evaluate Option A (Windows Credential Manager) as the
primary path; Option B (`safeStorage`) as a documented fallback if Option A
proves too unstable or too costly.

### 3.3 Overlay Behavior on Windows

**Decision:** The beaver must never disappear behind the Windows taskbar.
It must always remain cleanly visible and walk along the bottom screen edge
without being covered — even with an auto-hide taskbar and with taskbars
at any position (bottom, top, left, right).

Implementation:

- On macOS: keep `setAlwaysOnTop(true, 'floating')`.
- On Windows: use `setAlwaysOnTop(true, 'normal')` or `'pop-up-menu'` to
  keep the overlay above normal windows without reaching the screensaver
  level.
- The roaming bounds and hatch position are based not on the screen
  resolution but on the actually available work area **minus the taskbar**.
- Taskbar detection:
  - Primary: compare `screen.getPrimaryDisplay().workArea` vs. `bounds`.
  - Secondary (if `workArea` is inaccurate with auto-hide): use the Windows
    AppBar/taskbar API to determine the reserved taskbar region.
- When taskbar visibility/position changes, the workArea is recalculated
  and the beaver is gently guided back into the available area (no jump,
  but a new roaming target above the taskbar).
- Keep `skipTaskbar: true`, `focusable: false`, `transparent: true`.
- Acceptance test: click-through, no focus stealing, no taskbar entry,
  beaver always stays above/visible next to the taskbar, survives
  full-screen applications.

### 3.4 Build Script

A new Node script `scripts/build-assets.js` replaces the Unix chain:

```js
fs.rmSync('dist/renderer/assets/sprites', { recursive: true, force: true });
fs.mkdirSync('dist/renderer/assets', { recursive: true });
fs.cpSync('assets/sprites', 'dist/renderer/assets/sprites', { recursive: true });
fs.cpSync('src/renderer/index.html', 'dist/renderer/index.html');
fs.cpSync('src/main/mrr/settings.html', 'dist/main/mrr/settings.html');
```

The `package.json` build script shortens to:

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js"
```

### 3.5 Packaging & Icons

Extend `electron-builder.yml`:

```yaml
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
  publisherName: AI Beavers
```

**Icons (provisional):**

- There is no final master icon yet.
- For now, `assets/icon.ico` and a colored `assets/tray-icon.png` are
  generated from the existing sprite assets (e.g.
  `assets/sprites/beaver-baby.png` or `assets/sprites/lodge.png`).
- Tray icon = same beaver icon in color (decision point 5).
- Later, a design gate must deliver a real, high-resolution master icon and
  replace the generated icons.

**Code signing:**

- Out of scope for now (decision point 6).
- The NSIS/portable installer is produced unsigned; the Windows Defender
  SmartScreen warning is accepted.
- Real code signing can be submitted later as its own build item.

### 3.6 Usage Log Paths

- The legacy path `~/.claude` remains and works on Windows automatically
  (`%USERPROFILE%\.claude`).
- The XDG path `~/.config/claude` is not checked on Windows, since it is
  not documented.
- `CLAUDE_CONFIG_DIR` remains the highest-priority override.
- **Codex tracking on Windows is deferred for now** (see "Deferred Tasks").

### 3.7 HiDPI/Scaling on Windows

**Decision:** The renderer scales the canvas physically by the
`devicePixelRatio` (DPR), while all game-world coordinates (roaming, hatch,
bubble, dirty rects) stay in logical pixels.

Implementation:

- `canvas.width`/`canvas.height` = `logicalBounds * DPR` (rounded).
- `canvas.style.width`/`canvas.style.height` = logical bounds.
- `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` instead of cumulative `scale()`.
- `ctx.imageSmoothingEnabled = false` stays active.
- `bounds()` returns logical bounds; no code interprets
  `canvas.width/height` as a logical size.
- `ctx.clearRect(0, 0, bounds().width, bounds().height)` clears the entire
  physical canvas through the transformed logical size.
- DPR changes are detected in addition to `onBoundsChanged` via a
  `window.resize` listener that compares `window.devicePixelRatio` with the
  last known value.

---

## 4. Build Items (Order)

### BL-WIN-1: Platform-Independent Build Scripts ✅
- **Scope:** `package.json`, new `scripts/build-assets.js`.
- **Acceptance:** `npm run build` runs identically on Windows cmd/PowerShell, macOS, and Linux.
- **Dependencies:** None.
- **Status:** Completed. `package.json:build` now calls `node scripts/build-assets.js`; all assets are copied platform-independently via `node:fs`/`node:path`.

### BL-WIN-2: electron-builder Windows Configuration ✅
- **Scope:** `electron-builder.yml`, Windows icon assets.
- **Acceptance:** `electron-builder --win` produces `.exe`/`.nsis` installers; app shows icon in the installer/Explorer.
- **Dependencies:** BL-WIN-1.
- **Status:** Completed. Added `win:` target with `nsis` + `portable`, `assets/icon.ico`, and `assets/tray-icon.png`. Set `author` in `package.json` to "AI Beavers" (publisher for the Windows installer).

### BL-WIN-3: Overlay Windows Adapter ✅
- **Scope:** `src/main/overlay-adapter.ts`, `src/main/main.ts`, `src/main/ipc-channels.ts`,
  `src/main/preload.ts`, `src/renderer/renderer.ts`, `src/renderer/roam.ts`.
- **Acceptance:**
  - Platform-dependent `setAlwaysOnTop` call.
  - The taskbar is detected and the available work area is adjusted to the
    taskbar region.
  - The beaver stays visible at the bottom edge when the taskbar is visible and
    is not covered by the taskbar.
  - Smoke test confirms click-through and no focus stealing.
- **Dependencies:** None.
- **Status:** Completed. `configureAlwaysOnTop` selects `floating` on macOS and
  `normal` on Windows/Linux. `fitWindowToWorkArea` aligns the window with the
  work area of the primary display; changes are deduplicated and sent to the
  renderer via `state:bounds`.

### BL-WIN-4: Tray Windows Adapter ✅
- **Scope:** `src/main/tray.ts`, Windows tray asset.
- **Acceptance:** On Windows a colored `.ico`/PNG is loaded; on macOS the template-image behavior is preserved; tray menu works.
- **Dependencies:** BL-WIN-2 (for the asset).
- **Status:** Completed. `loadTrayIcon` loads `assets/tray-icon.png` on Windows/Linux
  and calls `setTemplateImage` only on macOS.

### BL-WIN-5: Claude Usage Log Path Windows Adapter ✅
- **Scope:** `src/main/usage/paths.ts`, `paths.test.ts`.
- **Acceptance:** `discoverPaths()` works on Windows for Claude Code
  (`%USERPROFILE%\.claude`, possibly `CLAUDE_CONFIG_DIR`); the XDG path is
  ignored on Windows; Codex paths remain unchanged (deferred for now, see
  "Deferred Tasks").
- **Dependencies:** None.
- **Status:** Completed. `discoverPaths` gains an optional `platform` parameter;
  on `win32` only `~/.claude` is checked; on `darwin`/`linux` XDG + legacy are preserved.
  `CLAUDE_CONFIG_DIR` remains the highest-priority override and additionally
  accepts semicolons as separators alongside commas.

### BL-WIN-6: Keychain Windows Adapter ⏸️ DEFERRED
- **Status:** Deferred / open — admin decision pending.
- **Rationale:** Must be discussed and planned in detail with the project
  administrator (Credential Manager vs. `safeStorage` vs. another solution).
- **Scope:** `src/main/mrr/keychain.ts` → adapter, `keychain-darwin.ts`,
  `keychain-win32.ts`, tests.
- **Acceptance:** Interface-based implementation; the Windows variant
  stores/reads/deletes secrets robustly; the `--keychain-service` QA flag is
  preserved.
- **Dependencies:** Decision by the project administrator.
- **Impact:** MRR mode (Stripe/RevenueCat) is not available on Windows for now.
  The app is fully functional without credentials (overlay, tray, animations,
  token tracking).

### BL-WIN-7: Atomic Writes on Windows ✅
- **Status:** Completed.
- **Rationale:** `fs.renameSync` can fail on Windows with transient locks
  (`EPERM`). An asynchronous retry logic with a short backoff offers a
  pragmatic, dependency-free solution.
- **Scope:** `src/main/atomic-file.ts` and all synchronous callers (`saveOnboardingState`,
  `saveState`, `saveSettingsState`, `XpEngine`).
- **Acceptance:** State files are persisted robustly on Windows; the solution is
  documented and tested.
- **Result:** `atomicWriteFile` is now `async`, uses `fs.promises.writeFile` +
  `fs.promises.rename`, retries the rename up to 4 times with delays of
  `[0, 10, 50, 100]` ms on `EPERM`/`EBUSY`, and cleans up the temp file in
  `finally`. All callers and tests were converted to `async`;
  `src/main/atomic-file.test.ts` was newly created.

### BL-WIN-8: Renderer HiDPI / Scaling ✅
- **Scope:** `src/renderer/renderer.ts`, `src/renderer/canvas-dpr.ts`,
  `src/renderer/canvas-dpr.test.ts`, `src/renderer/renderer.test.ts`.
- **Acceptance:** The overlay stays sharp at 125%/150%/200% Windows scaling;
  pixel art remains nearest-neighbor; logical bounds for roaming/hatch/bubble
  are preserved; DPR changes without a window resize are detected.
- **Dependencies:** BL-WIN-3.
- **Status:** Completed. `applyDpr` encapsulates the DPR math in a testable
  helper file; `bounds()` returns logical pixels; `clearRect` uses logical
  bounds; a `window.resize` listener captures pure DPR changes. 200% scaling
  is integer-sharp; 125%/150% show no bilinear blur but may exhibit a
  slightly uneven pixel grid.

### BL-WIN-9: CI Windows Runner ✅
- **Scope:** `.github/workflows/ci.yml`.
- **Acceptance:** CI matrix includes `windows-latest`; `typecheck`, `lint`, `test`, `npm run build`, and `electron-builder --win --publish never` are green.
- **Dependencies:** BL-WIN-1, BL-WIN-2.
- **Status:** Completed. The matrix runs on `ubuntu-latest` and `windows-latest` with `fail-fast: false`; Windows artifacts are uploaded as GitHub Actions artifacts.

### BL-WIN-10: Documentation & Design Gate ✅
- **Scope:** `README.md`, `PRD.md`, `CLAUDE.md`,
  `docs/design-reviews/phase-4-windows/verdict.md`.
- **Acceptance:** README/PRD/CLAUDE reflect macOS + Windows; design gate for
  Windows icons and HiDPI completed; screenshots/verdict available.
- **Dependencies:** BL-WIN-2, BL-WIN-4, BL-WIN-8.
- **Status:** Completed. Documentation supplemented with HiDPI notes,
  troubleshooting, and design-gate criteria. The verdict rates the provisional
  sprite-generated icons as "CONDITIONAL PASS"; a professional master icon
  remains open as a known follow-up.

---

## 5. Risks & Open Questions

| Risk | Impact | Mitigation |
|------|--------|------------|
| Overlay z-order on Windows | Beaver behind the taskbar or above full-screen apps. | Smoke tests with different levels (`pop-up-menu`, `screen-saver`). |
| Windows secret store not yet decided. | MRR mode not usable on Windows for now. | Align with the project administrator; keep MRR mode disabled on Windows until then. |
| Codex usage tracking on Windows deferred. | Token-burn tracker on Windows only covers Claude Code for now. | Research/test installation; later build item. |
| HiDPI scaling at 125%/150% shows an uneven pixel grid. | Visual quality suffers slightly at non-integer DPR. | Accepted: no bilinear blur, 200% is integer-sharp. |
| New dependencies violate CLAUDE.md. | Review blocker. | No new dependencies for build/keychain; only if absolutely necessary, with license + rationale. |
| Atomic writes on Windows not yet finally solved. | State files may temporarily fail to be written. | Research a Windows-native solution (BL-WIN-7). |
| Node version mismatch (project wants 24.x, local environment has 22.x). | Build warnings, potential incompatibilities. | Provide Node 24.x for Windows CI; adjust the development environment. |

---

## 6. Recommended Approach

1. **Immediately:** Research the Windows log paths for Codex (blocks BL-WIN-5).
2. **First implementation:** BL-WIN-1 + BL-WIN-2 + BL-WIN-9 (build, packaging, CI),
   so that Windows development and packaging are possible at all.
3. **Then:** BL-WIN-3 + BL-WIN-4 (overlay/tray), then BL-WIN-5 (paths).
4. **Polish:** BL-WIN-8 + BL-WIN-10.
5. **Later (after research):** BL-WIN-7 (atomic writes).
6. **Later (after administrator alignment):** BL-WIN-6 (keychain/secrets) and
   MRR mode activation on Windows.

---

## 7. Milestones & Phases

| Phase | Milestone | Build Items | Goal |
|-------|-----------|-------------|------|
| **Phase 1** | **Foundation** | BL-WIN-1, BL-WIN-2, BL-WIN-9 | The app can be built, packaged, and tested in CI on Windows. |
| **Phase 2** | **Core Windows Experience** | BL-WIN-3, BL-WIN-4 | Overlay and tray work natively on Windows; the beaver always stays visible, even with a taskbar. |
| **Phase 3** | **Windows Integrations** | BL-WIN-5 | Claude Code usage tracking works on Windows. |
| **Phase 4** | **Polish & Release Readiness** | BL-WIN-8, BL-WIN-10 | HiDPI/scaling, icons, docs, design gate. |
| **Phase 5** | **Deferred / Follow-up** | BL-WIN-6, BL-WIN-7, Codex tracking | Secrets/MRR, atomic writes, Codex tracking — after alignment/research. |

### Phase 1: Foundation (BL-WIN-1, BL-WIN-2, BL-WIN-9) ✅

**Goal:** Windows build and packaging are stable.

**Status:** Completed on 2026-07-15.

1. **BL-WIN-1** — platform-independent build scripts (`scripts/build-assets.js`).
2. **BL-WIN-2** — `electron-builder.yml` Windows target + icons.
3. **BL-WIN-9** — extend the CI matrix with `windows-latest`, incl. `npm run build`
   and `electron-builder --win --publish never`.

**Acceptance:** `npm run build` and packaging run locally and in CI on
Windows.

**Results:**
- `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` run
  successfully locally on Windows (Node 22.x) and in CI (Node 24.x).
- `npx electron-builder --win --publish never` produces `release/Beaver Buddy Setup 0.1.0.exe`
  (NSIS installer) and `release/Beaver Buddy 0.1.0.exe` (portable version).
- After cleaning up unwanted ZIP artifacts from `assets/sprites/`, the
  installer size is approx. 95 MB per `.exe`.
- All 32 test files pass on Windows (292 passed, 6 skipped).

**Remaining notes:**
- The visual smoke test of the icon in the installer/Explorer/Task Manager is a
  manual step that should still be done.
- The macOS build (`electron-builder --mac`) could not be verified locally
  because the environment is Windows; a check on macOS hardware or in a
  macOS CI remains recommended.
- The local development environment runs Node 22.x, while the project
  targets Node 24.x; `npm ci` warns but does not abort. Raising the local
  Node version should happen outside this phase.
- Doc updates to `CLAUDE.md`, `PRD.md`, `README.md`, `.gitignore`, and
  `docs/adr/002-cross-platform-scope.md` come from the previous planning
  phase and are not part of the strict BL-WIN-1/2/9 build items.

### Phase 2: Core Windows Experience (BL-WIN-3, BL-WIN-4) ✅

**Goal:** The app starts on Windows and feels native.

1. **BL-WIN-3** — overlay adapter with taskbar detection.
2. **BL-WIN-4** — tray adapter with Windows colored icon.

**Acceptance:** The beaver is visible, stays visible when the taskbar is visible,
the tray menu works, no focus stealing.

**Status:** Completed on 2026-07-15.

**Results:**
- `src/main/overlay-adapter.ts` was newly introduced: `detectTaskbarEdge`,
  `getPrimaryWorkAreaInfo`, `configureAlwaysOnTop`, `fitWindowToWorkArea`,
  `onWorkAreaChanged`.
- `src/main/main.ts` uses the adapter, deduplicates workArea changes, and
  sends bounds to the renderer via `state:bounds`.
- `src/main/ipc-channels.ts` and `src/main/preload.ts` provide the new
  `onBoundsChanged` channel.
- `src/renderer/renderer.ts` and `src/renderer/roam.ts` use the explicit
  IPC bounds and clamp the roaming state into the new work area on size
  changes.
- `src/main/tray.ts` loads `assets/tray-icon.png` on Windows and continues to
  load `assets/tray-iconTemplate.png` with `setTemplateImage(true)` on macOS.
- New tests: `src/main/overlay-adapter.test.ts` (14 tests),
  `src/main/preload.test.ts` (3 tests), `src/main/tray.test.ts` (+3 tests).
- `npm run typecheck`, `npm run lint`, `npm test` (312 passed, 6 skipped),
  `npm run build`, and `npx electron-builder --win --publish never` are green.

**Remaining warnings:**
- **Auto-hide limitation:** `detectTaskbarEdge` compares `display.bounds` with
  `display.workArea`. With an auto-hide taskbar, both are often identical on
  Windows, so the taskbar edge is not detected. The overlay is then aligned to
  the full screen size; the beaver can be briefly covered by the taskbar when
  it slides in. A robust solution would require the native Windows AppBar API,
  which would mean new dependencies.
- **Z-order hardware test pending:** `setAlwaysOnTop(true, 'normal')` is the
  conservative starting choice for Windows. Whether it stays above the visible
  taskbar can only be verified on real Windows hardware. The documented
  fallback is `setAlwaysOnTop(true, 'pop-up-menu')`.
- **Tray icon contrast:** The colored `assets/tray-icon.png` was not visually
  checked against dark Windows taskbar backgrounds. Phase 4 (BL-WIN-10/HiDPI)
  should include a design gate.

### Phase 3: Windows Integrations (BL-WIN-5)

**Goal:** Token-burn tracking works on Windows.

1. **BL-WIN-5** — make Claude usage log paths Windows-compatible.

**Acceptance:** The app finds `%USERPROFILE%\.claude` and evaluates logs correctly.

**Status:** Completed on 2026-07-15.

**Results:**
- `src/main/usage/paths.ts` was adjusted: `discoverPaths` and `claudeConfigDirs`
  gain an optional `platform` parameter (default `process.platform`).
- On `win32`, only the legacy path `~/.claude` is checked, which resolves to
  `%USERPROFILE%\.claude` on Windows.
- On `darwin`/`linux`, the existing behavior with XDG (`~/.config/claude`)
  plus the legacy path is preserved.
- `CLAUDE_CONFIG_DIR` remains the highest-priority override on all platforms
  and now additionally accepts semicolons as separators alongside commas.
- `src/main/usage/paths.test.ts` was extended with platform-specific tests for
  Windows and non-Windows; all `discoverPaths` calls are explicitly parameterized.
- `npm run typecheck`, `npm run lint`, `npm test` (323 passed, 6 skipped), and
  `npm run build` are green locally on Windows; `npx electron-builder --win --publish never`
  successfully produces the installer and portable `.exe`.

**Remaining notes:**
- **Codex tracking on Windows** remains deferred; Codex log paths were not
  enabled on Windows in this phase (see "Deferred Tasks").
- On unlisted platforms (e.g. `freebsd`, `openbsd`), `discoverPaths` without
  an explicit `platform` parameter falls back to XDG + legacy, matching the
  behavior before BL-WIN-5. For type-safe calls, only `win32`, `darwin`, or
  `linux` should be passed.
- The semicolon separation for `CLAUDE_CONFIG_DIR` was not part of the
  original plan but makes sense for Windows paths and has been documented.

### Phase 4: Polish & Release Readiness (BL-WIN-8, BL-WIN-10) ✅

**Goal:** Visual quality and documentation are fit for Windows.

1. **BL-WIN-8** — HiDPI/scaling for Windows displays.
2. **BL-WIN-10** — design gate, screenshots, final doc updates.

**Acceptance:** Icons and overlay look sharp on Windows; README/PRD/CLAUDE
are consistent.

**Status:** Completed on 2026-07-15.

**Results:**
- `src/renderer/canvas-dpr.ts` newly introduced: pure, unit-testable helper
  functions `computeCanvasSize` and `applyDpr`.
- `src/renderer/renderer.ts` adjusted: logical bounds (`logicalBounds`) are
  separated from the physical canvas; `bounds()` returns logical pixels;
  `ctx.clearRect` uses logical bounds; a `window.resize` listener detects
  pure DPR changes.
- `src/renderer/canvas-dpr.test.ts` (3 tests) and `src/renderer/renderer.test.ts`
  (3 tests) added; they cover DPR math, the `bounds()` regression, and the
  correct clear area.
- `README.md`, `PRD.md`, and `CLAUDE.md` updated with Windows HiDPI notes,
  troubleshooting, design-gate criteria, and definition-of-done additions.
- `docs/design-reviews/phase-4-windows/verdict.md` created with an assessment
  of the provisional icons and the HiDPI status.
- `npm run typecheck`, `npm run lint`, `npm test` (329 passed, 6 skipped),
  `npm run build`, and `npx electron-builder --win --publish never` are green.

**Remaining notes:**
- **Visual design gate on real hardware pending:** The verdict is based on
  code review and architecture; real screenshots on Windows at 100%, 125%,
  150%, and 200% scaling should be taken once a Windows test machine is
  available.
- **125%/150% pixel grid:** At non-integer DPR, the pixel grid may look
  slightly uneven. This is a fundamental limit of nearest-neighbor at
  1.25×/1.5×, not an implementation bug.
- **Final master icon:** The provisional `assets/icon.ico` and
  `assets/tray-icon.png` were only assessed against sprite assets. A
  professional master icon is anchored as a known follow-up in Phase 5.

### Phase 5: Deferred / Follow-up

**Goal:** Catch up on open points as soon as clarification is available.

**Status:** Partially completed.

- **BL-WIN-7 — Windows-native atomic writes:** ✅ Completed. `atomicWriteFile`
  was rebuilt asynchronously with retry backoff; state persistence on Windows
  is more robust against transient locks. All tests and build pipelines are green.
- **Codex tracking — Windows log paths:** ✅ Completed. On Windows, `discoverPaths`
  checks in order `CODEX_HOME` (override), `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`,
  and `~/.codex` (legacy). The first existing path is used. Unknown platforms
  defensively fall back to `linux` behavior. Windows tests were added in
  `src/main/usage/paths.test.ts`.
- **BL-WIN-6 — secret store / MRR mode:** ⏸️ Deferred. The choice of the
  Windows secret-store backend requires a decision by the project administrator.
  Under the current `CLAUDE.md` restrictions, `electron.safeStorage` + encrypted
  JSON in `userData` is the realistic default solution; Windows Credential Manager
  with a native addon only with an explicit admin decision. MRR mode remains
  disabled on Windows for now.
- **Final master icon / design pass** — deferred visual follow-up; replaces the
  provisional sprite-generated `assets/icon.ico` and `assets/tray-icon.png`.

**Remaining blockers:**
- Admin decision for BL-WIN-6 (secret-store backend).
- Empirical verification of the Codex Windows paths on real Windows hardware
  would be desirable, since the current solution is based on candidate paths.
- Final master icon / design pass.

---

## 8. Deferred Tasks

### BL-WIN-6: Windows Secret Store / MRR Mode
- **Status:** ⏸️ Deferred, open — admin decision pending.
- **Rationale:** The decision on the secret-store backend (Windows Credential
  Manager, `electron.safeStorage`, possibly Win32 API) must be discussed with
  the project administrator.
- **Impact:** MRR mode (Stripe/RevenueCat) is not available on Windows for now.
  The app is fully functional without credentials (overlay, tray, animations,
  token tracking).
- **Recommendation:** Under the current `CLAUDE.md` restrictions,
  `electron.safeStorage` + encrypted JSON in `userData` is the realistic
  default solution; Windows Credential Manager with a native addon only with
  an explicit admin decision.
- **Next step:** Meeting with the project administrator; then detailed planning
  and implementation of BL-WIN-6.

### Codex Usage Log Tracking on Windows
- **Status:** ✅ Completed.
- **Rationale:** The official Windows log path of the Codex CLI is not clearly
  documented; therefore, several candidate paths are checked.
- **Implementation:** On Windows, `discoverPaths` checks in this priority:
  `CODEX_HOME` (override) > `%LOCALAPPDATA%\Codex` > `%APPDATA%\Codex` >
  `~/.codex` (legacy). The first existing path is used.
- **Impact:** Token-burn tracking on Windows now also covers Codex, provided
  one of the candidate paths exists.
- **Note:** The solution is based on candidate paths, not on empirically
  verified official Codex paths. A test installation on Windows would be
  desirable to adjust the order if necessary.

### Atomic Writes on Windows (BL-WIN-7)
- **Status:** ✅ Completed.
- **Rationale:** `fs.renameSync` can fail on Windows with transient locks
  (`EPERM`).
- **Implementation:** `atomicWriteFile` was rebuilt asynchronously with retry
  backoff: up to 4 attempts with delays of `[0, 10, 50, 100]` ms on
  `EPERM`/`EBUSY`, temp file in the target directory (same-volume rename),
  cleanup in `finally`.
- **Impact:** State persistence on Windows is more robust against transient
  locks. All tests and build pipelines are green.
- **Note:** Very slow or long-lasting locks can still overwhelm the heuristic.

### Final Master Icon / Design Pass
- **Status:** Deferred, open.
- **Rationale:** There is no professional master icon yet; `assets/icon.ico`
  and `assets/tray-icon.png` are provisionally generated from sprite assets.
  A design pass must be carried out and approved.
- **Impact:** The app icon in Explorer/installer/Task Manager and the tray icon
  on dark taskbar backgrounds do not yet reach the final quality level.
- **Next step:** Design review or commissioning a designer; then creation of
  new assets and replacement of the provisional files.

---

## 9. Post-Phase-5 Bugfix: Single-Instance Protection ✅

**Trigger:** During manual Windows testing, two beaver instances were displayed at the same time.

**Solution:** In `src/main/main.ts`, an Electron single-instance lock is requested directly at startup. A second launch exits immediately with exit code `0` and does not open another window; the running instance is brought to the foreground.

**Acceptance:**
- `npm start` (first launch) shows the beaver.
- `npm start` (second launch) exits immediately without a second overlay/tray icon.
- `npm run typecheck`, `npm run lint`, `npm test` remain green.

**Details:** See `single-instance-fix.md`.

---

## 10. Non-Goals

- No new features (chat, buttons, additional animations).
- No changes to renderer logic except HiDPI/scaling.
- No migration of existing macOS Keychain entries to Windows.
- No app-store release for Windows (native `.exe` / installer for now).
- No active further development of the macOS version; macOS paths are
  preserved, but the focus is on Windows.
