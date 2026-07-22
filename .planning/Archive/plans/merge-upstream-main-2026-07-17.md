# Merge `upstream/main` into `bl-item/windows-native/BL-WIN` (2026-07-17)

Semantic merge of 17 upstream commits (pet reset, spend-tier quips, Connect
Claude Code / Codex opt-in, macOS app icon, electron 43.1.1) with our
Windows-native branch (DPAPI secret store, settings progress reset, taskbar
auto-hide inset, tray click-gate, signing/installer config). Both feature
sets are kept everywhere; nothing was resolved mechanically via --ours/--theirs.

## Pet reset: one unified implementation (the key decision)

Both sides independently built the same feature with identical semantics
(XP→0 = level 1/baby, `lastSeenLifetimeTokens` cursor kept so history is
never re-awarded, `lastMrrAwardDate` cleared, secrets untouched, re-hatch
without an evolution quip). The unified version keeps **upstream's engine
mechanics** — `resetProgress()` goes through `applyState` with
`allowStageSnap: true`, so there is a single state path and the snap update
carries no `evolvingTo` — ported onto **our async store** (`await saveState`)
and **our IPC naming** (`settings:reset-progress`, `SETTINGS_RESET_PROGRESS_CHANNEL`,
`onProgressReset` dep, `resetProgress` handler/preload), which the already-
merged files (settings-window.ts, ipc-channels.ts, settings-preload.ts,
engine.ts) use consistently and which is the name shipped in our released
Windows builds. The handler stays async and maps a dep failure onto
`{ ok: false, error: 'reset failed' }` (upstream's sync fire-and-forget could
not do that); main.ts keeps **our ordering** — persist onboarding (awaited,
exactly-once discipline matching the launch hatch path) → `HATCH_START` →
`await resetProgress()` — which also satisfies upstream's invariant that the
hatch lands before `PET_CHANGED`. UI: **our two-click arming** in the
settings window's Pet fieldset replaces upstream's `window.confirm`
(deterministic, guaranteed available in the sandboxed renderer). Upstream
had no tray entry point either, so the settings window remains the single
entry — nothing of upstream's is lost.

## Per-file conflict decisions

- `src/main/xp/engine.ts` — upstream's `applyState(patch, { allowStageSnap })`
  on our async `applyState`; reset comment merges both rationales.
- `src/main/xp/engine.test.ts` — both reset test sets kept (6 tests),
  upstream's adapted to `await`.
- `src/main/ipc-channels.ts` / `.test.ts` / `settings-preload.ts` — our
  `settings:reset-progress` + upstream's `settings:connect-usage`; drift
  guards cover all five settings channels; preload `disconnect` accepts the
  widened `'stripe' | 'revenuecat' | 'claude' | 'codex'` target union.
- `src/main/main.ts` — our `onProgressReset` (persist → hatch → reset, all
  awaited) + upstream's `getUsageSources`/`onUsageEnabledChanged` deps;
  tracker wiring takes upstream's `usageTrackerInstance` + outer
  `usageTracker` ref + `setEnabledSources` from persisted settings, with our
  `await xpEngine.attachTracker(...)`.
- `src/main/usage/tracker.ts` — upstream's per-source totals/logsFound
  restructure of `refresh()`; our async-safe listener dispatch
  (`Promise.resolve(...).catch`) kept for `onChange` (engine callbacks are
  async).
- `src/main/mrr/settings-window.ts` — secrets.ts (keychain/safeStorage)
  backend + our async reset handler with error mapping + upstream's
  `connectUsage` handler, `usagePayload`, `getUsageSources`/
  `onUsageEnabledChanged` deps; window height 680 (Connect + Pet sections).
- `src/main/mrr/settings-window.test.ts` — both test sets merged (13 handler
  tests): upstream's usage tests kept, our secret-mock assertions and reset
  tests kept; upstream's sync reset/connect expectations adapted to the
  async handlers; full-object `toEqual`s extended with claude/codex fields.
- `src/main/mrr/settings.html` — upstream's Connect section + merged Pet
  fieldset with our two-click arming script (`api.resetProgress()`).
- `src/main/mrr/settings-store.test.ts` — merged; migration/opt-in defaults
  covered. `settings-store.ts` (auto-merged) got one semantic fix:
  upstream's fire-and-forget migration persist called our now-async
  `saveSettingsState` → floating promise (unhandled rejection in tests);
  now `void ...catch(...)` with an error log, load path stays sync.
- `src/renderer/renderer.ts` — our DPR approach kept (`applyDpr`/
  `logicalBounds`/`currentDpr`; the merged `onBoundsChanged`/resize handlers
  depend on it) — it is a superset of upstream's `syncCanvasResolution`
  (same Retina sharpness, plus DPR-change and explicit-bounds handling);
  clearRect likewise in logical coords. Removed the auto-merge duplicate of
  `evolutionState = null` in `onHatchStart` (both sides added it), comments
  merged.
- `electron-builder.yml` — upstream's `mac.icon: assets/beaver-buddy-icon.icns`
  plus our whole `win:`/`nsis:` block (icons, signtoolOptions, installer
  languages, shortcuts).
- `CLAUDE.md` — upstream's quip-voice bullet (lowercase, spend tiers) plus
  our platform-neutral "secrets → platform secure storage" phrasing.
- `src/main/tray.test.ts` (auto-merged) — one gap fixed: the third
  `callbacks()` helper lacked the now-required `onOpenConnect` (typecheck
  error).

## Verification

- `npm run test`: 43 files, 434 passed / 6 skipped (baseline before merge:
  393 passed / 6 skipped; +41 from upstream and merged resets) — zero
  unhandled errors.
- `npm run typecheck`, `npm run lint`: clean. `npm run build`: OK.

## Left for the orchestrator

Merge commit itself. Package.json/lock were auto-merged (electron 43.1.1,
@types/node 26.1.1) and untouched. macOS icon assets came from upstream;
`assets/icon.ico` (win) from our side — both referenced in electron-builder.yml.
