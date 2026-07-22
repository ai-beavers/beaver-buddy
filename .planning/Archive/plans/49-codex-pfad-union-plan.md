# Flight-Plan Item #49 — Codex Homes on Windows: Union Instead of First-Wins

Source: `.flightplan/Archive/plans/parity/bereich-1-connect-usage-log-pfade.md` (finding B1).
Status: planning complete, not yet implemented.

## 1. Goal & Acceptance Criteria

**Goal:** On Windows, existing but session-less Codex candidates
(`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex` — the latter is the Electron userData folder of the
Codex desktop app) must no longer hide the real CLI sessions under `%USERPROFILE%\.codex`.

**Acceptance criteria:**

- AK-1: A user with the Codex desktop app installed (i.e. with an existing `%APPDATA%\Codex`)
  **and** the Codex CLI (sessions in `%USERPROFILE%\.codex\sessions`) gets their CLI sessions
  found — Connect-Codex works for this user group. (Regression test included.)
- AK-2: Sessions scattered across multiple existing candidate roots are **all** found
  (union), not only those of the first existing root.
- AK-3: The same session (same relative path `YYYY/MM/DD/rollout-*.jsonl`), reachable via two
  roots, is listed exactly once — the earlier candidate in the existing order wins
  (deterministic priority).
- AK-4: macOS/Linux behavior is byte-identical (only the `~/.codex` candidate exists there;
  a union over 0 or 1 root ≡ the previous result, including the order of the file list).
- AK-5: `CODEX_HOME` override unchanged: exactly one candidate, no union effect.
- AK-6: Opt-in gating unchanged: `UsageTracker` continues to parse file contents only after
  `setEnabledSources`; discovery remains a pure directory listing (the union adds at most two
  additional `readdir` scans, no file contents).
- AK-7: `npm test`, `npm run typecheck`, `npm run lint` green. No new dependencies.

## 2. Decision: Union (Not Reordering)

**Decision: union of all existing candidates**, as recommended in the analysis.

Rationale, honestly weighed:

- **Reordering** (`~/.codex` first among the win32 candidates, 1 line) only fixes the
  reported "desktop app installed" case. It leaves the reverse hiding in place: sessions
  under `%LOCALAPPDATA%\Codex` would then be hidden by `~/.codex`. Whether real sessions ever
  live there is not verified — reordering bets on that, union does not.
