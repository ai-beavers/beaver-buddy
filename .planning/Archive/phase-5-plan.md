# Beaver Buddy — Phase 5: Deferred / Follow-up Plan

**Status:** Partially implemented — BL-WIN-7 and Codex tracking were implemented; BL-WIN-6 remains deferred pending the admin decision. No commits.  
**Goal:** Prepare the three deferred build items from the Windows port (BL-WIN-6, BL-WIN-7, Codex tracking) as far as possible, document blockers, and define next steps.  
**Basis:** [Main plan `.flightplan/Archive/WINDOWS_PORT_PLAN.md`](./WINDOWS_PORT_PLAN.md), as of 2026-07-15.

---

## 1. Phase summary

Phase 5 covers the items that were deliberately deferred in Phases 1–4 because they require either a decision by the project administrator or external research. The app is already fully functional on Windows (overlay, tray, animations, Claude Code token tracking). Phase 5 closes the remaining gaps:

| Item | Topic | Blocker |
|------|-------|---------|
| **BL-WIN-6** | Windows secret store / MRR mode | Project administrator decision on the secret-store backend |
| **BL-WIN-7** | Windows-native atomic writes | Research into a more robust Windows-native pattern |
| **Codex tracking** | Windows log paths for Codex | Unclear official Codex Windows log path |

This phase can only be implemented once the external clarifications are available. Until then, this plan serves as the central documentation for status, options, and next steps.

---

## 2. BL-WIN-6: Windows secret store / MRR mode

### 2.1 Current status and blocker

- **Status:** Deferred, open.
- **Rationale:** The choice of a Windows secret-store backend (Windows Credential Manager, `electron.safeStorage`, Win32 API) must be coordinated with the project administrator.
- **Code state:** `src/main/mrr/keychain.ts` uses only the macOS `security` CLI (`add-generic-password`, `find-generic-password`, `delete-generic-password`). There is no platform-dependent abstraction.
- **Impact:** MRR mode (Stripe/RevenueCat) is not available on Windows for now. The app continues to run fully without credentials (overlay, tray, animations, token tracking).

### 2.2 Current code architecture

- `src/main/mrr/keychain.ts` is **function-based**, not interface-based. It exports:
  - `setKeychainSecret`, `getKeychainSecret`, `deleteKeychainSecret`
  - `isValidKeychainService`
- There is **no interface, no factory, and no injection**. Before the Windows implementation, `keychain.ts` must be refactored into a platform-independent interface + factory + two implementations (`keychain-darwin.ts`, `keychain-win32.ts`).
- All callers (`src/main/mrr/mrr-config.ts`, `src/main/mrr/mrr-engine.ts`, `src/main/mrr/settings-window.ts`, `src/main/main.ts:91-99`) must then work through the factory or dependency injection.
- `--keychain-service` is parsed in `src/main/main.ts:91-99` and defined as `DEFAULT_KEYCHAIN_SERVICE = 'beaver-buddy'` in `src/main/mrr/mrr-config.ts:19`. `isValidKeychainService` from `src/main/mrr/keychain.ts:27` must continue to be used on Windows to prevent injection into service names.
- A Windows implementation (`keychain-win32.ts`) must reuse `logRedacted` from `src/main/mrr/redact.ts` so that secrets never end up in the log.

### 2.3 Research/decision questions

1. Which secret-store backend matches the project's security and dependency policies (in particular `CLAUDE.md`)?
2. Is using `electron.safeStorage` + encrypted JSON in the `userData` directory acceptable, or does it violate the rule "secrets never in app-support dir"?
3. Should Windows Credential Manager be used as the primary store, even if this may require external CLI dependencies or a small native addon?
4. Should an adapter pattern be introduced (`keychain.ts` as interface/factory, `keychain-darwin.ts`, `keychain-win32.ts`)?
5. Which test strategy is acceptable? (Mocking the external APIs, integration tests on Windows CI, manual QA?)
6. Does the `--keychain-service` QA flag remain, and how is it mapped on Windows?

### 2.3 Possible approaches

#### Option A: Windows Credential Manager (primary candidate for review)

