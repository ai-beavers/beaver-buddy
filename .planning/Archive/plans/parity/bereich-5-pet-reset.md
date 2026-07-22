# Area 5 — Pet Reset End-to-End (Functional Path)

Analyzed chain: `settings.html` (danger-zone arming) → `settings-preload.ts` → `settings-window.ts` (`resetProgress` handler) → `main.ts` (`onProgressReset`) → `xp/engine.ts` (`resetProgress`/`applyState`) → `renderer.ts` (re-hatch). Checked against merge state `d7acaf0` (branch `bl-item/windows-native/BL-WIN`).

## 1. Verdict

**PARITY OK** — no Windows gap found. 2 risks (no functional breakage).

The complete reset path is implemented platform-neutrally: no hardcoded paths, no macOS-only APIs, all file access goes through `app.getPath('userData')` + `path.join` + the Windows-hardened `atomicWriteFile` (EPERM/EBUSY retry). The feature history is cleanly merged: upstream brought the reset (`9c8bd00`), our branch extended it with tray refresh/arming (`4667082`), and merge `d7acaf0` contains both sides in full (verified against the current code, not the commit message).

## 2. Findings

### R1 [risk] Error-path desync: hatch runs even though the reset failed
- **File:line:** `src/main/main.ts:291-294` (HATCH_START before `await xpEngine.resetProgress()`), `src/main/atomic-file.ts:12,29-42` (retry budget)
- **Description:** `onProgressReset` sends `HATCH_START` **before** the XP state is persisted. If `saveState` fails (more realistic on Windows than on macOS: a virus scanner/indexer can hold the rename locks longer than the 4-attempt/~160 ms budget of `atomicWriteFile`), the handler correctly reports `{ ok: false, error: 'reset failed' }` (`settings-window.ts:199-201`) — but the hatch has already been sent and runs ~6 s in the overlay, while XP/stage/tray label remain unchanged. During the `baby-appear` phase the renderer even shows the old stage sprite (`renderer.ts:243-259` uses the unchanged `sheet`). Purely cosmetic, self-heals on the next pet update; the hatch-first ordering is deliberately chosen for the success path (invariant from `renderer.ts:167-171` and `main.ts:289-290`).
- **Fix proposal (no new dependencies):** In the handler's catch path, or after a failed `resetProgress`, send a resync `PET_CHANGED` with `xpEngine.getLastUpdate()` (the same resend mechanism as `main.ts:394-395`), so the renderer immediately snaps back to the true stage. Alternatively, deliberately document it as accepted behavior — the damage is a one-time cosmetic hatch animation.

### R2 [risk] Renderer reset interaction untested (no QA backstop on Windows)
- **File:line:** `src/renderer/renderer.test.ts:6` (only HiDPI/bounds tested); untested paths: `renderer.ts:185-199` (`onHatchStart` cancels an in-flight evolution), `renderer.ts:163-176` (stage snap during hatch)
- **Description:** The two renderer branches critical for a mid-session reset — (a) `evolutionState = null` on hatch during a running evolution, (b) the direct `setStage(pet.stage)` snap, because the reset update deliberately carries no `evolvingTo` (`engine.ts:146-148`) — have no unit test. The engine and handler layers are strongly tested (`engine.test.ts:239-310`, `settings-window.test.ts:239-262`); the renderer chain is not. This is less noticeable on macOS because manual QA happens there; on Windows there is no scripted acceptance path for the reset (the two-click arming UI is clickable via CDP, but no script wires that up — unlike `--quip`/`--inject-xp`/`--open-growth-settings`).
- **Fix proposal (no new dependencies):** A test in `renderer.test.ts` with the existing listener-stub infrastructure: fire the hatch callback → fire a pet update `{level:1, stage:'baby'}` without `evolvingTo` → assert `__debugPet.stage === 'baby'` and no `evolving` state; plus the case "evolution in flight → hatch cancels". Optional: a CDP script modeled on `scripts/cdp-screenshot.mjs` that uses `--open-growth-settings` and performs the arming double-click.

