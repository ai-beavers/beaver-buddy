# Code Verification #46 — Reset Button (final review)

**Verdict: APPROVED**

Only the #46 hunks were reviewed, in: `ipc-channels.ts`, `settings-window.ts`, `settings-preload.ts`, `settings.html`, `xp/engine.ts`, `main.ts`, `renderer/renderer.ts` + the three test files. Older round-1 changes (secrets.ts, overlay-adapter.ts, package.json scripts etc.) were recognized as such and not evaluated.

## Findings

No blockers. Two minor observations, both deliberately planned or without consequence:

- [minor] `src/main/main.ts:263-274` — Error window in the reset flow: `saveOnboardingState` and the `HATCH_START` send run before `xpEngine.resetProgress()`. If only the last step fails (e.g. a `saveState` IO error), the hatch has already played but XP stays high. Consequence: a cosmetic mismatch that heals itself on the next pet update; the handler correctly reports `{ ok: false, error: 'reset failed' }`. The ordering is forced by the exactly-once discipline (persist-before-send, like the launch path `main.ts:197-203`) — no sensible fix possible.
- [minor] `src/main/mrr/settings.html:166-178` — The reset button is not disabled during the in-flight `api.resetProgress()` invoke; a third click can trigger a second, parallel reset. Harmless because the reset is idempotent (XP already 0, hatch plays again).

## Verified points

1. **Reset flow order** (`main.ts:263-274`): persist onboarding → `HATCH_START` → `resetProgress()` — identical to the launch discipline (`main.ts:197-203` persist-before-send, `main.ts:348-350` hatch-before-pet-update). The comments in the code name the invariants correctly.
2. **No token re-award** (`xp/engine.ts:127-134`): `lastSeenLifetimeTokens` remains untouched; the forward-only cursor prevents re-awarding the history. `lastMrrAwardDate → null` is intended per plan (a fresh beaver may receive the daily MRR again — no double-award of the same pet).
3. **No evolution quip on regression**: `resetProgress()` deliberately bypasses `applyState` (which would set `evolvingTo` symmetrically, `engine.ts:145`) and emits `{ level: 1, stage: 'baby' }` without `evolvingTo`; the quip only fires on `update.evolvingTo` (`main.ts:309-310`).
4. **IPC security**: the `resetProgress` handler has the same sender-frame check (`isAuthorized` → `isFromSettingsWindow`, `settings-window.ts:29-31,129`). The preload exposes exactly four named calls, no generic `invoke` (`settings-preload.ts:24-29`). A drift-guard test for the hand-synced literal exists and the regex matches (`ipc-channels.test.ts:61-65`). Handler registration goes through the existing `handlersRegistered` guard, no double `ipcMain.handle`.
5. **Renderer fix** (`renderer/renderer.ts:183-196`): `evolutionState = null` sits right after `startHatch()` in `onHatchStart` — the reset pet update then hits the direct-sync branch (`renderer.ts:170-174`) and syncs to `baby`. No side effect on the first hatch: `evolutionState` is `null` there anyway (HATCH_START arrives before any pet update). Evolution is frame-driven, no dangling timer when aborted.
6. **settings.html two-click arming**: logic correct — click 1 arms + a 5-s timeout disarms, click 2 disarms (incl. `clearTimeout`) and invokes; success/failure is shown in `#status`. `setStatus` uses `textContent` (`settings.html:94-96`) — no HTML injection path, all strings are own literals or `result.error` as text. Window height 480→540 set for the non-resizable window (`settings-window.ts:161`).
7. **Tests assert behavior**: the engine tests check state, the persisted file via `loadState`, no-re-award via cursor replay, and the exact update payload without `evolvingTo` (`engine.test.ts:239-279`). The settings-window tests check unauthorized rejection including "dep not called", the success path (dep called exactly 1×), and error mapping (`settings-window.test.ts:138-154`). No pure mock-call tests.
8. **Scope/constraints**: the `package.json` diff contains only round-1 asset scripts, `package-lock.json` unchanged, no new dependencies. No unrelated edits found in the #46 files. `dist/main/mrr/settings.html` contains `resetProgress` (3 hits) — the rebuild was run.
9. **Static checks**: `npm run typecheck` clean (all three tsconfigs), `npx eslint` on all #46 files without findings.

## Vitest result

`npx vitest run` (run myself): **Test Files 42 passed (42), Tests 389 passed | 6 skipped (395)** — exactly as expected. The 6 skipped are the known `ingest-images.test.ts` skips, not #46 tests.
