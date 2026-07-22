# Merge verification `upstream/main` → `bl-item/windows-native/BL-WIN` (2026-07-17)

Independent final review of the staged (not committed) merge state by the verification
sub-agent. Based on: `.flightplan/Archive/plans/merge-upstream-main-2026-07-17.md`.

## Verdict: APPROVED FOR MERGE COMMIT

All 12 feature points verified in code, no conflict markers, working tree fully staged
without artifacts, tests/typecheck/lint self-run and green. Only finding: one [minor] UI text
(upstream legacy), no merge defect.

## Checklist of the 12 points

| # | Point | Status | Evidence (File:Line) |
|---|-------|--------|----------------------|
| 1 | secrets.ts win32 safeStorage/DPAPI, used by mrr-engine + settings-window | ✓ | src/main/mrr/secrets.ts:25-35 (win32 backend), src/main/mrr/mrr-engine.ts:11 (`import { getSecret } from './secrets'`), src/main/mrr/settings-window.ts:21,118,167 — no direct keychain.ts access for secret I/O (main.ts:23 only uses `isValidKeychainService`, pure name validation) |
| 2 | IPC `settings:reset-progress` in ipc-channels + settings-preload + settings-window | ✓ | src/main/ipc-channels.ts:21, src/main/mrr/settings-preload.ts:15+30, src/main/mrr/settings-window.ts:194-202 (async handler, `{ ok: false, error: 'reset failed' }` on dep error), Drift-Guard src/main/ipc-channels.test.ts:62-65 |
| 3 | tray.ts win32-gate click → popUpContextMenu | ✓ | src/main/tray.ts:106-108 (registered once, outside rebuildMenu) |
| 4 | effectiveWorkArea / getOverlayWindowBounds (auto-hide inset) | ✓ | src/main/overlay-adapter.ts:34-52 (AUTO_HIDE_INSET_DIP=2, win32-gate), 74-76; Usage src/main/main.ts:128,184 |
| 5 | renderer.ts `evolutionState = null` on HATCH_START exactly once | ✓ | src/renderer/renderer.ts:190 (only place in onHatchStart; occurrence in :415 is the normal evolution completion in the tick, not a duplicate) |
| 6 | electron-builder.yml: win/nsis block + upstream mac.icns | ✓ | electron-builder.yml:14 (`mac.icon: assets/beaver-buddy-icon.icns`), 15-25 (win block incl. signtoolOptions sha256 + rfc3161), 26-34 (nsis: icons, desktop/start-menu shortcuts, installerLanguages en_US+de_DE) |
| 7 | settings.html danger-zone two-click arming, no window.confirm | ✓ | src/main/mrr/settings.html:114-123 (Pet fieldset), 244-271 (arming script, 5s window, `api.resetProgress()`); `window.confirm` does not occur in the file |
| 8 | main.ts onProgressReset ordering (persist → HATCH_START → reset, awaited) | ✓ | src/main/main.ts:284-295 (`await saveOnboardingState` → `send(HATCH_START_CHANNEL)` → `await xpEngine.resetProgress()`) |
| 9 | Connect Claude Code / Codex complete | ✓ | Tray entry src/main/tray.ts:66 + callback :20, wired in src/main/main.ts:330; Settings handler src/main/mrr/settings-window.ts:204-226 (`connectUsage`, validated via settings-validate); IPC channel src/main/ipc-channels.ts:24 + preload :16,31-32; tracker.ts parses only after opt-in (s. F) |
| 10 | Spend-tier quips | ✓ | src/main/quips/detectors.ts:11 (SpendTier spendWeak/Ok/Crazy), 56-61 (classify), 92-105 (daily reset + tier crossing); src/main/quips/quips.ts:7 (lowercase voice invariant), 77-79 (pools) |
| 11 | Retina bubble / DPR (superset applyDpr/logicalBounds) | ✓ | src/renderer/renderer.ts:94-100,205-218 (logicalBounds, currentDpr, applyDpr on bounds and DPR change); src/renderer/bubble.ts:116-118 (logical coordinates, sharpness via DPR backing store); src/renderer/canvas-dpr.ts present + test |
| 12 | Pet reset unified (allowStageSnap, cursor stays) | ✓ | src/main/xp/engine.ts:129-131 (`applyState({ xp: 0, lastMrrAwardDate: null }, { allowStageSnap: true })`), 137-151 (snap update without `evolvingTo`); `lastSeenLifetimeTokens` not in patch → cursor stays (rationale :125-128) |