**Implementation:**
- Introduce an adapter pattern: `src/main/mrr/keychain.ts` as interface + factory, `src/main/mrr/keychain-darwin.ts` with the existing `security` CLI logic, `src/main/mrr/keychain-win32.ts` with Windows Credential Manager access.
- Windows access either via:
  - **Small native addon** via `node-gyp` with the Win32 Credential API (`CredWriteW`, `CredReadW`, `CredDeleteW`).
    This is the only serious option for generic credentials; however, it requires an administrator decision and an ADR for the new native dependency (conflict with `CLAUDE.md`).
  - PowerShell `CredentialManager` module — **only for local POCs**, not for shipping, since it is not installed by default.
  - `cmdkey.exe` — **not suitable** for generic credentials; it only manages network/Remote Desktop credentials.

**Advantages:**
- A true system-native secret store.
- Secrets are kept outside the app data directory.
- Matches the original design philosophy of `CLAUDE.md` (no secrets in JSON in app support).

**Disadvantages:**
- Only reachable via a native addon or non-standard PowerShell modules; `cmdkey.exe` cannot read generic credentials.
- A native addon introduces build complexity and potential dependency problems (violates `CLAUDE.md` restrictions unless explicitly justified).
- Requires an administrator decision, license/security review, and an ADR for the new native dependency.

#### Option B: `electron.safeStorage` + encrypted JSON in `userData`

**Implementation:**
- Adapter pattern as in Option A, but `keychain-win32.ts` uses `electron.safeStorage.encryptString` / `decryptString`.
- Secrets are stored in an encrypted JSON file in the `userData` directory (e.g. `state/secrets.enc.json`).
- `electron.safeStorage` is only usable after `app.whenReady()`; MRR credentials must be loaded lazily (e.g. only on the first `pollNow()` / settings window open), not at app start before window creation.

**Advantages:**
- No new external dependency.
- Easy to implement and test.
- Uses Windows DPAPI via Electron.

**Disadvantages:**
- Historically violates `CLAUDE.md` ("secrets never in app-support dir").
- Requires an ADR update or a conscious scope decision by the administrator.
- Secrets physically reside in the app data directory (encrypted, but contrary to the original architecture).

**Recommendation BL-WIN-6:** Under the current `CLAUDE.md` restrictions (no new dependencies without an ADR), **Option B (`electron.safeStorage` + encrypted JSON in `userData`) is the realistic default solution**. Option A (Windows Credential Manager) is only feasible with an explicit administrator decision including a native-addon ADR and security review.

#### Option C: `keytar`-like dependency

**Implementation:**
- Integrate an established library such as `@napi-rs/keyring` or similar.

**Advantages:**
- Ready-made cross-platform API.

**Disadvantages:**
- `CLAUDE.md` makes new dependencies difficult; native bindings increase build complexity.
- License and security review required.
- **Recommendation:** Avoid, as long as Option A or B is feasible.

### 2.4 Next concrete steps

1. **Schedule a meeting with the project administrator** to decide on the secret-store strategy.
2. **Prepare a decision document** with Options A–C, risks, and a clear recommendation (Option A primary, Option B as documented fallback).
3. **After the decision:**
   - Introduce the adapter pattern in `src/main/mrr/keychain.ts`.
   - Extract `keychain-darwin.ts` from the existing code.
   - Implement `keychain-win32.ts` according to the chosen option.
   - Adjust/extend tests (`keychain.test.ts` or a new `keychain-win32.test.ts`).
   - Document the `--keychain-service` QA flag for Windows behavior.
   - Enable MRR mode on Windows once secrets can be stored robustly.

### 2.5 Acceptance criteria (once implemented)

- `src/main/mrr/keychain.ts` defines a clear, platform-independent interface.
- macOS behavior remains unchanged (`security` CLI).
- The Windows implementation stores, reads, and deletes secrets robustly.
- The `--keychain-service` QA flag continues to work.
- All tests green (`npm run typecheck`, `npm run lint`, `npm test`).
- `npm run build` and `npx electron-builder --win --publish never` are green.
- MRR mode is enabled and documented on Windows.

---

## 3. BL-WIN-7: Windows-native atomic writes

### 3.1 Current status and blocker

