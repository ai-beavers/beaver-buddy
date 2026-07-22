# Area 1 — Connect Usage Log Paths on Windows

Analysis: `src/main/usage/{tracker,paths,codex-parser,claude-parser,totals,read-lines,config}.ts` + tests,
merge state `d7acaf0` (upstream/main → bl-item/windows-native/BL-WIN). Read-only, no code changes.

## 1. Verdict: GAP FOUND (conditional) — standard case at parity

Windows path discovery **exists** and is cleanly implemented (no hardcoded macOS paths,
`os.homedir()`/`path.join`/env injection throughout, CI matrix actually runs on `windows-latest`).
Claude Code logs (`%USERPROFILE%\.claude`) are reliably found on Windows.
Codex logs (`%USERPROFILE%\.codex`) are found — **except** when `%LOCALAPPDATA%\Codex` or
`%APPDATA%\Codex` exists (e.g. due to the Codex Desktop App): then a
first-existing-wins precedence favors the wrong, session-less directory.

## 2. Findings

### B1 — [gap, conditional] Codex: first-existing-wins masks the real `~/.codex` path

- `src/main/usage/paths.ts:154-156` — `resolveCodexHome` returns `codexHomes(...).find(fs.existsSync)`: **exactly one** candidate wins.
- `src/main/usage/paths.ts:141-149` — order on win32: `%LOCALAPPDATA%\Codex` → `%APPDATA%\Codex` → `~/.codex`.
- `src/main/usage/paths.test.ts:144-153` — a test pins exactly this first-wins behavior as the specification ("prefers %LOCALAPPDATA%\Codex over ~/.codex when both exist").

The documented Codex CLI path on Windows is `%USERPROFILE%\.codex` (CODEX_HOME default;
per openai/codex issues, the Codex Desktop App and CLI share the same `~/.codex` tree).
`%LOCALAPPDATA%\Codex` is **not** a known Codex CLI sessions path; `%APPDATA%\Codex` is the
Electron userData folder of the Codex **Desktop App** (Roaming convention) — so it exists as soon as
the Desktop App is installed, but contains no `sessions/` rollouts. Consequence: for users with
Codex Desktop App + CLI, Beaver Buddy permanently reports "no Codex logs found" on Windows,
even though `~/.codex/sessions` is full. The Connect feature (Codex half) is non-functional
for this user group. The problem does not exist on macOS (only `~/.codex` is checked there, paths.ts:151).

**Fix proposal (no new dependencies):** replace `resolveCodexHome` with a union — return all
existing candidates, run `findCodexFiles` over each, and dedupe globally by
relative path (priority: candidate order, within it `sessions/` before `archived_sessions/`;
the mechanics already exist in `findCodexFiles`, paths.ts:98-133). Alternatively, minimal-invasive:
move `~/.codex` to the first position of the win32 candidates. Add a test: "an empty/existing
`%APPDATA%\Codex` must not mask `~/.codex` sessions". Sharpens Flight-Plan item #24.

### B2 — [risk] WSL installations of Claude Code / Codex are not found

- `src/main/usage/paths.ts:52-56, 141-151` — all candidates live in the native Windows profile.

On Windows, Claude Code and Codex CLI frequently run **in WSL** (historically the only way, still
widespread); their logs land in the Linux home of the distro (`\\wsl$\<distro>\home\<user>\.claude|\.codex`)
and are invisible to a native Windows process. There is no equivalent on macOS → a pure
Windows gap in the user base. Standard Windows users with a native installation are **not** affected.

**Fix proposal:** first document it as a known limitation (README/Connect hint text). Optionally
later: enumerating installed distros via `HKCU\Software\Microsoft\Windows\CurrentVersion\Lxss`
is not cleanly achievable without new npm dependencies (registry access) — so rather: a documented
workaround via `CLAUDE_CONFIG_DIR`/`CODEX_HOME` pointing to the `\\wsl$` path (both overrides already
exist, paths.ts:42-50, 136-139). Evaluate as a Flight-Plan item, don't build it prematurely.

### B3 — [risk, small] Claude on win32 ignores XDG layout entirely

- `src/main/usage/paths.ts:54-56` — the win32 branch returns exclusively `~/.claude`; the Unix branch
  (paths.ts:61-62) instead uses `~/.config/claude` **and** `~/.claude` as a union.

Claude Code on Windows writes `%USERPROFILE%\.claude` by default — the main case is covered.
Users with a Unix-like setup (Git-Bash/msys profiles, manually migrated `~/.config/claude`) are
not found on Windows, but are found on macOS/Linux. Asymmetry without an apparent reason.

