# Flight-Plan Item #49 — Plan Verification: Codex Path Union

Checked: `.flightplan/Archive/plans/49-codex-pfad-union-plan.md` against
`src/main/usage/{paths.ts, paths.test.ts, tracker.ts, tracker.test.ts, codex-parser.ts, codex-parser.test.ts}`,
`src/main/main.ts`, `.github/workflows/ci.yml`, `package.json`. Read-only, no code changes.

## Verdict: PLAN OK

All load-bearing assumptions of the plan are verified against the code. No blockers. Two
minor notes (wording and style respectively), neither with behavioral consequences.

## Verified Assumptions

### 1. Consumer Analysis (plan §3.1) — correct, complete

- `resolveCodexHome` (paths.ts:154-156): **private**, only call paths.ts:165 in `discoverPaths`. ✓
- `codexHomes` (paths.ts:135-152): private, only call paths.ts:155. ✓
- `findCodexFiles` (paths.ts:125-133): private, only call paths.ts:166. ✓
- `findCodexRolloutFiles` (paths.ts:98-123): private, calls only paths.ts:127-128. ✓
- `discoverPaths`: exported; consumers exactly `tracker.ts:134` (positional `env, home` —
  platform default, as claimed) and `paths.test.ts` (throughout). Grep `from './paths'` over
  `src/`: only tracker.ts:17 and paths.test.ts:5. ✓
- `codex-parser.ts`: `parseCodexFile(filePath)` (codex-parser.ts:101) consumes only absolute
  paths; `codex-parser.test.ts` does not import `./paths`. No coupling to `resolveCodexHome`. ✓
- `PathEnv`/`DiscoveredPaths` are used only type-wise in tracker.ts — signatures unchanged. ✓

**Consequence confirmed:** "No external interface change" holds; tracker.ts and
codex-parser.ts do not need to be touched.

### 2. Dedup Mechanics (plan §2, §3.3) — correctly described and complete

- `findCodexRolloutFiles` already returns `Map<relative, absolute>` (paths.ts:98-123);
  key = `path.join(year, month, day, file)` (paths.ts:115) — platform-consistent, since both
  roots use the same separator in the same process (also under win32 simulation on Linux CI). ✓
- `findCodexFiles` (paths.ts:125-133): the `sessions/` map wins, `archived_sessions/` only on
  a missing key (paths.ts:129-131) — "sessions wins" as claimed. The plan's claim
  "only `[...values()]` is dropped" (§3.2) is accurate: the body already builds the winner map. ✓
- The planned cross-root dedup (`!winners.has(relative)` → earlier candidate wins) covers all
  collision cases:
  - same file in two roots → 1 result, candidate order decides. ✓
  - `sessions/` in root A vs. `archived_sessions/` in root B (same relative path) → root A
    wins; conversely (archived in A, sessions in B) A wins as well. This asymmetry is
    explicitly documented in §3.3 rule 2 as deliberate simplicity — deterministic, practically
    irrelevant (desktop app userData contains no rollouts). ✓
  - Identical candidate paths (e.g. `LOCALAPPDATA` ≡ `APPDATA`): double scan, dedup by
    relative path absorbs it — §3.3 side conditions cover that. ✓
- Intra-root overwrite in `findCodexRolloutFiles` (unconditional `.set`, paths.ts:116) is harmless:
  each (Y/M/D/file) tuple occurs exactly once per traversal. No plan gap.

### 3. macOS/Linux Invariance (AK-4) — proven

- `codexHomes` returns exactly one candidate `[~/.codex]` on darwin/linux (paths.ts:151) or
  `[CODEX_HOME]` (paths.ts:136-139) — a union over 0 or 1 root.
- 0 roots: `findAllCodexFiles([])` → `[]` ≡ today (`codexHome === undefined` → `[]`). ✓
- 1 root: merge loop over a single map → `[...winners.values()]` in identical insertion
  order as today's `findCodexFiles` result (sessions traversal, then archived-only).
  **No** additional `readdir` calls are added when only one root exists →
  readdir order unchanged → file list byte-identical including order. ✓