- **Status:** Research phase / deferred.
- **Rationale:** A simple retry logic is known, but it should be checked whether a more robust, more Windows-native solution exists.
- **Code state:** `src/main/atomic-file.ts` implements atomic writes via a temporary file + `fs.renameSync(tmpPath, filePath)`. This works atomically on POSIX systems; on Windows, however, `renameSync` can fail on transient locks (`EPERM`), e.g. when a virus scanner or indexer briefly blocks the temporary file.
- **Impact:** State files are usually written correctly, but the risk of a transient write failure remains.

### 3.2 Research/decision questions

1. Is a simple retry logic with a short backoff robust enough for the project?
2. Is there a Windows-native way to reliably avoid `EPERM` cases on `rename`?
3. Should a native addon (`MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`) be considered?
4. Are transactional NTFS operations (`CreateTransaction`, `MoveFileTransactedW`) sensible, or over-engineering?
5. Are there established Node libraries that solve this problem without forcing new dependencies?
6. Which errors must be caught (only `EPERM`, also `EACCES`, `EBUSY`)?

### 3.3 Possible approaches

#### Option A: Asynchronous retry logic with backoff

**Implementation:**
- `atomicWriteFile` becomes asynchronous (`async function`) and uses `fs.promises.writeFile` + `fs.promises.rename` + `setTimeout` backoff.
- `fs.rename` is retried up to 4 times (immediately, 10 ms, 50 ms, 100 ms).
- Error classification: `EPERM` and `EBUSY` are transiently retriable; `EACCES` is a permanent permission problem and is not retried.
- The temporary file stays in the target directory (`${filePath}.tmp-...`) so that `rename` remains atomic on the same volume.

**Advantages:**
- Minimal code change.
- No new dependencies.
- Solves most transient lock problems.

**Disadvantages:**
- Not deterministic; very long blocks can still fail.
- No real guarantee of atomic behavior on Windows.
- Harder to test (timing-dependent).
- Requires adjusting all synchronous callers (`saveOnboardingState`, `saveState`, `saveSettingsState`) and their tests.

#### Option B: `MoveFileExW` via native addon or NAPI

**Implementation:**
- Small native addon that calls `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`.
- Optionally with `MOVEFILE_WRITE_THROUGH` for a synchronous commit.

**Advantages:**
- Windows-native API, often more robust against lock conflicts.
- Explicit overwrite of the target file is possible.

**Disadvantages:**
- Introduces native code/build complexity.
- Possible conflict with `CLAUDE.md` restrictions against new dependencies.
- Harder to test on non-Windows systems.

#### Option C: Transactional NTFS operations

**Implementation:**
- Use `CreateTransaction`, `MoveFileTransactedW`, `CommitTransaction` via a native addon.

**Advantages:**
- Strictest consistency guarantee.

**Disadvantages:**
- Heavily over-engineered for a single state file.
- Transactional NTFS APIs are outdated/deprecated and not recommended.
- High complexity, low benefit.
- **Recommendation:** Do not pursue.

#### Option D: Combination of retry + robust error handling

**Implementation:**
- Asynchronous retry logic as in Option A, plus:
  - Explicit check for `EPERM`/`EBUSY` (retriable) vs. `EACCES` (not retriable).
  - Temporary file stays in the target directory (same-volume rename is the crucial atomicity guarantee).
  - On repeated failure: clean up and produce a meaningful error message.

**Advantages:**
- Pragmatic and easy to test.
- No new dependencies.
- Better diagnostic options.

**Disadvantages:**
- Remains a heuristic, not a 100% guarantee.

### 3.4 Research abort criteria

- **Timebox:** maximum 4 hours of research.
- **Abort criterion:** If no empirical evidence is found within the timebox that a Windows-native approach (Option B) is significantly more reliable than retry backoff, **Option A/D** is chosen as the default.
- **Fallback:** Option A/D is implementable at any time and requires no new dependencies.

### 3.5 Next concrete steps

1. **Do the research:**
   - Gather experience from the Node ecosystem (e.g. how `electron-store`, `conf`, `write-file-atomic` solve the problem).
   - Review the Windows API documentation for `MoveFileExW` and `ReplaceFile`.
