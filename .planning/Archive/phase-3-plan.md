# Beaver Buddy — Phase 3: Windows Integrations (BL-WIN-5)

**Status:** Planning document — not yet implemented.  
**Goal:** Correctly resolve Claude Code usage log paths on Windows without breaking existing macOS/Linux behavior.  
**Scope:** exclusively build item **BL-WIN-5** (make Claude usage log paths Windows-compatible). Codex tracking remains outside the Windows scope for now.

---

## 1. Phase Summary

Phase 3 is the smallest phase of the Windows port. It consists only of build item **BL-WIN-5** and focuses on path resolution for Claude Code usage logs in `src/main/usage/paths.ts`.

The current implementation checks two possible Claude Code configuration directories:

1. **XDG path:** `~/.config/claude`
2. **Legacy path:** `~/.claude`

On Windows, the XDG path does not exist in documented form. The legacy path `~/.claude` is, however, used by Claude Code on Windows and resides at `%USERPROFILE%\.claude`. Node.js automatically resolves `os.homedir()` to `%USERPROFILE%` on Windows, so `path.join(home, '.claude')` already works correctly.

**Core change:** On Windows (`process.platform === 'win32'`), only the legacy path `~/.claude` is checked. On macOS and Linux, the previous behavior (XDG + legacy) is preserved. `CLAUDE_CONFIG_DIR` remains the highest-priority override on all platforms.

Codex log paths are not enabled on Windows in this phase, since the official Windows path of the Codex CLI has not yet been clarified (see "Risks").

---

## 2. Concrete Steps for BL-WIN-5

### 2.1 File Changes

| File | Type of change | Rationale |
|------|----------------|-----------|
| `src/main/usage/paths.ts` | Functional adjustment | Platform-specific selection of the Claude Code config directories. |
| `src/main/usage/paths.test.ts` | Test adjustment + addition | Keep platform-neutral tests, add platform-specific tests for Windows and Unix. |

### 2.2 Planned Code Change in `src/main/usage/paths.ts`

The function `claudeConfigDirs(env, home)` is to be extended with a platform distinction.

#### Variant A: Use `process.platform` directly (simple, but harder to test)

```ts
import os from 'node:os';

function claudeConfigDirs(env: PathEnv, home: string): string[] {
  const configured = env.CLAUDE_CONFIG_DIR;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  const legacy = path.join(home, '.claude');

  if (os.platform() === 'win32') {
    return [legacy].filter((d) => fs.existsSync(d));
  }

  const xdg = path.join(home, '.config', 'claude');
  return [xdg, legacy].filter((d) => fs.existsSync(d));
}
```

#### Variant B: Inject the platform as a parameter (preferred, testable)

Since `paths.ts` already accepts `env` and `home` as parameters to make tests independent of the real system, the platform should also be injectable.

```ts
export interface PathEnv {
  readonly CLAUDE_CONFIG_DIR?: string;
  readonly CODEX_HOME?: string;
}

export type Platform = 'win32' | 'darwin' | 'linux' | string;

function claudeConfigDirs(env: PathEnv, home: string, platform: Platform): string[] {
  const configured = env.CLAUDE_CONFIG_DIR;
  if (configured && configured.trim().length > 0) {
    return configured
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
  }

  const legacy = path.join(home, '.claude');

  if (platform === 'win32') {
    return [legacy].filter((d) => fs.existsSync(d));
  }

  const xdg = path.join(home, '.config', 'claude');
  return [xdg, legacy].filter((d) => fs.existsSync(d));
}

export function discoverPaths(
  env: PathEnv = process.env,
  home: string = os.homedir(),
  platform: Platform = process.platform,
): DiscoveredPaths {
  const claudeFiles = claudeConfigDirs(env, home, platform).flatMap(findClaudeFiles);
  // ... rest unchanged
}
```

**Recommendation:** Use Variant B, since it is consistent with the existing test strategy (no `process.platform` mock needed) and requires no additional dependencies.

### 2.3 Planned Test Changes in `src/main/usage/paths.test.ts`

#### a) Adjust existing tests

The test "prefers XDG (~/.config/claude) and legacy (~/.claude) together when both exist" must explicitly run on non-Windows platforms or be reformulated for Windows.

**Option 1:** The test receives a third parameter `platform` and runs only for `darwin`/`linux`.