**Fix proposal:** treat the win32 branch like Unix as a union `[xdg, legacy].filter(existsSync)`
(one line); the existing test `paths.test.ts:76-81` ("returns empty array when only XDG exists on
win32") would then have to be deliberately flipped.

### Notes (no Flight-Plan items)

- Junction/symlink project folders are skipped (`Dirent.isDirectory()` is `false` for links,
  paths.ts:73, 82) — identical across platforms, so not a parity finding; on Windows only
  relevant for manually linked `.claude\projects` folders.
- CRLF: `readBoundedLines` splits on `0x0A` (read-lines.ts:39), lines keep their `\r`; `JSON.parse`
  tolerates trailing whitespace, `second()` works on the parsed timestamp — functionally safe,
  but there is **no** CRLF test (read-lines.test.ts has no `\r` case). Optionally add one.
- `CLAUDE_CONFIG_DIR` splitting on `/[,;]/` now applies cross-platform (paths.ts:47) — on macOS
  a path with a literal `;` would break; practically irrelevant, but a silent behavior change
  versus upstream (which only splits on `,`).
- Third-party finding (Connect-UI area): `src/main/mrr/settings.html:63` says "on this Mac" — already
  recorded as [minor] in the merge verification report, noted here only for completeness.

## 3. Verified OK

- **Platform branches present:** win32 branches in `claudeConfigDirs` (paths.ts:54-56) and
  `codexHomes` (paths.ts:141-149); `normalizePlatform(process.platform)` (paths.ts:34-39, 161);
  `UsageTracker` passes env/home through and uses the runtime default (tracker.ts:65, 134;
  paths.ts:158-162; instantiation without args in main.ts:352).
- **No hardcoded paths:** consistently `os.homedir()` + `path.join` (paths.ts:52, 61, 147, 151,
  160). `os.homedir()` correctly resolves `%USERPROFILE%` on Windows. A grep over `src/` shows no
  literal `~/.claude`-/`~/.codex` strings outside comments/tests.
- **Opt-in gating intact after merge:** discovery (directory listing only) always, parser only after
  `setEnabledSources` (tracker.ts:93-97, 162-167; header comment :11-13); `connected` =
  `enabled && logsFound` (:79, :86); disabling evicts the cache (:169-177). Matches
  merge verification point F.
- **Tests mock neither homedir nor paths:** real temp trees via `fs.mkdtempSync(os.tmpdir())`,
  home/env/platform are injected (paths.test.ts:13-19, tracker.test.ts:10-17). The Windows spy test
  proves that no `.jsonl` is opened before opt-in (tracker.test.ts:118-133).
- **CI actually covers Windows:** matrix `ubuntu-latest` + `windows-latest`, incl. `npm test`
  (ci.yml:21, 43) — the win32 simulation tests additionally run there with real Win32 paths.
- **win32 tests present:** Claude win32 4 cases (paths.test.ts:66-104, incl. `;` separator),
  Codex win32 4 cases (paths.test.ts:143-181, incl. CODEX_HOME precedence :172-181).
- **Codex layout platform-independently correct:** `sessions/YYYY/MM/DD/rollout-*.jsonl` +
  `archived_sessions/` with sessions-wins dedup (paths.ts:98-133); replay elision/dedup in the parser
  (codex-parser.ts:101-177) without any path dependency.
- **Bounded reads / defensive parsing platform-independent** (read-lines.ts:16-106,
  claude-parser.ts:32-66): no Windows special case needed, no error path for missing files.
- **Clean merge:** `git diff upstream/main HEAD -- src/main/usage/` contains exclusively our
  Windows extensions + async listener hardening (tracker.ts:100-114, 207-218); no
  upstream behavior was lost.

## 4. Proposed Flight-Plan Items

- **Unify Codex homes on Windows instead of first-wins (sharpens #24):** the Desktop App's `%APPDATA%\Codex` must no longer mask `~/.codex` sessions — union of all existing candidates + relative-path dedup, add a regression test.
- **Evaluate/document WSL usage logs:** WSL-based Claude/Codex installations are not found; for now, document it + the override workaround (`CLAUDE_CONFIG_DIR`/`CODEX_HOME` pointing at the distro's `\\wsl$` path).
- **Also check the Claude XDG candidate on Windows as a fallback:** switch the win32 branch from exclusive to union (one line), deliberately flip the affected test.
