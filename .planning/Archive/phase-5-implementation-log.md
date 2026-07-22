# Beaver Buddy — Phase 5: Implementation Log

**Date:** 2026-07-15
**Implementation agent:** Kimi Code CLI
**Status:** BL-WIN-7 + Codex tracking implemented; BL-WIN-6 deferred (admin decision pending)

---

## 1. Summary

This log documents the implementation of the Phase 5 follow-ups per `.flightplan/Archive/phase-5-plan.md` and `.flightplan/Archive/phase-5-plan-review.md`.

| Item | Status | Note |
|------|--------|------|
| **BL-WIN-7** | ✅ Implemented | `atomicWriteFile` asynchronous with retry backoff; all callers and tests updated. |
| **Codex tracking** | ✅ Implemented | Windows candidate paths (`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`) with priority; defensive platform fallback. |
| **BL-WIN-6** | ⏸️ Deferred | No admin decision on the secret-store backend; approach documented, no code implemented. |
| **Plan corrections** | ✅ Implemented | Technical errors in `phase-5-plan.md` corrected (`cmdkey.exe`, `setTimeout` in a synchronous function, recommendations, tests, DoD). |

---

## 2. BL-WIN-7: Windows-native atomic writes

### 2.1 Decision

The recommended asynchronous approach with retry backoff was implemented. `atomicWriteFile` is now `async` and uses `fs.promises`.

### 2.2 Changed files

- `src/main/atomic-file.ts`
  - `export async function atomicWriteFile(...)`
  - Retry logic: 4 attempts with delays `[0, 10, 50, 100]` ms.
  - Retriable errors: `EPERM`, `EBUSY`.
  - Non-retriable errors: `EACCES` (and all others).
  - Temp file in the target directory (same-volume rename atomicity preserved).
  - Temp file cleanup in `finally`.

- `src/main/onboarding.ts`
  - `saveOnboardingState` is now `async`.

- `src/main/xp/store.ts`
  - `saveState` is now `async`.

- `src/main/mrr/settings-store.ts`
  - `saveSettingsState` is now `async`.

- `src/main/xp/engine.ts`
  - `ingestLifetimeTokens`, `injectXp`, `awardMrr`, `applyXp`, `applyState`, `attachTracker` are now `async`.
  - `attachTracker` now returns `Promise<() => void>` so the initial persistence operation can be awaited.
  - `TrackerLike.onChange` accepts callbacks returning `void | Promise<void>`.

- `src/main/mrr/mrr-engine.ts`
  - `await xpEngine.awardMrr(...)` in `pollNow`.

- `src/main/mrr/settings-window.ts`
  - `connect`/`disconnect` handlers await `saveSettingsState`.

- `src/main/main.ts`
  - `app.whenReady().then(async () => { ... })`.
  - `await saveOnboardingState(...)`, `await saveSettingsState(...)`, `await xpEngine.injectXp(...)`, `await xpEngine.attachTracker(...)`.
  - `onSelectGrowthMode` is now `async`.

- `src/main/tray.ts`
  - `TrayCallbacks.onSelectGrowthMode` now allows `void | Promise<void>`.

- `src/main/usage/tracker.ts`
  - `onChange`/`onTick` callback types allow `void | Promise<void>`.

- Tests updated:
  - `src/main/onboarding.test.ts`
  - `src/main/xp/store.test.ts`
  - `src/main/mrr/settings-store.test.ts`
  - `src/main/xp/engine.test.ts`
  - `src/main/mrr/mrr-engine.test.ts` (`FakeXp.awardMrr` async)
  - `src/main/usage/tracker.test.ts` (callback return values updated)
  - `src/main/tray.test.ts` (callback return value updated)
  - `src/main/atomic-file.test.ts` — **newly created**.

### 2.3 Test coverage `atomic-file.test.ts`

- Write + no tmp leftovers
- Creating nested directories
- Atomic overwrite
- Retry on `EPERM` and `EBUSY`
- No retry on `EACCES`
- Giving up after 4 attempts
- Temp cleanup on write error

---

## 3. Codex tracking: Windows log paths

### 3.1 Decision

Multiple candidate paths with a clear priority were implemented:

1. `CODEX_HOME` (override)
2. `%LOCALAPPDATA%\Codex`
3. `%APPDATA%\Codex`
4. `~/.codex` (legacy)

Only the first **existing** path is used.

### 3.2 Changed files

