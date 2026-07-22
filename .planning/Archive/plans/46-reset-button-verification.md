# Verification — Plan #46 "Reset progress" button

Date: 2026-07-17 · Reviewer: plan-verification sub-agent · Reviewed plan: `.flightplan/Archive/plans/46-reset-button-plan.md`

## 1. Verdict: **PLAN OK WITH CORRECTIONS**

No blockers. All load-bearing technical claims (files, symbols, wiring, state files, renderer re-hatch, IPC pattern, build path, test count) were verified against the codebase and are correct. Three minor findings: one incorrectly described edge-case consequence (§6 of the plan), one imprecise line reference, one missing explicit rebuild note.

## 2. Findings list

### Finding 1 — [minor] The edge "reset during a running evolution" is described incorrectly in the plan
- **Plan:** §6 (line 149): "a running `evolutionState` would theoretically continue in parallel … in doubt the hatch simply plays again."
- **Codebase reality:** `src/renderer/renderer.ts:170` — the direct-sync branch is guarded by `!evolutionState`. If the reset pet update `{level:1, stage:'baby'}` arrives while an evolution (~2 s) is active, the stage sync is **discarded**; at evolution end, `renderer.ts:406-412` (`setStage(targetStage)`) sets the renderer to teen/adult — even though the engine says baby. The renderer then shows **the wrong stage permanently**, until the next pet update (next XP inflow) or an app restart heals it. Not a "parallel continuation", not a "hatch plays again" — but a persistent stage mismatch.
- **What must change in the plan:** correct §6: name the exact consequence (stage mismatch until the next pet update/restart, entry window ~2 s) and make a deliberate decision: (a) accept as before, or (b) one-line fix `evolutionState = null;` in `onHatchStart` (`renderer.ts:183-192`) — the latter contradicts the plan claim "no renderer change" (§3 step 4, §4 "Do not touch") and would have to be updated there as well.

### Finding 2 — [minor] secrets.ts line reference imprecise
- **Plan:** §2 (line 27): "`secrets/<service>/*.enc` (Windows DPAPI, `src/main/mrr/secrets.ts:14-18`)".
- **Codebase reality:** `secrets.ts:14-18` is only the path builder (`SECRETS_SUBDIR`, `secretFilePath`). The DPAPI/`safeStorage` implementation is in `secrets.ts:25-35` (`setSecret`, win32 branch).
- **What must change in the plan:** sharpen the reference to `secrets.ts:14-18` (path) and `secrets.ts:25-35` (DPAPI) respectively. Cosmetic.

### Finding 3 — [minor] Rebuild requirement after HTML change not explicit
- **Plan:** §4 "Do not touch" correctly names `scripts/build-assets.js` as unchanged, but never says that a build is needed after the `settings.html` change.
- **Codebase reality:** `settings.html` reaches `dist/main/mrr/settings.html` exclusively via `npm run build` (`package.json:13` → `scripts/build-assets.js:8`); `settings-window.ts:158` loads only the dist copy. Vitest does not cover dist — a stale dist state does not show up in tests, but it does during the manual visual check/smoke (fortunately `npm start` builds implicitly).
- **What must change in the plan:** in the test plan / manual section, explicitly record "`npm run build` before visual check/smoke".

## 3. Verified correct assumptions (selection, all with evidence)

**Files/symbols:** All mentioned files exist: `src/main/mrr/settings-window.ts`, `settings.html`, `settings-preload.ts`, `settings-validate.ts`, `src/main/ipc-channels.ts`, `src/main/onboarding.ts`, `src/main/xp/store.ts`, `src/main/xp/engine.ts`, `src/main/main.ts`, `src/main/tray.ts`.

**Wiring main.ts:**
- `stateDir` from `app.getPath('userData')`: `main.ts:191` ✓
- `--reset-hatch` path and persist-before-send discipline: `main.ts:193-203` ✓ (plan says "approx. line 193" / "197-203" — correct)
- Onboarding is read exactly once (`main.ts:195`; grep confirms no other production reader) → "no module caches onboarding status" ✓
- `openGrowthSettings` deps (`stateDir`, `keychainService`, `getSettings`, `onSettingsChanged`): `main.ts:252-264` ✓
- `xpEngine.onUpdate` wiring with `tray.refresh()` + `PET_CHANGED_CHANNEL` + `evolvingTo` quip: `main.ts:294-300` ✓
- Hatch-before-pet-update order: `main.ts:336-340` ✓
- `HATCH_START_CHANNEL` and `saveOnboardingState` already imported (`main.ts:6`, `main.ts:11`) → plan claim "no further changes/imports needed" ✓