## 3. Verified-OK List

- **Arming script platform-neutral:** pure DOM JS, two-click arming instead of `confirm()` (sandbox-safe), `await api.resetProgress()` with success/error mapping — `settings.html:244-271`. No path/platform dependency.
- **Channel parity preload↔main:** `settings-preload.ts:15` literal `settings:reset-progress` = `ipc-channels.ts:21`; drift guard `ipc-channels.test.ts:62-65` covers the settings preload.
- **Handler:** sender-frame guard + `await deps.onProgressReset()` + error mapping — `settings-window.ts:194-202`; tests incl. unauthorized and failure cases: `settings-window.test.ts:127,239-262`; "settings/usage opt-ins untouched" explicitly tested: `settings-window.test.ts:246-255`.
- **Orchestration:** onboarding **awaited before** send (exactly-once discipline), HATCH before pet update (ordering invariant), engine reset **awaited** — `main.ts:284-295`. No async/await breakage anywhere in the chain (HTML → preload → handler → main → engine).
- **Tray label updated after reset:** the engine update synchronously fires all listeners (`engine.ts:150`) → `main.ts:339-341` calls `tray.refresh()` → `rebuildMenu` builds the label from `formatPetLabel(xpEngine.getState())` (`main.ts:319`, `tray.ts:56,110-121`) → "Lv 1 — baby (0/…)". The Windows single-click menu (`tray.ts:106-108`) uses `popUpContextMenu()` without args = always the most recently set menu, so no stale-menu problem after refresh.
- **Engine semantics:** `resetProgress` via `applyState({xp:0, lastMrrAwardDate:null}, {allowStageSnap:true})` → update without `evolvingTo` (no evolution quip, no evolution animation instead of hatch) — `engine.ts:129-131,146-148`. The `lastSeenLifetimeTokens` cursor remains → no re-award of token history — `engine.ts:126-128` + tests `engine.test.ts:253-264,290-309`. `lastMrrAwardDate` clearing tested: `engine.test.ts:280-288`.
- **Renderer re-hatch:** `onHatchStart` cancels evolution + starts hatch — `renderer.ts:185-199`; snap branch for an update without `evolvingTo` during hatch — `renderer.ts:172-176`. IPC order HATCH→PET guaranteed (FIFO per webContents; HATCH sent synchronously before the `await`, PET only after `saveState`).
- **MRR secrets untouched:** the reset chain writes exclusively `onboarding-state.json` (`onboarding.ts:36-38`) and `xp-state.json` (`xp/store.ts:51-53`); `secrets.ts` is only referenced by save/disconnect handlers and the MRR engine. The Windows DPAPI .enc path is tested with platform mocking (`secrets.test.ts:52-99`).
- **Paths Windows-safe:** `stateDir = app.getPath('userData')` (`main.ts:206`); secret files via `path.join` (`secrets.ts:16-18`); `atomicWriteFile` with Windows retry against transient locks (`atomic-file.ts:6,16-19,29-42`).
- **Packaging:** `settings.html` is copied to `dist/main/mrr/` by `build-assets.js:8` (artifact-verified), compiled `settings-preload.js` present; `electron-builder.yml:5-8` packs `dist/**` + `assets/**` → the settings window works in the NSIS build too. Window paths `path.join(app.getAppPath(), ...)` are asar-compatible (`settings-window.ts:257,262,268`).
- **Merge completeness:** `git show 9c8bd00` (upstream reset) + `git show 4667082` (branch: arming/tray/engine reset) — both verified in the current code; no merge loss.

## 4. Proposed Flight-Plan Items

- **BL-WIN-R1: Resync after a failed pet reset** — the catch path sends `PET_CHANGED` with `getLastUpdate()`, so a mistakenly started hatch visually falls back to the true stage (or document as accepted).
- **BL-WIN-R2: Renderer tests for mid-session reset** — cover hatch-cancels-evolution + stage-snap-without-`evolvingTo` with the existing listener-stub infra in `renderer.test.ts`; optionally a CDP script for Windows acceptance of the arming double-click.