```ts
it('prefers XDG and legacy together when both exist on non-Windows', () => {
  touch(path.join(home, '.config', 'claude', 'projects', 'project-b', 'session-2.jsonl'));
  touch(path.join(home, '.claude', 'projects', 'project-a', 'session-1.jsonl'));

  const { claudeFiles } = discoverPaths({}, home, 'darwin');
  expect(claudeFiles).toHaveLength(2);
});
```

**Option 2:** The test stays platform-neutral by only checking `legacy` when `xdg` does not exist. This is less precise but simpler.

**Recommendation:** Choose Option 1, since it documents the actual behavior.

#### b) Add new platform-specific tests

```ts
describe('discoverPaths — Claude on Windows', () => {
  it('ignores XDG path and uses legacy ~/.claude on win32', () => {
    touch(path.join(home, '.config', 'claude', 'projects', 'project-x', 'session-x.jsonl'));
    touch(path.join(home, '.claude', 'projects', 'project-y', 'session-y.jsonl'));

    const { claudeFiles } = discoverPaths({}, home, 'win32');
    expect(claudeFiles).toHaveLength(1);
    expect(claudeFiles[0]).toBe(path.join(home, '.claude', 'projects', 'project-y', 'session-y.jsonl'));
  });

  it('returns empty array when only XDG exists on win32', () => {
    touch(path.join(home, '.config', 'claude', 'projects', 'project-x', 'session-x.jsonl'));

    const { claudeFiles } = discoverPaths({}, home, 'win32');
    expect(claudeFiles).toEqual([]);
  });

  it('still honors CLAUDE_CONFIG_DIR override on win32', () => {
    const customDir = path.join(home, 'custom-claude');
    touch(path.join(customDir, 'projects', 'project-z', 'session-z.jsonl'));

    const { claudeFiles } = discoverPaths({ CLAUDE_CONFIG_DIR: customDir }, home, 'win32');
    expect(claudeFiles).toHaveLength(1);
  });
});
```

#### c) Keep platform-neutral tests

The following tests work unchanged on all platforms once `discoverPaths` receives a `platform` parameter:

- "finds top-level session files and subagent files, ignores non-jsonl entries" → only needs `platform` passed.
- "honors a comma-separated CLAUDE_CONFIG_DIR override" → works independently of the platform.
- "returns an empty array when nothing exists" → works independently of the platform.

All Codex tests remain unchanged, since Codex is not enabled on Windows in this phase.

### 2.4 No Changes to `tracker.ts`

`src/main/usage/tracker.ts` uses `discoverPaths()` as a black box. As long as the signature of `discoverPaths` remains backward-compatible (e.g. via an optional `platform` parameter with default `process.platform`), no change is needed.

### 2.5 Expected Results

- On Windows, `discoverPaths()` finds Claude Code logs only under `%USERPROFILE%\.claude`.
- On Windows, `~/.config/claude` is ignored.
- On macOS and Linux, the existing behavior is preserved.
- `CLAUDE_CONFIG_DIR` works as an override on all platforms.
- All existing tests stay green.
- New tests explicitly cover the Windows behavior.

---

## 3. Dependencies on Phase 1 and Phase 2

| Phase | Build items | Relevance for BL-WIN-5 |
|-------|-------------|------------------------|
| **Phase 1: Foundation** | BL-WIN-1, BL-WIN-2, BL-WIN-9 | Prerequisite for the code to be built and tested on Windows at all (platform-independent build scripts, Windows CI runner). Without Phase 1, BL-WIN-5 cannot be verified. |
| **Phase 2: Core Windows Experience** | BL-WIN-3, BL-WIN-4 | Not directly blocking for BL-WIN-5, but part of the same Windows port theme. Ensures the app runs on Windows so the usage tracker can be tested in the real Windows environment. |

**Dependencies on other modules:**

- `src/main/usage/tracker.ts`: No direct dependency, since `discoverPaths` remains backward-compatible.
- `src/main/usage/config.ts`: Not affected.
- `src/main/usage/claude-parser.ts`, `codex-parser.ts`, `totals.ts`: Not affected.

---

## 4. Acceptance Criteria for the Entire Phase