- `src/main/usage/paths.ts`
  - `PathEnv` extended with `LOCALAPPDATA` and `APPDATA`.
  - `normalizePlatform(process.platform)` with a defensive fallback to `linux` for unknown platforms (removes the unsafe `as Platform` cast).
  - `codexHomes()` generates candidate paths per platform.
  - `resolveCodexHome()` selects the first existing path.
  - `discoverPaths()` uses `resolveCodexHome`.

- `src/main/usage/paths.test.ts`
  - Tests added for Windows Codex paths:
    - `%LOCALAPPDATA%\Codex` preferred
    - Fallback to `%APPDATA%\Codex`
    - Fallback to `~/.codex`
    - `CODEX_HOME` has highest priority

---

## 4. BL-WIN-6: Windows secret store / MRR mode

### 4.1 Status

**Not implemented.** Admin decision on the secret-store backend is pending.

### 4.2 Blockers

- `CLAUDE.md` restricts new dependencies; Windows Credential Manager requires a native addon (`CredWriteW`/`CredReadW`/`CredDeleteW`), which requires an ADR and a security review.
- `electron.safeStorage` is simpler, but historically violates the rule "secrets never in app-support dir" and likewise requires a conscious scope decision.
- `cmdkey.exe` cannot read generic credentials and is not an option.
- `keychain.ts` is function-based; a refactor to interface + factory + platform-specific implementations would change all callers (`mrr-engine.ts`, `settings-window.ts`, `main.ts`).

### 4.3 Planned approach (documented, not implemented)

1. Refactor `src/main/mrr/keychain.ts` into an interface + factory:
   - `src/main/mrr/keychain.ts`: `KeychainAdapter` interface + factory + `isValidKeychainService`.
   - `src/main/mrr/keychain-darwin.ts`: existing `security` CLI logic.
   - `src/main/mrr/keychain-win32.ts`: Windows implementation per the admin decision.
2. Migrate callers to DI/factory.
3. The Windows implementation must use `logRedacted` from `src/main/mrr/redact.ts`.
4. The `--keychain-service` QA flag remains; `isValidKeychainService` continues to serve as injection protection.
5. Enable MRR mode on Windows only after a full write/read/delete cycle has been tested.

### 4.4 Recommendation

Under the current `CLAUDE.md` restrictions, **Option B (`electron.safeStorage` + encrypted JSON in `userData`)** is the realistic default solution. Option A (Windows Credential Manager with a native addon) only with an explicit admin decision.

---

## 5. Plan corrections

`.flightplan/Archive/phase-5-plan.md` was updated with the review findings:

- BL-WIN-6 Option A: `cmdkey.exe` marked as unsuitable; PowerShell module only for POCs; native addon with ADR note.
- BL-WIN-6 Option B: `electron.safeStorage` usable only after `app.whenReady()`; lazy loading documented.
- BL-WIN-6: current function-based architecture and refactor effort documented.
- BL-WIN-6: `--keychain-service` code references added.
- BL-WIN-6: clear recommendation (Option B as default).
- BL-WIN-7 Option A: asynchronous retry backoff instead of `setTimeout` in a synchronous function.
- BL-WIN-7: error classification `EPERM`/`EBUSY` retriable, `EACCES` not.
- BL-WIN-7 Option D: temp file stays in the target directory.
- BL-WIN-7: research timebox (4h) and abort criteria.
- Codex tracking: defensive platform fallback; risk of unstable Windows support; clear path prioritization.
- Tests: `atomic-file.test.ts`, `keychain.test.ts`, `paths.test.ts` mentioned.
- Security: `logRedacted` note.
- Master icon / design pass excluded as a visual follow-up.
- Definition of Done added for the planning phase.

---

## 6. Commands run and results

```bash
npm run typecheck  # ✅ green
npm run lint       # ✅ green
npm test           # ✅ 37 test files, 341 passed, 6 skipped
npm run build      # ✅ green
```

No more unhandled rejections after the `TrackerLike`/`attachTracker` fix.

---

## 7. Open items / risks

- **BL-WIN-6** remains blocked until the admin decision.
- **BL-WIN-7** is a heuristic; very slow/long Windows locks can still fail.
- **Codex tracking** on Windows is based on candidate paths, not on empirically verified official Codex paths. A test installation on Windows would be desirable.
- Converting `atomicWriteFile` to `async` triggered a far-reaching API change (`XpEngine`, `attachTracker`, `save*` functions). This change is correct, but it must be kept in mind for future extensions.

---

## 8. Next steps

1. Obtain the admin decision for BL-WIN-6.
2. After admin go: refactor `keychain.ts` to interface + factory + platform-specific implementations.
3. Optional: perform a Windows test installation to empirically verify the Codex paths.
4. No commits made — changes are local.