## Self-run checks

- `npx vitest run`: **43 files, 434 passed / 6 skipped (440)** — exactly the state claimed in
  the merge doc. No unhandled errors.
- `npm run typecheck` (tsc --noEmit, renderer-tsconfig, gen-sprites-tsconfig): **clean**.
- `npm run lint` (eslint .): **clean** (in addition to the required check).
- `git diff --cached --check`: clean (no whitespace/marker remnants).

## A. Conflict markers

None. Grep for `<<<<<<<` / `=======` / `>>>>>>>` across `src/` and for `<<<<<<< HEAD` /
`>>>>>>> upstream|hash` across all ts/html/yml/md/json in the repo (node_modules excluded)
without hits.

## C. Git status

"All conflicts fixed but you are still merging." — 39 files, all staged (`M`/`A`), no unstaged
changes, no untracked files, no `*.orig` or other merge artifacts, no unmerged paths.

## E. Semantics spot-check Reset

Unification is correct: upstream mechanics (`applyState` + `allowStageSnap`, snap carries no
`evolvingTo` → no evolution quip/sequence, src/main/xp/engine.ts:146-148) on our async store
(`await saveState`, :140) with our IPC naming. `lastSeenLifetimeTokens` cursor remains untouched
(no re-award of history), `lastMrrAwardDate` is deleted. Chain in main.ts:284-295 fully awaited;
settings-window.ts:194-202 maps errors to `{ ok:false, error:'reset failed' }`.
settings-store.ts:78-80 contains the documented fix `void saveSettingsState(...).catch(...)`
(no floating promise during migration).

## F. Semantics spot-check Connect

tracker.ts parses file contents only after opt-in: discovery (logsFound) always runs,
`processFile`/parser only under `if (this.enabled.claude/codex)`
(src/main/usage/tracker.ts:160-167, header comment :11-13). `connected` is only
`enabled && logsFound` (:79,86); token counts are reported as 0 when disabled (:80-81,87-88).
Disabling evicts cache entries (:169-177). Tray shows "Connect…" entry (tray.ts:66), wired in
main.ts:330; opt-in flags are set at startup from persisted settings (main.ts:354-357) and updated
on change via onUsageEnabledChanged (main.ts:305-307).

## G. package.json / package-lock.json

`git diff upstream/main -- package.json` shows only legitimate branch-specific changes
(description "macOS and Windows", author, build via scripts/build-assets.js, assets:* scripts)
— nothing beyond that. package-lock.json is **identical to upstream/main** (empty diff); electron
43.1.1 in package.json:27 and in the lockfile confirmed.

## Findings

- [minor] src/main/mrr/settings.html:63 — Connect hint text literally says "on this Mac"
  (upstream text adopted unchanged). Visible to users on Windows builds; no merge defect, no
  functional problem. Recommendation: formulate platform-neutrally in a follow-up ("on this
  computer").
- Note (no finding): tray.ts:19-20 comments "focused on Connect", but main.ts:329-330 wires
  `onOpenConnect` and `onOpenGrowthSettings` to the same function — focus arises from the layout
  (Connect fieldset is at the top). Matches the upstream design, no action needed.

## Conclusion

The staged merge state is complete, conflict-free and verified. Both feature sets (Windows-native
+ upstream) are intact, the critical semantic decisions (reset unification, connect opt-in) are
correct in the code, and the claimed metrics (434/6, typecheck/lint/build) can be reproduced.
**Merge commit can proceed.**