1. On Windows (`win32`), `discoverPaths()` resolves Claude Code logs exclusively from `%USERPROFILE%\.claude`.
2. On Windows, `discoverPaths()` no longer checks the XDG path `~/.config/claude`.
3. On macOS (`darwin`) and Linux (`linux`), the previous logic with XDG + legacy is preserved.
4. `CLAUDE_CONFIG_DIR` retains the highest priority on all platforms and works comma-separated.
5. `src/main/usage/paths.test.ts` contains:
   - Platform-neutral tests for general logic (file discovery, override, empty results).
   - Platform-specific tests for Windows (`win32`) proving that XDG is ignored.
   - Platform-specific tests for non-Windows platforms (`darwin`/`linux`) proving that XDG is still used.
6. `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` are green locally and in CI on Windows and non-Windows platforms.
7. No new dependencies are introduced.
8. No changes to `tracker.ts`, parsers, or aggregation logic are needed.
9. Codex tracking is not enabled on Windows in this phase or documented as supported.

---

## 5. Risks and How They Are Mitigated

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Wrong assumption about the Windows Claude Code path.** If Claude Code on Windows actually uses `%LOCALAPPDATA%\Claude` or another path, the tracker finds no logs. | High | Medium | Keep the documented decision from the master plan: the legacy path `~/.claude` remains primary. If new findings emerge, a follow-up build item will be created. |
| **Tests are not meaningful on the current CI platform.** CI runs on `ubuntu-latest` and `windows-latest`. Windows tests would automatically hit `process.platform === 'win32'`; Unix tests use the injected parameter. | Medium | Low | Injecting the `platform` parameter into `discoverPaths` enables explicit tests for `win32`, `darwin`, and `linux` independent of the actual CI platform. |
| **Backward compatibility of `discoverPaths` is broken.** If an external caller invokes `discoverPaths()` without a `platform` parameter and the default is not `process.platform`, the app behaves incorrectly. | High | Low | Implement `platform` as an optional parameter with default `process.platform`. No external callers outside `tracker.ts` are known. |
| **Codex tracking is accidentally enabled on Windows.** | Low | Low | Make no code changes to Codex paths. Explicitly document in the plan and docs that Codex is not supported on Windows. |
| **Different path separators on Windows cause test comparison failures.** | Low | Low | Use `path.join`; no hardcoded slashes in tests or production code. |

---

## 6. Test and Verification Steps

### 6.1 Local Verification

```bash
# TypeScript check
npm run typecheck

# Linter
npm run lint

# Unit tests (all platforms)
npm test

# Build
npm run build
```

### 6.2 Manual Verification on Windows

1. On a Windows machine with Claude Code installed, check whether `%USERPROFILE%\.claude\projects\*` exists.
2. Start Beaver Buddy.
3. Ensure the token burn tracker outputs data.
4. Ensure no error occurs when `%USERPROFILE%\.config\claude` does not exist.

### 6.3 CI Verification

- The GitHub Actions matrix (`ubuntu-latest`, `windows-latest`) must be green for `npm run test`.
- The Windows runner automatically covers the behavior at `process.platform === 'win32'`.
- Injected platform parameters in tests make it possible to test Windows behavior explicitly on Linux CI nodes as well.

### 6.4 Test Coverage Goals

- `claudeConfigDirs` is tested for `win32`, `darwin`, and `linux`.
- The `CLAUDE_CONFIG_DIR` override is tested for at least two platforms.
- Edge cases covered:
  - Only XDG exists on Windows → empty result.
  - Neither XDG nor legacy exists → empty result.
  - Both directories exist on non-Windows → both are found.

---

## 7. Non-Goals of This Phase

- No support for Codex logs on Windows.
- No new features in usage tracking (e.g. new parsers, new metrics).
- No changes to the secret store (BL-WIN-6), overlay (BL-WIN-3), or tray (BL-WIN-4).
- No new dependencies.
- No changes to the build or packaging infrastructure.

---

## 8. Next Steps After Phase 3

1. Implement **Phase 4: Polish & Release Readiness** (BL-WIN-8, BL-WIN-10).
2. Research **Codex tracking on Windows** and, if needed, plan it as a separate build item.
3. Coordinate **BL-WIN-6 (Keychain/secret store)** with the project administrator.
4. Research **BL-WIN-7 (atomic writes)**.

---

## 9. Change Overview

| File | Change |
|------|--------|
| `src/main/usage/paths.ts` | `claudeConfigDirs` receives a platform parameter; on `win32` only `~/.claude` is checked. |
| `src/main/usage/paths.test.ts` | Platform-specific tests added for Windows and non-Windows; existing tests remain platform-neutral. |
