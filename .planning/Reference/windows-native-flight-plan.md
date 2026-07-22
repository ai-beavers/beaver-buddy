# Beaver Buddy — Windows Native Flight Plan

**Version:** 0.1.0  
**Last commit:** `344ab52` — `feat: add initial content for Beaver animations ideas`  
**Status:** 2026-07-17 — Items 1, 2, 4a, 5, 6 ✅ completed; Items 3, 7 🔶 provisional (placeholder, designer art open); Item 4b 📄 documented (certificate pending). Round 2 (#46–#62) fully completed. Next round: #26 enable MRR mode, then #8–#18 animations.  

This Flight Plan lists all Windows-native tasks and features to be processed sequentially. Each item has a clear number, description, status, and acceptance criteria.

---

## 🔧 1. Windows-Native Infrastructure

### 1. Windows Secret Store for MRR Mode
- **Description:** Secure storage of Stripe/RevenueCat API keys on Windows (analogous to macOS Keychain).
- **Status:** ✅ Done.
- **Implementation:** New `src/main/mrr/secrets.ts` with platform-specific dispatch: macOS still Keychain (`security` CLI), Windows via `electron.safeStorage` (DPAPI) as encrypted `.enc` files under `<stateDir>/secrets/<service>/<account>.enc`. Callers migrated in `mrr-engine.ts`, `settings-window.ts` and `main.ts`. Tests added in `secrets.test.ts`, `mrr-engine.test.ts`, `settings-window.test.ts` and `atomic-file.test.ts`.
- **Validation:** `npm run typecheck`, `npm run lint`, `npm run test` (354 passed / 6 skipped), `npm run build` and `npx electron-builder --win --publish never` successful.
- **Acceptance:** Keys are stored encrypted, never as plaintext in `growth-settings.json`; MRR mode available on Windows.

### 2. Auto-Hide Taskbar Robustness
- **Description:** Native detection of the taskbar with `SHAppBarMessage`, so that the beaver stays correctly positioned when the taskbar is shown/hidden.
- **Status:** ✅ Done (2-DIP inset when `workArea === bounds` under win32; smoke-test tolerance for Windows window offset added).
- **Planning status:**
  - `koffi`/PowerShell approaches discarded — no new dependencies, no synchronous process spawn in the main process.
  - Final approach: 2-DIP inset when `workArea === bounds` under win32, central in `overlay-adapter.ts` (`effectiveWorkArea`). `createWindow()` and smoke test are migrated to safe bounds.
- **Acceptance:** The overlay does not block the Auto-Hide trigger: if Windows reports `workArea === bounds` (Auto-Hide active), the overlay window is inset by 2 DIP on all four sides under win32, so the taskbar still normally expands when the screen edge is touched. A brief occlusion of the beaver by the expanding taskbar remains a documented limitation (Windows system behavior, see comment in `src/main/overlay-adapter.ts`) and is explicitly not the subject of this item.

### 3. Professional Icon Pass
- **Description:** Final `assets/icon.ico` and `assets/tray-icon.png`/`tray-iconTemplate.png` to be created by a designer.
- **Status:** Provisional.
- **Implementation (improved provisional, 2026-07-16):** Icons are now programmatically generated from the committed `beaver-teen` idle frame (row 0, frame 0) — `npm run assets:icons` (`scripts/gen-sprites/build-icons.ts`): crop to content bbox, scale to 16/24/32/48/64/128/256 (downscale: area-average with premultiplied alpha; upscale 256: nearest-neighbor), package as PNG-based ICO via `scripts/gen-sprites/ico.ts`; `assets/tray-icon.png` as 32×32 RGBA PNG from the same state. Byte-deterministic, no new dependencies; `assets/tray-iconTemplate.png` unchanged. Tests: `ico.test.ts` (header/LE/256→0 rule/offset walk), `build-icons.test.ts` (determinism, committed assets match generator). Designer assignment for final icons remains open.
- **Validation:** `npm run assets:icons`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` and `npx electron-builder --win --publish never` successful.
- **Acceptance:** Icons are contrast-rich on light/dark taskbars, scale cleanly from 16×16 to 256×256, match the sprite palette.

### 4. Windows Code Signing

#### 4a. Signing Infrastructure
- **Description:** Signing pipeline with self-signed certificates: local development signature, CI signature with throwaway certificate per run, post-build verification via `Get-AuthenticodeSignature`, docs in `docs/code-signing.md`.
- **Status:** ✅ Done (`signtoolOptions` in `electron-builder.yml`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, CI integration, `docs/code-signing.md`).
- **Context:** Self-signed signature does **not** remove the SmartScreen warning (no public trust chain, no SmartScreen reputation). 4a therefore only delivers the technical infrastructure (electron-builder configuration, CI steps incl. fork-PR handling, verification gate, docs) — the original acceptance criterion of #4 moves to 4b.
- **Acceptance:** Windows CI build produces signed artifacts (throwaway self-signed, or real certificate if secret configured); verification step fails if an artifact is unsigned; local signature instructions documented; local builds and fork-PRs without secrets stay green (no `forceCodeSigning` in repo config).

#### 4b. SmartScreen-Free Delivery
- **Description:** Publicly trusted signature of release artifacts so that Windows Defender SmartScreen shows no warning. Options (docs in `docs/code-signing.md`): Azure Trusted/Artifact Signing (recommended, ~10 USD/month, reputation via Microsoft chain) or classic OV/EV certificate (OV needs reputation build via downloads, EV instant reputation, both paid, since 2023 HSM/cloud mandatory).
- **Status:** 📄 Documented, not implemented.
- **Dependencies:** #4a (infrastructure: `signtoolOptions`, CI secret handling, verification gate), #42 (release pipeline — the real certificate only takes effect on publish; `--publish never` remains until #42).
- **Acceptance:** Signed release artifacts without SmartScreen warning (original acceptance criterion of #4).

### 5. Installer Localization
- **Description:** Localize NSIS installer to German/English (possibly more languages).
- **Status:** ✅ Done (`installerLanguages: [en_US, de_DE]` in `electron-builder.yml`; installer build shows 2 language tables).

### 6. Windows Start Menu / Desktop Shortcut
- **Description:** Optionally create start menu entry and desktop shortcut during install.
- **Status:** ✅ Done (`createDesktopShortcut: true`, `createStartMenuShortcut: true`, `shortcutName: Beaver Buddy` in `electron-builder.yml`).

---

## 🦫 2. Beaver Stages & Animations

### 7. Adult Stage Art
- **Description:** Complete sprite sheets for `adult` (idle, walk left/right, possibly more animations).
- **Status:** Provisional (2026-07-16) — placeholder sheet derived from teen sheet; final adult art remains open (designer/owner task).
- **Implementation (Provisional):** `scripts/gen-sprites/build-adult-placeholder.ts` (`npm run assets:adult-placeholder`) generates `assets/sprites/beaver-adult.png/.json` mechanically from the committed `beaver-teen` sheet: per tile extraction (`extractTile`), crop to content bbox, nearest-neighbor upscale to full 96px tile height, bottom-aligned centered (`placeOnTile`) — the adult reads as a larger teen. Meta (tile/fps/rows) inherited from teen sheet, sheetWidth/sheetHeight recalculated. Byte-deterministic, no new dependencies. Teen fallback removed in `src/renderer/sprites.ts#loadSheet`; `npm run build` copies the sheet as before via `scripts/build-assets.js`. Tests: `build-adult-placeholder.test.ts` (determinism, committed assets match generator, structure/content invariants incl. full tile height per frame, placeholder guard adult ≠ teen).
- **Validation:** `npm run assets:adult-placeholder`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` and `npx electron-builder --win --publish never` successful.
- **Acceptance:** Standalone `assets/sprites/beaver-adult.png/.json`, 96×96 tiles, consistent with `STYLE.md`. (Form fulfilled; standalone final adult art replaces the provisional.)

### 8. Coding Animation
- **Description:** Beaver sits at a laptop and types/codes.
- **Origin:** Animation ideas raw text.
- **Dependencies:** Adult Stage (#7), possibly new state-machine states.

### 9. Drink Animations
- **Description:** Beaver drinks coffee, matcha, bubble tea.
- **Origin:** Animation ideas raw text.

### 10. Sleep Animation
- **Description:** Beaver lies down to sleep, incl. sleep position and movement in sleep.
- **Origin:** Animation ideas raw text.

### 11. Wake/Stretch Animation
- **Description:** Beaver wakes up and does a yoga/stretch movement.
- **Origin:** Animation ideas raw text.

### 12. Speaking with Mouth Movements
- **Description:** Mouth movements synchronized with the quip bubble (programmatically animated).
- **Origin:** Animation ideas raw text.
- **Note:** Bubble already exists, mouth animation missing.

### 13. Sport Animations
- **Description:** Beaver does squats, dumbbell training, or trains at equipment.
- **Origin:** Animation ideas raw text.

### 14. Stick Throwing / Stick Collecting
- **Description:** Beaver throws a stick or collects sticks.
- **Origin:** Animation ideas raw text.

### 15. Plant Tree & Water
- **Description:** Small plant grows gradually, beaver waters it.
- **Origin:** Animation ideas raw text.
- **Note:** Requires external object (plant/tree) in the overlay.

### 16. Toilet Wave
- **Description:** Beaver goes to the toilet, then a wave comes and flushes it away.
- **Origin:** Animation ideas raw text.

### 17. Phone / Brain-Rot Animation
- **Description:** Beaver lies on a phone and scrolls.
- **Origin:** Animation ideas raw text.

### 18. Meeting / Speech Animation
- **Description:** Beaver talks for a long time (as in a meeting).
- **Origin:** Animation ideas raw text.

---

## 🎮 3. Behavior & State Machine

### 19. Extended Roaming States
- **Description:** More states than just `idle`/`walk`/`climb` (e.g., `coding`, `sleeping`, `drinking`, `exercising`).
- **Dependencies:** Animations #8–#18.

### 20. State Transitions with Habits
- **Description:** Beaver switches to other states depending on time of day, idle time, token-burn intensity.
- **Example:** After 20 minutes coding → drink; after 30 minutes idle → sleep.

### 21. Interactions with Objects in the Overlay
- **Description:** External objects (laptop, cup, dumbbell, plant, phone) spawn and interact with the beaver.
- **Dependencies:** Animations #8–#18.

### 22. More Quip Triggers
- **Description:** New quip triggers for drink, sleep, sport, coding, etc.
- **Status:** Basic triggers exist, extended ones missing.

### 23. Quip Tone / Mood Dependency
- **Description:** Quips adapt to the current animation/state.

---

## 📊 4. Growth & Tracking

### 24. Windows Codex Usage Paths Extended
- **Description:** Robustly cover more path variants for Codex logs on Windows.
- **Status:** Basis implemented, possibly edge cases.

### 25. Token Burn Spike Detection Improved
- **Description:** More accurate detection of spikes and longer coding sessions.
- **Status:** Basis exists.

### 26. Enable MRR Mode on Windows
- **Description:** Once #1 (Windows Secret Store) is implemented, unlock MRR mode.
- **Dependencies:** #1.

### 27. More MRR Sources
- **Description:** Additional providers besides Stripe/RevenueCat (e.g., Paddle, Lemon Squeezy).

---

## 🪟 5. Overlay & Window Behavior

### 28. Multi-Display Support
- **Description:** Beaver can wander to secondary monitors, overlay follows the active display.
- **Status:** Currently primary monitor only.

### 29. Fix Overlay on Specific Displays
- **Description:** User can choose in the tray menu on which display the beaver lives.

### 30. Virtual Desktop Support
- **Description:** Beaver stays visible when switching between Windows desktops or follows the user.

### 31. Ignore Window Snap
- **Description:** Prevent Windows Snap from snapping the overlay.

### 32. Refine Focus / Activation Behavior
- **Description:** Ensure the overlay never steals focus or keyboard input.

---

## ⚙️ 6. Settings & Tray

### 33. Adjust Settings Window for Windows
- **Description:** Check and adjust the UI/UX of the settings window to Windows-native look & feel.

### 34. Extend Tray Menu
- **Description:** Additional entries: choose animation, choose display, speed, volume, etc.

### 35. Persistent User Settings
- **Description:** Save beaver behavior, animation frequency, quip frequency, etc.

### 36. Autostart Option
- **Description:** Option in the tray menu: "Start with Windows".

---

## 🧪 7. QA & Design Gates

### 37. Real Windows HiDPI Screenshots
- **Description:** Screenshots at 100 %/125 %/150 %/200 % scaling + light/dark taskbar.
- **Status:** Provisional.
- **Dependencies:** #3 (Icons).

### 38. Design Gate for Each New Animation
- **Description:** Each animation from #8–#18 goes through the R10 design gate.
- **Dependencies:** Respective animation.

### 39. Performance Profiling on Windows
- **Description:** Guarantee CPU usage < 5 % in idle, especially with many animations.

### 40. E2E Tests for Windows
- **Description:** Integration tests for main process/overlay/tray (e.g., with Playwright or Spectron successor).

### 41. Manual Acceptance Tests on Windows
- **Description:** Checklist for Windows: Install, Start, Pause, Quit, Hatch, Evolution, MRR.

---

## 🚀 8. Release & Distribution

### 42. Automated Windows Release Pipeline
- **Description:** GitHub Actions builds and publishes Windows installer/portable on every tag.
- **Status:** CI builds, but publication is `publish never`.

### 43. Version Update to 0.2.0
- **Description:** Once Windows-native features are implemented, bump version in `package.json`.

### 44. Changelog & Release Notes
- **Description:** Official changelog for 0.2.0 with all Windows features.

### 45. Update Mechanism
- **Description:** Optional: Auto-update for Windows via electron-updater.
- **Note:** PRD says "no auto-update" in MVP, but later conceivable.

---

## 🔄 9. Round 2: Parity & Polish (2026-07-17)

### 46. Reset Button in Settings Window
- **Description:** Visible reset button in the settings window (Growth Settings) that resets the beaver to the start (progress/XP back to beginning, hatch animation again). Currently reset only exists as hidden QA flag `--reset-hatch` (main.ts) or factory reset via deleting the state dir.
- **Status:** ✅ Done & verified (Round 2, 2026-07-17) — Plan/verification reports under `.flightplan/Archive/plans/46-*.md`; 389 tests green. Manual visual check (window 420×540) still pending (design gate #37/#41).
- **Implementation:** `src/main/ipc-channels.ts` (new channel `settings:reset-progress`), `src/main/mrr/settings-window.ts` (handler `resetProgress`, dep `onProgressReset`, window height 480→540), `src/main/mrr/settings-preload.ts` (exposure), `src/main/mrr/settings.html` (danger zone with two-click arming), `src/main/xp/engine.ts` (`resetProgress()`, cursor-preserving, without `evolvingTo`), `src/main/main.ts` (wiring: persist onboarding → HATCH_START → engine reset), `src/renderer/renderer.ts` (`evolutionState = null` on HATCH_START), Tests: `src/main/xp/engine.test.ts`, `src/main/mrr/settings-window.test.ts`, `src/main/ipc-channels.test.ts`.
- **Validation:** Plan verification (3 minor findings, incorporated), code verification APPROVED (0 blockers), `npx vitest run` 389 passed / 6 skipped, typecheck + lint + build green.
- **Acceptance:** Button visible in `settings.html`; click resets XP/onboarding state and restarts hatch animation; MRR accesses/secrets preserved; IPC with sender-frame validation and payload validation analogous to existing settings channels; tests following `settings-window.test.ts` pattern.

### 47. Tray: Single Click (Left Click) Opens Menu
- **Description:** On Windows, the tray menu currently only opens on right-click (on touchpads: two-finger tap). A single left click on the tray icon should open the same context menu (`tray.popUpContextMenu()`), so all actions (settings, reset, pause, quit) are reachable with one click.
- **Status:** ✅ Done & verified (Round 2, 2026-07-17) — Plan/reports under `.flightplan/Archive/plans/47-*.md`; 393 tests green. Manual live verification (left click on real Windows taskbar) still pending (#41).
- **Validation:** Plan verification PLAN OK (4 minor clarifications, incorporated), code verification APPROVED (0 findings), `npx vitest run` 393 passed / 6 skipped, eslint clean.
- **Implementation:** `src/main/tray.ts` (single `tray.on('click', …)` → `popUpContextMenu()` behind `process.platform === 'win32'` gate in `createTray()`, after `setToolTip`, outside `rebuildMenu()` → no handler stacking, fresh menu after `refresh()`), `src/main/tray.test.ts` (electron mock extended with fake `Tray` + `Menu.buildFromTemplate`; 4 new tests: win32 registration without captured menu, no stacking across `refresh()`, no handler on darwin/linux).
- **Acceptance:** Left click opens context menu; right click still works; macOS behavior unchanged; wiring covered by `tray.test.ts`.

### 48. 💡 Open Idea: Taskbar Jump Animation
- **Description:** When the beaver is occluded by the (auto-hide) taskbar, it should jump up from behind the taskbar and then be able to balance on the taskbar.
- **Status:** Open idea — only documented, no implementation order (noted by owner 2026-07-17).
- **Dependencies:** #2 (Taskbar detection), new animations from the #8–#18 family, possibly #19 (State Machine).
- **Note:** Prioritization/implementation decided by owner later.

### 49. Unify Codex Homes on Windows instead of First-Wins (sharpens #24)
- **Description:** `usage/paths.ts:154-156` — if `%APPDATA%\Codex` exists (Electron userData of the Codex Desktop app, without `sessions/`), the real CLI path `%USERPROFILE%\.codex` is never checked → Codex connect is non-functional for these users. Fix: union of all existing candidates + relative-path dedup; regression test. Report: `parity/bereich-1`.
- **Status:** ⏸️ Planning ✅ + plan verification ✅ (PLAN OK, `.flightplan/Archive/plans/49-codex-pfad-union-{plan,verification}.md`) — **Implementation paused** (2026-07-17): implementation agent started, production side of `paths.ts` was done (tests not yet flipped), then connection drop. Partial diff was saved as `.flightplan/Archive/plans/49-partial-implementation.patch` and working tree was reset afterwards → suite green (435/6). **Next step:** Restart implementation agent — review/apply patch OR cleanly re-implement from plan (plan is leading), then flip/add tests, then code verification.
- **Acceptance:** Codex sessions are also found when the Codex Desktop app is installed; test "empty %APPDATA%\Codex does not hide ~/.codex" green.

### 50. Formulate Connect Hint Platform-Neutrally
- **Description:** `settings.html:63` says „usage logs on this Mac" — visibly wrong on Windows. Fix: „on this computer" (1 line; possibly upstream). Report: `parity/bereich-2`.
- **Status:** ✅ Done & verified (Round 2, 2026-07-17) — Report `.flightplan/Archive/plans/50-code-verification.md` (APPROVED); 434 tests green.
- **Implementation:** `src/main/mrr/settings.html:63` — „on this Mac" → „on this computer" (only hit in `src/`; no duplicates in tests). Plan: `.flightplan/Archive/plans/50-connect-hint-text-plan.md`. build/test/typecheck/lint green (434 passed / 6 skipped).

### 51. Measure and Adjust Settings Window Height for 5 Sections
- **Description:** Window 420×680 (`settings-window.ts:250-255`) — content ≈ 700–730 CSS px vs. viewport ≈ 649 px (Win) → Pet/Reset section + status line ~50–80 px below the fold, permanent scrollbar. Directly affects visibility of the reset button (#46). Fix: measure real `scrollHeight` via CDP (`--open-growth-settings`, flag exists), then height ~750–760 or `useContentSize: true`; extend target selection in `cdp-screenshot.mjs` for non-overlay windows. Report: `parity/bereich-2`.
- **Status:** ✅ Done & verified (Round 2, 2026-07-17) — Reports `.flightplan/Archive/plans/51-*.md`; measured 705 px → set 713 px (`useContentSize` + workArea capping); screenshot `docs/design-reviews/BL-51-settings.png` without scrollbar, reset button fully visible; 435 tests green.
- **Acceptance:** All 5 fieldsets + status line visible when opened without scrolling; screenshot proof.
- **Implementation:** `src/main/mrr/settings-window.ts` (`useContentSize: true`, `height = min(713, workAreaSize.height − 40)`; 713 = CDP-measured worst-case 705 px + 8 px buffer, measured 2026-07-17), pin test in `settings-window.test.ts`, `scripts/cdp-screenshot.mjs` extended with `--target`/`--measure`, screenshot `docs/design-reviews/BL-51-settings.png` (all 5 fieldsets + reset button, no scrollbar; post-fix `hasVScroll`/`hasHScroll` = false). Tests 435 green, typecheck/lint/build green. Plan + measurements: `plans/51-settings-fensterhoehe-plan.md` §7.

### 52. DPR Drift Guard in Renderer
- **Description:** DPI change without DIP workArea change (e.g., primary monitor switch 1920×1080@100 % ↔ 3840×2160@200 %) is swallowed by the guard in `main.ts:227-234` → `currentDpr` stale → canvas/bubble permanently blurry until restart. Fix: DPR drift check in rAF loop + re-read `currentDpr` in `onBoundsChanged`; optional `scaleFactor` in main-side change comparison. Report: `parity/bereich-4`.
- **Status:** Open (parity gap, swarm 2026-07-17).

### 53. Check Claude XDG Candidate on Windows Too (+ CRLF Test)
- **Description:** Win32 branch of `claudeConfigDirs` (`paths.ts:54-56`) ignores `~/.config/claude`, Unix uses union — asymmetric. Fix: win32 as union (one line), test `paths.test.ts:76-81` deliberately flip. Take along: CRLF case for `read-lines.test.ts` retrofit (no finding, gap in test coverage). Report: `parity/bereich-1`.
- **Status:** Open (parity risk, swarm 2026-07-17).

### 54. Post-Merge Hygiene: npm ci
- **Description:** Local node_modules stale (electron 43.1.0 installed vs. 43.1.1 locked) — `npm ci` to locked state. No dependency change. Report: `parity/bereich-8`.
- **Status:** Open (hygiene, orchestrator directly).

### 55. TS-7-Ready tsconfig (node10 → nodenext)
- **Description:** `tsconfig.json:6` uses `moduleResolution: node10`, which no longer works in TypeScript 7 — Dependabot branch `typescript-7.0.2` would break typecheck/build. Fix: migrate to `nodenext` before Dependabot merge. Report: `parity/bereich-8`.
- **Status:** Open (parity risk, swarm 2026-07-17).

### 56. Couple @types/node to Node 24 Runtime
- **Description:** `@types/node ^26.1.1` (inherited from upstream) vs. Node 24 runtime everywhere (engines, CI, Electron 43 bundled) — currently latent. Fix: pin to `^24` + Dependabot ignore for `@types/node` major. Report: `parity/bereich-8`.
- **Status:** Open (parity risk, swarm 2026-07-17).

### 57. Resync after Failed Pet Reset
- **Description:** `main.ts:291` sends HATCH_START before XP persist — on persist failure (Windows: rename lock by AV/indexer) the hatch runs cosmetically even though the reset failed. Fix: catch path sends `PET_CHANGED` with `getLastUpdate()` (self-healing) — or document as accepted. Report: `parity/bereich-5`.
- **Status:** Open (parity risk, swarm 2026-07-17).

### 58. Renderer Tests for Mid-Session Reset
- **Description:** Cover hatch-cancels-evolution + stage-snap-without-`evolvingTo` with existing listener-stub infrastructure in `renderer.test.ts`; optional CDP acceptance of arming double-click. Report: `parity/bereich-5`.
- **Status:** Open (test gap, swarm 2026-07-17).

### 59. Switch Windows Window Icon to ICO
- **Description:** Upstream d1b4ebe sets BrowserWindow icons as 1024² PNG (`settings-window.ts:257`) — functional on Windows, but ICO would be sharper/conventional. Fix: platform gate to `assets/icon.ico` following `loadTrayIcon` pattern + mini test. Report: `parity/bereich-6`.
- **Status:** Open (parity risk/cosmetic, swarm 2026-07-17).

### 60. Windows Live Gate Renderer Visuals (Hatch/Evolution/Quip Bubble)
- **Description:** Real Windows screenshots of post-merge visuals (12 px bold bubble, hatch, evolution flash) at 100/125/150/200 % scaling via `--quip`/`--inject-xp`/`--reset-hatch` + `cdp-screenshot.mjs`; store in `docs/design-reviews/phase-4-windows/` (resolves open provisional gate, linked to #37). Report: `parity/bereich-7`.
- **Status:** Open (verification backlog, swarm 2026-07-17).

### 61. Windows Behavior Docs: Occlusion + Fractional DPR
- **Description:** One sentence doc: when overlay is fully occluded, animation pauses by design (Chromium occlusion, Windows-only). Also document: pixel-art shimmer at fractional DPR (125/150/175 %) is inherent (wontfix). Report: `parity/bereich-7` + `parity/bereich-4`.
- **Status:** Open (docs, swarm 2026-07-17).

### 62. Evaluate/Document WSL Usage Logs
- **Description:** WSL-based Claude/Codex installations are invisible to the native process (logs under `\\wsl$\<distro>\...`). For now document + override workaround (`CLAUDE_CONFIG_DIR`/`CODEX_HOME` to the WSL path; both overrides exist). No premature build (registry enumeration without new deps not clean). Report: `parity/bereich-1`.
- **Status:** Open (docs/evaluation, swarm 2026-07-17).

### 63. (Optional) Bubble Outline: Physical Pixel Snapping at Fractional DPR
- **Description:** +0.5 crisp-line trick (`bubble.ts:103-114`) only works at dpr 1/2; at 1.25/1.5/1.75 the 1 px outline is slightly soft (text stays sharp). Fix: stroke width `1/dpr` + positions rounded via `ctx.getTransform().a` — or document as acceptable fractional-scaling behavior. Report: `parity/bereich-4`.
- **Status:** Open (optional/cosmetic, swarm 2026-07-17).

### 64. (Optional, upstream candidate) Launch Tier Quip Swallowed
- **Description:** First spend-tier event after `did-finish-load` is swallowed on both platforms (onTick fires before `rendererReadyForQuips`, `main.ts:358` vs. `:400`). Fix: replay analogous to evolution replay. Parity-neutral — better to upstream. Report: `parity/bereich-3`.
- **Status:** Open (optional, both platforms, swarm 2026-07-17).

---

## 📋 Progress & Next Order

**Done (Round 1, 2026-07-16/17):** #1, #2, #4a, #5, #6 — each complete sub-agent loop (planning → plan verification → implementation → verification).
**Provisional:** #3 (Icons generated from sprite, designer open), #7 (Adult placeholder from teen sheet, designer open).
**Documented, not implemented:** #4b (SmartScreen-free signature — paid certificate/Azure Trusted Signing).

**Round 2 (2026-07-17, added by owner):** #46 Reset button in settings window ✅, #47 Tray single click ✅, #48 open idea taskbar jump (docs only), #49+ upstream parity with `ai-beavers/beaver-buddy`.

**Round-2 progress (2026-07-17, final):**
- Commits: `e553c06` (Secret Store), `94ace5c` (Icons/Sprites), `cd4ef80` (CI/Signing/Installer), `4667082` (Taskbar inset, tray click, reset), `e519105` (#50 text), `5b19835` (#51 window height).
- **Merge `d7acaf0`:** `upstream/main` semantically merged.
- **Parity analysis completed (swarm, 8 areas):** Reports under `.flightplan/Archive/plans/parity/`.
- **Parity items #49–#62 all ✅ (2026-07-17, 2nd session):**
  - #49 Codex path union: `paths.ts` union + 3 new tests
  - #50 „on this Mac" text: ✅ (previous commit `e519105`)
  - #51 Window height: ✅ (previous commit `5b19835`)
  - #52 DPR drift guard: rAF loop + `onBoundsChanged` re-read `devicePixelRatio`
  - #53 Claude-XDG-union + CRLF test: win32 now uses XDG + legacy, CRLF test in `read-lines`
  - #54 npm ci: node_modules to lockfile state
  - #55 TS-7-ready tsconfig: `moduleResolution: node10` → `nodenext`, `ignoreDeprecations` removed
  - #56 @types/node: `^26.1.1` → `^24.0.0` + Dependabot ignore
  - #57 Resync after failed pet reset: catch path sends `PET_CHANGED`
  - #58 Renderer tests for mid-session reset: 2 new tests
  - #59 Windows window icon: `settings-window.ts` platform gate to `icon.ico`
  - #60 Live gate renderer visuals: 4 CDP screenshots in `docs/design-reviews/phase-4-windows/`
  - #61 Windows behavior docs: occlusion + fractional-DPR-wontfix in README
  - #62 WSL usage logs docs: README extended with WSL note + override workaround
- **#63/#64 (optional):** Not implemented — owner decision pending.

Then as previously suggested:

1. **#26** Enable MRR mode on Windows (dependency #1 is fulfilled)
2. **#8–#18** Animations (parallel after assets)
3. **#19–#23** State machine & behavior
4. **#28–#32** Overlay improvements
5. **#33–#36** Settings & tray
6. **#37–#41** QA & design gates
7. **#42–#45** Release & distribution

---

## ✅ Build Status (As of 2026-07-17, after Round 2 completion)

- `npm run build`: ✅ successful
- `npm run typecheck`: ✅ successful
- `npm run lint`: ✅ successful
- `npm run test`: ✅ **441 passed, 6 skipped (43 files)**
- `npm ci`: ✅ node_modules to lockfile state
- `tsconfig.json`: `module: nodenext`, `moduleResolution: nodenext` (TS-7-ready)
- `@types/node`: `^24.0.0` (coupled to `engines.node: 24.x`, Dependabot ignore for major bumps)
- CDP screenshots: `docs/design-reviews/phase-4-windows/{idle,quip-bubble,hatch,evolution-flash}.png`
- Git: working tree clean; `.flightplan/Archive/` gitignored (local docs)

---

## ▶️ Resume Instructions (Next Session)

**Current item:** Round 2 fully ✅. **Next item: #26** — Enable MRR mode on Windows (Secret Store has been implemented since #1, dependency fulfilled).

### Immediate Action (Next Session, Step 1)
- #26: Enable MRR mode on Windows — unlock `mrr-engine.ts` + `settings-window.ts` on Windows, add tests.
- Then in order: #8–#18 (Animations), #19–#23 (State machine), #28–#32 (Overlay), #33–#36 (Settings & tray), #37–#41 (QA & design gates), #42–#45 (Release & distribution).
- Optional: #63 (bubble outline snapping) and #64 (launch tier quip replay) — ask owner.

### Strict Constraints (Owner Specifications)
- **NO new npm dependencies** — package.json/package-lock.json unchanged.
- No git mutations (commit/push/merge/rebase) without explicit owner instruction.
- `.flightplan/Archive/` is gitignored → all plans/reports are local; committed docs (README, docs/) remain in English.
- Touch only the necessary files per item; comments/tests in English (project convention), Flight-plan in English.

### Machine / Tooling Knowledge (Do Not Re-Derive)
- `powershell.exe` has a broken security module → **always use `pwsh`** for signature checks.
- Node 24 runs `.ts` directly (scripts under `scripts/gen-sprites/*.ts` run via `node …`).
- CDP verification: `scripts/cdp-screenshot.mjs <port> <outfile|-> [delayMs] [--target=<substr>] [--measure]`; app start isolated via `npx electron . --user-data-dir=/tmp/<dir> --remote-debugging-port=9223 [--open-growth-settings] [--inject-xp=3100] [--reset-hatch] [--quip <trigger>]`; terminate processes cleanly afterwards.
- QA flags: `--smoke`, `--reset-hatch`, `--quip`, `--inject-xp` (3100 = adult threshold), `--open-growth-settings`.
- System locale en-US; 7-Zip at `/c/Users/rodgi/scoop/shims/7z`.
- On sub-agent start errors (429/OAuth/Connection): wait briefly, resume agent with `resume` (keeps context).
- Test baseline at this point: **441 passed / 6 skipped (43 files)**.
- `npm ci` has been run; `tsconfig.json` on `nodenext`; `@types/node` on `^24`.