- **Union** fixes the entire error class ("any existing candidate hides another candidate's
  sessions"), regardless of which root holds sessions.
- **Coherence argument:** The codebase already accepts union semantics for Claude on Unix
  (`paths.ts:58-62`, comment: "users who migrated may still have data in the old spot").
  The same migration/mixing argument applies to Codex on Windows in exactly the same way.
- **Effort, honestly:** Union ≈ +12 lines net in `paths.ts` (the dedup mechanics via
  `Map<relative, absolute>` already exist in `findCodexRolloutFiles`/`findCodexFiles`,
  paths.ts:98-133, and are only reused one level higher). Reordering would be 1 line,
  but semantically weaker. The extra cost is small and fully encapsulated internally.

## 3. Design

### 3.1 Consumer Analysis (verified via grep over `src/`)

| Symbol | Visibility | Consumers |
|---|---|---|
| `resolveCodexHome` | **private** (not exported) | only `discoverPaths`, `paths.ts:165` |
| `codexHomes` | private | only `resolveCodexHome`, `paths.ts:155` |
| `findCodexFiles` | private | only `discoverPaths`, `paths.ts:166` |
| `discoverPaths` | **exported** | `tracker.ts:134` (positional: env, home — platform default), `paths.test.ts` (throughout) |
| `parseCodexFile` / `codex-parser.ts` | exported | consumes only **absolute file paths** (`codex-parser.ts:101`), no coupling to `resolveCodexHome` |

**Consequence: The exported interface (`discoverPaths`, `DiscoveredPaths`, `PathEnv`)
remains unchanged.** The signature change `string | undefined` → `string[]` affects only the
private function `resolveCodexHome`. `tracker.ts` and `codex-parser.ts` are **not** touched.

### 3.2 Changed/New Private Functions in `paths.ts`

```
codexHomes(env, home, platform): string[]            // UNCHANGED — candidate list,
                                                     // order stays:
                                                     // win32: LOCALAPPDATA → APPDATA → ~/.codex
                                                     // unix:  [~/.codex]; override: [CODEX_HOME]

resolveCodexHomes(env, home, platform): string[]     // REPLACES resolveCodexHome (plural):
  return codexHomes(env, home, platform)
    .filter((d) => fs.existsSync(d));                // .filter instead of .find — the entire change

findCodexFiles(codexHome): Map<string, string>       // RETURN TYPE string[] → Map<rel, abs>
                                                     // (the existing body already builds the
                                                     // sessions-wins map, only [...values()]
                                                     // is dropped)

findAllCodexFiles(roots: readonly string[]): string[]  // NEW — cross-root union:
  const winners = new Map<string, string>();
  for (const root of roots)
    for (const [relative, absolute] of findCodexFiles(root))
      if (!winners.has(relative)) winners.set(relative, absolute);   // earlier candidate wins
  return [...winners.values()];
```

Naming note (from verification, minor): the slight asymmetry `findCodexFiles → Map` vs.
`findAllCodexFiles → string[]` is deliberately accepted — cosmetic, no behavioral
consequence; the implementation follows the scheme above.

`discoverPaths` (paths.ts:165-166) becomes a single line:

```ts
const codexFiles = findAllCodexFiles(resolveCodexHomes(env, home, platform));
```

Comment on `findAllCodexFiles`: union across all existing candidates; on a duplicate
relative path the earliest candidate wins (candidate order = priority); within one root,
`sessions/` still beats `archived_sessions/`.

### 3.3 Dedup Rules (Exact)

The dedup key is the **relative path** `YYYY/MM/DD/rollout-*.jsonl` (via `path.join`,
platform-consistent). Priority on collision, top to bottom:

1. **Candidate order across root boundaries:** `%LOCALAPPDATA%\Codex` >
   `%APPDATA%\Codex` > `~/.codex`. Rationale: preserves the previous first-wins priority as
   determinism — the candidate that would previously have delivered *alone* keeps delivering
   "its" copy on a true duplicate. In practice the collision is virtually impossible
   (the desktop app's userData contains no `sessions/` rollouts); the rule only needs
   determinism, not truth about "the right" copy.
2. **Within one root:** `sessions/` before `archived_sessions/` (existing mechanics,
   unchanged, paths.ts:126-131). Across root boundaries, rule 1 applies — even if the
   earlier root's copy comes from `archived_sessions/`. This is deliberately kept that
   simple (a single merge loop) and is documented in the comment.

Side conditions:

- Identical candidate paths (e.g. `LOCALAPPDATA` ≡ `home` constructs) are harmless:
  dedup by relative path absorbs duplicate roots.
- No candidate exists → `[]` ≡ before. `CODEX_HOME` set but non-existent → `[]` ≡ before.
- Result order: candidate order, and within it the map's insertion order (sessions
  traversal, then archived-only) — with exactly one root **byte-identical** to today (AK-4).

## 4. Change List per File

- **`src/main/usage/paths.ts`** (only production file):
  - `resolveCodexHome` → `resolveCodexHomes`, return `string[]`, `.find` → `.filter`
    (paths.ts:154-156).
  - `findCodexFiles`: return type `string[]` → `Map<string, string>`; the final
    `[...winners.values()]` is dropped (paths.ts:125-133).
  - New: `findAllCodexFiles(roots)` with merge loop + comment (priority rules 3.3).
  - `discoverPaths`: replace lines 165-166 with the single
    `findAllCodexFiles(resolveCodexHomes(...))` call. Claude branch (line 163) **do not
    touch** (#53 boundary, see §6).
- **`src/main/usage/paths.test.ts`**: one test flipped, three new tests (§5).
  Keep the temp-dir pattern (`fs.mkdtempSync(os.tmpdir())`, injected env/home/platform, no
  homedir mocks) exactly as is.
- **Not changed:** `tracker.ts`, `codex-parser.ts`, `main.ts`, everything else — evidenced by
  the consumer table §3.1.

## 5. Test Plan

### 5.1 Test to Flip (deliberate, documented)

- `paths.test.ts:144-153` — "prefers %LOCALAPPDATA%\Codex over ~/.codex when both exist"
  pins the misbehavior as a specification. **Replace with:**
  "finds sessions from %LOCALAPPDATA%\Codex **and** ~/.codex (union)" — same setup
  (one `rollout-*.jsonl` each with *different* file names), expectation: **both** paths,
  LOCALAPPDATA file first (candidate order, deterministic).

### 5.2 New Tests (all in `describe('discoverPaths — Codex on Windows')`)

1. **AK-1 regression:** "existing %APPDATA%\Codex without sessions does not hide ~/.codex
   sessions" — create `%APPDATA%\Codex` as a directory (plus a non-session file,
   e.g. `config.json`, to mimic the desktop app case), session under
   `~/.codex/sessions/...` → exactly that one file is found.
2. **AK-3 dedup:** "same relative path in two roots → earlier candidate wins" —
   create identical `YYYY/MM/DD/rollout-dup.jsonl` under `%LOCALAPPDATA%\Codex\sessions` and
   `~/.codex\sessions` (different content) → exactly 1 result, namely the
   LOCALAPPDATA path.
3. **AK-2/AK-3 union with archived:** "sessions in root A beats archived_sessions in root B
   for the same file" — identical relative path, copy in `%LOCALAPPDATA%\Codex\sessions`
   and in `~/.codex\archived_sessions` → exactly 1 result, the LOCALAPPDATA path
   (candidate order beats archived across root boundaries, §3.3 rule 2).

### 5.3 Tests Remaining Unchanged (checklist)

- `paths.test.ts:155-162` ("falls back to %APPDATA%\Codex when LOCALAPPDATA is missing"):
  semantics today = union with only one contributing root → green, name remains tolerable.
- `paths.test.ts:164-170` ("falls back to ~/.codex when no AppData paths exist"): green.
- `paths.test.ts:172-181` (CODEX_HOME precedence): green (AK-5).
- Entire Unix Codex block `paths.test.ts:106-141` incl. sessions-wins dedup: green (AK-4).
- `tracker.test.ts` (incl. the platform-neutral spy test "does not read log file contents
  until the user opts in", tracker.test.ts:118-133 — no win32 setup): green (AK-6).

### 5.4 Verification

- `npm test` (vitest run), `npm run typecheck`, `npm run lint` — all green locally.
- The CI matrix (`ubuntu-latest` + `windows-latest`) additionally runs the win32 simulation
  tests with real Win32 paths.

## 6. Risks / Open Items

- **#53 boundary (Claude XDG union, same file):** Item #53 will touch `claudeConfigDirs`
  (paths.ts:54-56) and test `paths.test.ts:76-81` — disjoint functions, disjoint
  tests. The only touchpoints: the adjacent line in `discoverPaths` (163 vs. 165) and
  the same test file. This plan deliberately changes **nothing** in the Claude branch; the
  later #53 loop should build on the #49 state (rebase); conflict risk at most trivial.
- **macOS invariance:** A union over exactly one candidate (`~/.codex`) or zero candidates
  is by construction result- and order-identical (§3.3); covered by the unchanged green
  Unix tests (§5.3). No platform-specific special path needed.
- **Collision priority is convention, not knowledge:** Which copy is "more correct" on a
  true cross-root duplicate is unknown; candidate order only provides determinism.
  Accepted because the case practically never occurs (desktop app userData has no
  `sessions/`). Recorded in the code comment.
- **Performance:** Up to two additional `readdir` trees per refresh, only when the roots
  exist; negligible compared to file parsing; no gating breach (listings only).
