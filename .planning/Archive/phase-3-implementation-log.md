# Phase 3: Windows Integrations — Implementation Log (BL-WIN-5)

**Date:** 2026-07-15
**Build item:** BL-WIN-5 — Make Claude usage log paths Windows-compatible
**Changed files:**
- `src/main/usage/paths.ts`
- `src/main/usage/paths.test.ts`

---

## 1. What Was Changed

### `src/main/usage/paths.ts`

- New `Platform` type restricted to `'win32' | 'darwin' | 'linux'`.
- `claudeConfigDirs(env, home, platform)` received a third `platform` parameter.
  - `CLAUDE_CONFIG_DIR` remains the highest-priority override, cross-platform.
  - On `win32` only the legacy path `~/.claude` is checked.
  - On `darwin`/`linux` the previous behavior (XDG `~/.config/claude` + legacy) is preserved.
- `discoverPaths(env, home, platform)` received an optional third parameter with default `process.platform` (cast to `Platform`) to preserve backward compatibility with `tracker.ts`.
- `CLAUDE_CONFIG_DIR` now accepts semicolons as separators in addition to the documented comma (`split(/[,;]/`).
  - Rationale: semicolon is the conventional PATH separator on Windows. A colon was deliberately not supported because it would collide with Windows drive letters (`C:\`).

### `src/main/usage/paths.test.ts`

- All `discoverPaths` calls are now made with an explicit `platform` parameter.
- Platform-neutral Claude tests run parameterized over `win32`, `darwin`, and `linux`.
- The XDG test ("prefers XDG and legacy together when both exist") was restricted to `darwin`/`linux`.
- New Windows-specific tests under `discoverPaths — Claude on Windows`:
  - Ignores XDG and uses legacy on `win32`.
  - Returns an empty array when only XDG exists.
  - `CLAUDE_CONFIG_DIR` override with a single path on `win32`.
  - `CLAUDE_CONFIG_DIR` multi-path override with semicolon separation on `win32`.
- Codex tests were also parameterized with a fixed `platform` parameter (`'linux'`) but remain otherwise unchanged.

---

## 2. Decisions

| Decision | Rationale |
|----------|-----------|
| Platform as an injected parameter (Variant B) | Consistent with the existing test strategy (injected `env` and `home`); no `process.platform` mock needed. |
| `Platform` restricted to three values | Type safety; the review finding did not require `\| string`. |
| Legacy path only on `win32` | Matches the documented assumption that Claude Code uses `%USERPROFILE%\.claude` on Windows. XDG does not exist on Windows. |
| `CLAUDE_CONFIG_DIR` additionally semicolon-tolerant | The review called for a multi-path test on Windows; semicolon is the Windows PATH standard and does not break Windows paths. |
| No colon as separator | Would misparse Windows drive letters (`C:\`). |
| `tracker.ts` not changed | `discoverPaths` stays backward-compatible via the optional parameter with default. |
| No new dependencies | Only `node:fs`, `node:os`, `node:path` used. |

---

## 3. Test Results

Local verification on a Windows development machine (`process.platform === 'win32'`):

```bash
npm run typecheck   # ✅ successful
npm run lint        # ✅ successful
npm test            # ✅ 323 passed | 6 skipped (329 total)
npm run build       # ✅ successful
```

All new and existing tests in `src/main/usage/paths.test.ts` are green (20 tests).

---

## 4. Open Issues / Notes

- **CI verification on `ubuntu-latest` and `windows-latest`:** Testing was done locally on Windows. Since all `discoverPaths` calls are explicitly parameterized, the tests should also run deterministically on Linux CI nodes. A fresh CI run is recommended.
- **Colon as `CLAUDE_CONFIG_DIR` separator:** Deliberately not implemented to avoid breaking Windows paths. If a real need arises in the future, platform-dependent separator logic with drive-letter detection would have to be introduced.
- **Other platforms (`freebsd`, `openbsd`, etc.):** `discoverPaths` casts `process.platform` to `Platform`. When called without the parameter on unlisted platforms, this produces a TypeScript cast; the runtime behavior falls back to XDG + legacy, which is consistent with the status quo before BL-WIN-5. For type-safe calls, callers should pass one of the three supported platforms.
- **UsageTracker platform injection:** `tracker.ts` calls `discoverPaths(this.env, this.home)` without a platform. That is sufficient for BL-WIN-5, since the default `process.platform` applies. For future Windows integration tests, `UsageTracker` could optionally receive a `platform` parameter.