- Unix tests (paths.test.ts:106-141) are order-safe (single-element `toEqual`, `toHaveLength`,
  `toBe` on `[0]`) → stay green. No Unix test can flip due to ordering. ✓

### 4. Test Realism (plan §5) — feasible

- The temp-dir pattern (`fs.mkdtempSync(os.tmpdir())` paths.test.ts:14, `touch` helper :21-24,
  env/home/platform injection, no homedir mocks) supports all four planned tests unchanged. ✓
- Test to flip (paths.test.ts:144-153): the new expectation "both files, LOCALAPPDATA first"
  is deterministic — exactly one file per root, candidate order = map insertion order. ✓
- AK-1 test: `%APPDATA%\Codex` can be created via `touch(.../Codex/config.json)`; empty
  `sessions/`/`archived_sessions/` yield empty maps via `safeReaddir` → only the
  `~/.codex` session is found. ✓
- AK-3 dedup test: same rel path in two roots with different content → exactly the
  LOCALAPPDATA path. ✓
- Checklist §5.3 verified by sampling: :155-162 (only APPDATA set → 1 contributing
  root), :164-170, :172-181 (CODEX_HOME exclusive), Unix block — all green under union. ✓
- **No silent first-wins dependencies outside paths.test.ts:** `tracker.test.ts` has
  **not a single Codex fixture** (all tests `codex: false`, only `.claude` sessions) and
  instantiates `UsageTracker({}, home)` — with an empty env the win32 AppData candidates
  drop out via `filter` (paths.ts:148) → even on Windows CI runners only one candidate ≡ today. ✓

### 5. Completeness — no missing case

- **CODEX_HOME (paths.ts:136-139):** `codexHomes` remains unchanged; the override returns
  `[configured]` before the platform branches → exactly one candidate, no union effect (AK-5).
  Semantically correct: an explicit override should be exclusive. Set-but-non-existent →
  `filter` → `[]` ≡ today. ✓
- **Performance:** +2 `existsSync`, at most +2 `readdir` trees per refresh, only when roots
  exist; pure directory listings, no gating breach — tracker.ts:162-167 continues to parse
  contents only for enabled sources. Negligible, correctly assessed. ✓
- **Constraints:** no new dependencies (only `node:fs`/`node:path`, already imported);
  surface = paths.ts + paths.test.ts; `npm test`/`typecheck`/`lint` exist as scripts;
  CI matrix ubuntu-latest + windows-latest confirmed (ci.yml:21). ✓
- **#53 boundary:** correctly noted as disjoint — #53 concerns `claudeConfigDirs` (paths.ts:54-56)
  and test paths.test.ts:76-81; the only touchpoints (adjacent line in `discoverPaths` :163 vs.
  :165-166, same test file) are correctly named in plan §6. ✓

## Findings

- **[minor] Plan §5.3, labeling:** The test labeled "Windows spy test"
  (`tracker.test.ts:118-133`, "does not read log file contents until the user opts in") is
  **platform-neutral** — no win32 setup, runs with the default platform. The conclusion
  (stays green, AK-6) is still correct: union adds only `existsSync`/`readdir` before
  opt-in, no `openSync` on `.jsonl`. Only the label in the plan is imprecise.
- **[minor] Plan §3.2, style:** `findCodexFiles` is to return `Map<rel, abs>` while the new
  `findAllCodexFiles` returns `string[]` — a slightly asymmetric name/type pairing of two
  private helpers. Functionally sound; left to the implementer (e.g. a Map return as an
  inline merge in `findAllCodexFiles` is conceivable). No correction needed.
- Note without finding character: The comment on `findCodexFiles` (paths.ts:126, "sessions/ wins")
  must migrate along with the change or be supplemented by the planned priority comment on
  `findAllCodexFiles` — plan §3.2 covers that.

## Conclusion

The plan is implementation-ready: consumer analysis exact, dedup rules complete and
deterministic, Unix invariance provable, test plan directly feasible with the existing
temp-dir pattern, CODEX_HOME exclusivity and the #53 boundary cleanly addressed. **PLAN OK** —
implementation can proceed as planned; the two minor notes are optional.
