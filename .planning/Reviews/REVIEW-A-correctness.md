# Review A — Correctness & Security

Branch: `bl-item/pixijs-puppet-studio/BL-14`  
Reviewer: A (Correctness & Security)  
Date: 2026-07-18  

## Findings

### critical

- `src/renderer/index.html:1` — Pet overlay renderer has no `Content-Security-Policy`. This contradicts the P1 Electron hardening invariants from `CLAUDE.md` (CSP etc.). The settings window (`src/main/mrr/settings.html`) has a CSP, but the pet overlay does not. Since the renderer uses `fetch` for sprite sheets and meta JSON, a missing CSP theoretically allows any `connect-src` / navigation / script execution if the invariants were ever bypassed.  
  **Fix:** Add `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'">` to `src/renderer/index.html`.

### major

- `src/main/mrr/mrr-engine.ts:38-40` (Start) + `pollNow()` (from line 55) — `MrrEngine.pollNow()` is not protected against concurrent execution. A timer tick (every 24 h) and a manual `pollNow()` (e.g., via the `--mrr-poll-now` flag on mode change) can overlap. Both call `getLastMrrAwardDate()` in sequence, both see `null`/an old value, both perform network queries, and both award XP for the same day. The test suite does not cover this because all mocks are synchronous.  
  **Fix:** Introduce a `private inFlight = false` guard in `MrrEngine`; `pollNow()` should return immediately if a poll is already running.

- `src/main/mrr/settings-window.ts:147-150` — `win.loadFile(...).catch()` only logs `console.error` and leaves the window open. If the HTML/preload cannot be loaded, an empty, non-functional settings window remains. For a window in which API keys are entered, this is weak error recovery.  
  **Fix:** In the `catch` block call `win.destroy()` and set `settingsWindow = null`, so a subsequent call to `openSettingsWindow()` builds a new window.

### minor

- `src/main/atomic-file.ts:8` — Comment says "Three attempts", but `RETRY_DELAYS_MS = [0, 10, 50, 100]` results in four attempts (attempt 0..3). The total worst-case value is correct, the description is misleading.  
  **Fix:** Correct the comment to "Four attempts" or adjust the array to match the comment.

- `src/main/usage/paths.ts:76-78` — `codexHomes` on Windows returns `path.join('', 'Codex')` when `LOCALAPPDATA`/`APPDATA` are set to empty strings. That is a relative path (`'Codex'`) in the current working directory. Although `resolveCodexHomes` filters via `fs.existsSync`, if a `Codex` folder actually exists in the working directory, it is incorrectly used as a log source.  
  **Fix:** Filter empty strings in `codexHomes` before `path.join` or check paths for absoluteness.

- `tools/puppet-studio/studio.ts:50-90` — `loadRig` can fail after `await app.init()` (e.g., texture loading fails). The newly created `Application` is then not destroyed, because `session` is only assigned at the very end. With frequent rig changes in the dev tool, PixiJS canvases/textures remain in memory.  
  **Fix:** Call `app.destroy(true)` after errors in `loadRig` (e.g., in a `finally` or dedicated `catch`).

## Test result

`npm test` (vitest run) run:

```
Test Files  46 passed (46)
Tests       466 passed | 6 skipped (472)
Duration    3.43s
```

All 46 test files and 466 tests are green. No new regressions.

Windows-specific coverage is present:
- `src/main/overlay-adapter.test.ts` checks Windows platform (`win32`), Auto-Hide inset, visible taskbar and `always-on-top` level.
- `src/main/usage/paths.test.ts` covers `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`, `CLAUDE_CONFIG_DIR` with semicolon separator and deduplication on Windows.
- `src/main/atomic-file.test.ts` covers Windows-typical `EPERM`/`EBUSY` rename errors.
- `src/main/mrr/secrets.test.ts` covers Windows DPAPI (`safeStorage`) for `setSecret`/`getSecret`/`deleteSecret`.
- `src/main/installer-config.test.ts` covers NSIS language configuration.

## Reviewed files

Main process / Windows:
- `src/main/main.ts`
- `src/main/overlay-adapter.ts` (+ Test)
- `src/main/tray.ts` (+ Test)
- `src/main/atomic-file.ts` (+ Test)
- `src/main/usage/paths.ts` (+ Test)
- `src/main/usage/tracker.ts` (+ Test)
- `src/main/usage/read-lines.ts` (+ Test)
- `src/main/usage/claude-parser.ts` (+ Test)
- `src/main/usage/codex-parser.ts` (+ Test)
- `src/main/mrr/secrets.ts` (+ Test)
- `src/main/mrr/mrr-engine.ts` (+ Test)
- `src/main/mrr/settings-window.ts` (+ Test)
- `src/main/mrr/settings-validate.ts` (+ Test)
- `src/main/mrr/settings-preload.ts`
- `src/main/mrr/https-allowlist.ts` (+ Test)
- `src/main/mrr/stripe.ts` (+ Test)
- `src/main/mrr/revenuecat.ts` (+ Test)
- `src/main/hardening.ts`
- `src/main/preload.ts` (+ Test)
- `src/main/ipc-channels.ts` (+ Test)
- `src/main/app-icon.ts` (+ Test)
- `src/main/onboarding.ts` (+ Test)
- `src/main/pause-state.ts` (+ Test)
- `src/main/installer-config.test.ts`
- `electron-builder.yml`

Renderer:
- `src/renderer/index.html`
- `src/renderer/renderer.ts`
- `src/renderer/sprites.ts` (+ Test)

Puppet Studio:
- `tools/puppet-studio/studio.ts`
- `tools/puppet-studio/puppet.ts`
- `tools/puppet-studio/bake.ts`
- `tools/puppet-studio/keyframes.ts` (+ Test)
- `tools/puppet-studio/rig.ts` (+ Test)
- `tools/puppet-studio/sheet.ts` (+ Test)
- `tools/puppet-studio/anims/parachute.ts`
- `tools/puppet-studio/anims/index.ts`

## Verdict

**PR-ready: no.**

The code is fundamentally solid, the test suite is green and the Windows port shows good platform coverage. However, the missing CSP in the pet overlay blocks the hardening P1 invariants from `CLAUDE.md`. Together with the missing concurrency guard in `MrrEngine.pollNow` (potential double XP award) there are two concrete correctness/security problems that must be fixed before merge. The minor findings should also be addressed, but are not a blocker.

Co-authored-by: rodgi040 <220582878+rodgi040@users.noreply.github.com>