**State files:**
- `xp-state.json` with `xp`, `lastSeenLifetimeTokens`, `lastMrrAwardDate`: `xp/store.ts:9-18` ✓
- Forward-only cursor (re-award protection): `xp/engine.ts:89-100` ✓ — preserving the cursor in the reset is mandatory and correct
- `onboarding-state.json` with `hatched`: `onboarding.ts:11-15` ✓; no `hatch:done` back-channel exists (`ipc-channels.ts` read in full) ✓
- `growth-settings.json` with `mode`/`stripeConnected`/`revenuecatConnected`: `settings-store.ts:19` ✓
- Secrets under `secrets/<service>/<account>.enc`: `secrets.ts:14-18` ✓

**XpEngine structure:** `stateDir`/`state`/`lastUpdate`/`listeners` private and accessible within the class body (`engine.ts:37-47`); `applyState` (`engine.ts:122-131`) sets `evolvingTo` **symmetrically** on every stage change — a reset via `applyState` would wrongly emit `evolvingTo: 'baby'` (evolution quip via `main.ts:297-299` + evolution sequence via `renderer.ts:148-160`). The plan decision to emit `resetProgress()` **without** `applyState` is correct and necessary. `getState()` correctly yields level 1 / stage baby for xp=0 (`curve.ts:17`, `curve.ts:28-42`).

**Re-hatch at runtime without renderer change (normal path):** `onHatchStart` unconditionally sets `hatchState` anew (`renderer.ts:183-192`) — a second `HATCH_START` on an adult beaver restarts the sequence cleanly; `draw()` renders only the hatch while `hatchState` is set (`renderer.ts:300-303`); the subsequent pet update without `evolvingTo` syncs the stage directly (`renderer.ts:170-174`), so the `baby-appear` phase shows the baby sheet. The lodge sheet is reloaded (idempotent). Quip/pause state untouched and consistent (quips during the hatch just play silently as on the launch path — existing behavior).

**IPC pattern:** sender-frame check `isFromSettingsWindow` (`settings-window.ts:28-30`), Electron-free handlers via `createSettingsHandlers` (`settings-window.ts:53-123`), one-time registration in `registerHandlers` (`settings-window.ts:125-133` — the deps of the first call stay bound; uncritical since the planned dep closures only use stable module references), window 420×480 `resizable:false` (`settings-window.ts:143-146`). Preload: hand-synced literals + top comment "exposes exactly the three settings calls" (`settings-preload.ts:4`, `:12-14`) — the plan changes (4th literal, 4th exposure, comment update) fit exactly. Leaving `settings-validate.ts` untouched is correct (no payload). Drift-guard pattern in `ipc-channels.test.ts:43-58` exactly as described in the plan.

**Build:** `package.json:13` (`build`: `tsc && tsc -p src/renderer && node scripts/build-assets.js`); `build-assets.js:8` copies `src/main/mrr/settings.html` → `dist/main/mrr/settings.html` ✓.

**UI space:** `settings.html` read in full: 3 fieldsets (Stripe ~95 px, RevenueCat ~135 px, Growth source ~75 px) + `#status` in 480 px window height; a 4th fieldset (~70 px) → 540 px is a plausible estimate; the CSP allows inline script (`settings.html:8-11`) → the two-click arming JS can run. The plan itself flags the height as an estimate to be measured ✓.

**Tray label:** `formatPetLabel({level:1, stage:'baby', xp:0})` → `xpForLevel(2) = 100` → exactly `Lv 1 — baby (0/100)` (`tray.ts:21-24`, `curve.ts:32-34`) ✓.

**Constraints/tests:** No new dependencies needed (everything composable from existing modules) ✓. Test patterns verified: `settings-window.test.ts:62-72` (`deps()` helper), `:86-92` (unauthorized test "all three handlers" — wording "unauthorized sender is rejected on all three handlers, with no state change"), `engine.test.ts` tmpdir/fake-tracker pattern, `loadState` importable from `store.ts` ✓. Test count: `npx vitest run` executed — **383 passed, 6 skipped (42 files)** — the plan figure "383 existing tests" is exact ✓.

**Reset semantics:** MRR re-award theory (`lastMrrAwardDate = null`) derived correctly (`engine.ts:114-116`); tracker tick after reset: cursor unchanged → `delta = 0` → no re-award (`engine.ts:89-91`) ✓; error UI on a failing reset via `{ ok: false, error: 'reset failed' }` → `#status` is included in the plan ✓; the `mainWindow?.webContents.send` null-safety matches the existing style ✓.