2. **Decide** whether Option A/D or B is pursued.
3. **Create a proof of concept** for the chosen solution.
4. **Extend tests:**
   - Unit tests for the retry logic with a mocked `fs`.
   - Possibly a Windows CI integration test for atomic writes.
5. **Update documentation** in `CLAUDE.md` or an ADR if the approach deviates from the original POSIX assumption.
6. **Implement in `src/main/atomic-file.ts`** and run regression tests.

### 3.6 Acceptance criteria (once implemented)

- `atomicWriteFile` writes state files reliably on Windows, even under transient lock conditions.
- Writes remain atomic: readers never see a partial file.
- All existing tests stay green.
- The solution is documented (Why was this option chosen? Which errors are caught?).
- `npm run build` and `npx electron-builder --win --publish never` stay green.

---

## 4. Codex tracking: research and add Windows log paths

### 4.1 Current status and blocker

- **Status:** Deferred, open.
- **Rationale:** The official Windows log path of the Codex CLI is not clearly documented; Windows support of the Codex CLI itself may be experimental or version-dependent.
- **Code state:** `src/main/usage/paths.ts` uses `path.join(home, '.codex')` for Codex by default (or the `CODEX_HOME` override). This path works on macOS/Linux; on Windows it is unclear whether Codex actually uses `%USERPROFILE%\.codex` or another location (e.g. `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, etc.). The current cast `process.platform as Platform` in `src/main/usage/paths.ts:129` is latently incorrect for unknown platforms (e.g. `freebsd`).
- **Impact:** Token-burn tracking on Windows currently only covers Claude Code. Codex logs continue to be processed only on macOS/Linux via `~/.codex`.

### 4.2 Research/decision questions

1. Which path does Codex use on Windows for its log files?
2. Does Codex use `%USERPROFILE%\.codex`, `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, or another location?
3. Is there official documentation or issue discussions about Codex Windows paths?
4. Does the behavior differ between Codex CLI versions?
5. Should `CODEX_HOME` as an override continue to have the highest priority?
6. Should more than one path be checked on Windows (e.g. legacy + modern AppData path)?

### 4.3 Possible approaches

#### Option A: Research + test installation

**Implementation:**
- Install and run the Codex CLI on a Windows machine.
- Observe which directories are created.
- Check the official documentation, README, and GitHub issues.

**Advantages:**
- Empirically verified knowledge.
- Avoids wrong assumptions.

**Disadvantages:**
- Requires access to a Windows test environment.
- Time-consuming.

#### Option B: Check multiple candidate paths

**Implementation:**
- In `discoverPaths`, check multiple potential Codex home directories for `win32` in this priority:
  1. `env.CODEX_HOME` (override)
  2. `path.join(env.LOCALAPPDATA || '', 'Codex')` (most modern Windows AppData path)
  3. `path.join(env.APPDATA || '', 'Codex')`
  4. `path.join(home, '.codex')` (legacy / WSL-like environments)
- First existing path wins.
- Unknown `process.platform` values are defensively mapped to `linux` behavior instead of blindly casting `as Platform`.

**Advantages:**
- Robust against different Codex versions.
- Quick to implement.

**Disadvantages:**
- Could accidentally read wrong/outdated directories.
- Requires careful prioritization and tests.

#### Option C: Keep the `CODEX_HOME` override + documentation

**Implementation:**
- For now, only check `~/.codex` (current behavior).
- Keep the `CODEX_HOME` override as an escape hatch for Windows users.
- Add documentation on how Windows users can manually enable Codex tracking.

**Advantages:**
- No code risk.
- Immediately implementable.

**Disadvantages:**
- No out-of-the-box Codex support on Windows.
- Worse user experience.

### 4.4 Next concrete steps

1. **Research:**
   - Search the official Codex documentation and repository for Windows paths.
   - Search GitHub issues/discussions for Codex + Windows.
2. **Test installation:**
   - Install and run the Codex CLI on Windows.
   - Record which paths are created.
3. **Decide** which paths should be checked on Windows.
4. **Code changes in `src/main/usage/paths.ts`:**
   - Introduce platform-specific Codex logic similar to `claudeConfigDirs`.
   - `CODEX_HOME` remains the highest-priority override.
5. **Extend tests** in `src/main/usage/paths.test.ts` for Windows Codex scenarios.
6. **Update documentation** (`README.md`, `CLAUDE.md`) if an additional Windows path is added.

### 4.5 Acceptance criteria (once implemented)

- `discoverPaths` automatically finds Codex log files on Windows at the correct, documented location.
- `CODEX_HOME` remains the highest-priority override on all platforms.
- Path resolution is platform-specific and testable.
- All tests green (`npm run typecheck`, `npm run lint`, `npm test`).
- `npm run build` stays green.

---

## 5. Cross-cutting notes

### 5.1 Test files to update

- `src/main/atomic-file.test.ts` — **create new** (there is currently no dedicated test file).
- `src/main/mrr/keychain.test.ts` — must be completely rebuilt in an adapter refactor.
- `src/main/usage/paths.test.ts` — must be extended with Windows Codex scenarios.

### 5.2 Security: reuse `logRedacted`

A future `keychain-win32.ts` must use `logRedacted` from `src/main/mrr/redact.ts` so that secrets never end up in the log — analogous to the current macOS implementation.

### 5.3 Final master icon / design pass

The **final master icon / design pass** from `WINDOWS_PORT_PLAN.md:511-513` is not a technical build item but a visual follow-up. It is not implemented in Phase 5 and is deferred as a separate design pass.

---

## 6. Dependencies on external decisions/research

| Item | External blocker | Who clarifies? | Next step |
|------|------------------|-----------|------------------|
| **BL-WIN-6** | Choice of the Windows secret-store backend | Project administrator | Schedule a meeting, present the decision document |
| **BL-WIN-7** | Research into a Windows-native atomic write pattern | Development team | Do the research, create a POC, document the decision |
| **Codex tracking** | Official Windows log path of the Codex CLI | Development team + possibly the Codex community | Test installation and documentation search |

**Important:** Without these external clarifications, Phase 5 cannot be fully completed. This plan should be maintained as a living document as new findings become available.

---

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|--------|------------|------------|
| **BL-WIN-6:** Administrator decision is delayed | MRR mode stays disabled on Windows for longer | Keep the app fully functional without credentials; clear communication in the UI/docs |
| **BL-WIN-6:** Chosen backend violates `CLAUDE.md` | Review blocker, possible rework | Plan an ADR/scope update in advance; document options with pros and cons transparently |
| **BL-WIN-7:** Research finds no significantly better pattern than retry | Time lost, no improvement | Keep Option A/D immediately implementable as a fallback; define clear abort criteria for the research |
| **BL-WIN-7:** Native addon increases build complexity | CI problems, portability risks | Only use if it is empirically proven that retry is insufficient |
| **Codex tracking:** Codex Windows support itself is experimental; the path can change between versions | Tracking does not work for all users | Check multiple candidate paths, document the `CODEX_HOME` override prominently |
| **General:** Phase 5 is not prioritized | Technical debt remains | Regular team review of the plan; clear definition of done for each item |

---

## 8. Recommended order

1. **Codex tracking research** (lowest external blocker, fastest value for Windows users).
2. **BL-WIN-7 research + POC** (can run in parallel; the fallback implementation is trivial).
3. **BL-WIN-6 administrator meeting** (biggest decision blocker; implementation only possible afterwards).

---

## 9. Notes on the approach

- **No source changes** in this planning phase — only this document is created.
- **No commits** — the plan is stored locally in `.flightplan/Archive/phase-5-plan.md`.
- Once the external clarifications are available, the individual items should be split into their own build items/branches and implemented with the usual test and review process.

### 9.1 Definition of Done for this planning phase

- [ ] Technical errors in the plan corrected (BL-WIN-6 Option A, BL-WIN-7 Option A).
- [ ] BL-WIN-6: decision document with a clear recommendation (Option B as default) available.
- [ ] BL-WIN-7: research timebox and abort criteria defined.
- [ ] Codex tracking: candidate paths prioritized; defensive platform fallback documented.
- [ ] Cross-cutting test and security notes added.
- [ ] Open items, blockers, and next steps are communicated.
