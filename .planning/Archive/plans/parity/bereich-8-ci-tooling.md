# Area 8 — CI/Tooling After Merge (d7acaf0)

## 1. Verdict: PARITY OK (with 2 risks, no hard gap)

The merge took over our CI/signing flow unharmed; package.json ↔ package-lock.json
are consistent (`npm ci` works); typecheck, lint, and 434 tests verified green locally.
Two risks: the pending Dependabot branch `typescript-7.0.2` would break the build,
and `@types/node` 26 does not match the Node 24 runtime (inherited from upstream).

## 2. Findings

### Finding 1 — [risk] Dependabot branch `typescript-7.0.2` breaks typecheck/build on merge

- **File:line:** `tsconfig.json:6` (`"moduleResolution": "node10"`), `tsconfig.json:7` (`"ignoreDeprecations": "6.0"`)
- **Description:** The branch `upstream/dependabot/npm_and_yarn/typescript-7.0.2` (also
  fetchable on our remote; `.github/dependabot.yml` generates weekly npm updates) merges
  textually conflict-free (verified via `git merge-tree --write-tree`) and its lockfile is
  internally consistent (spec `^7.0.2` ↔ version 7.0.2, platform packages
  `@typescript/typescript-win32-x64`/`-arm64` present). Semantically it breaks the build:
  the installed TS 6.0.3 proves it itself —
  `npx tsc --noEmit --ignoreDeprecations 5.0` yields:
  `error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in
  TypeScript 7.0.` After merging the bump, `npm run typecheck` and `npm run build`
  fail on **both** OS matrix jobs (ci.yml:37, ci.yml:46). The branch is also stale
  (the diff against upstream/main shows retroactive deletions, e.g. assets icons).
- **Fix proposal (no new dependencies):** Before the TS 7 merge, migrate the root
  `tsconfig.json`: `"module": "nodenext"` + `"moduleResolution": "nodenext"` (replaces `commonjs`/`node10`)
  and remove `"ignoreDeprecations"`; CJS emit for the main process is preserved
  (no `"type": "module"` in package.json). Then rebase the Dependabot PR instead of
  merging the stale branch.

### Finding 2 — [risk] `@types/node` ^26.1.1 vs. Node 24 runtime (inherited from upstream)

- **File:line:** `package.json:24` (`"@types/node": "^26.1.1"`, Dependabot commit b94bffe)
  vs. `package.json:9` (`engines.node: 24.x`), `ci.yml:30` (`node-version: 24`)
- **Description:** The code is compiled against Node 26 types but runs on Node 24:
  CI uses Node 24, Electron 43.1.1 bundles Node **v24.18.0** (measured via
  `ELECTRON_RUN_AS_NODE=1 electron -e "process.version"`). Node-26-only APIs would
  typecheck cleanly and only fail at runtime. Currently this is latent: a grep over `src/` finds
  no critical new additions (`node:sqlite`, `styleText`, `globSync`, `fs.promises.glob`,
  `process.features` — no hits). Upstream itself carries the same inconsistency.
- **Fix proposal (no new dependencies):** pin `@types/node` back to `^24.x`
  (revert the major bump) and optionally add an `ignore` entry for
  `@types/node` major updates in `.github/dependabot.yml`, so that types and runtime
  generation (engines/CI/Electron) stay coupled.

### Finding 3 — [risk] Local node_modules stale after the merge (workstation state only)

- **File:line:** `package.json:27` (`"electron": "43.1.1"`, pinned exactly) vs. installed
  `node_modules/electron/package.json` = **43.1.0**
- **Description:** The local install state dates from before the Electron bump (174dd58).
  Not a repo defect — lockfile and package.json are consistent (see Verified OK) — but
  local builds/signing tests run against the old Electron version until `npm ci` runs.
- **Fix proposal:** run `npm ci` once (no change to the repo needed).

## 3. Verified-OK List

- **ci.yml merged unharmed:** content-identical to our pre-merge state cd4ef80
  (diff is only CRLF); upstream did not change ci.yml in the merge range
  (`git log 833de1f..upstream/main -- .github/workflows/ci.yml` → no hits). No
  duplicate steps, no conflict markers — `.github/workflows/ci.yml:1-108` read in full.
- **Signing flow consistent:** mode detection fork-safe (ci.yml:48-68), throwaway cert subject
  `CN=Beaver Buddy CI (self-signed)` (ci.yml:78) matches the verify call
  `-ExpectedSubjectContains 'Beaver Buddy CI (self-signed)'` (ci.yml:98) and the
  substring check in `scripts/verify-signatures.ps1:74`. Secret propagation via GITHUB_ENV
  (ci.yml:63-64) — values stay masked.
- **Verify-before-upload order:** verify (ci.yml:93-101) runs before upload (ci.yml:103-108);
  default path `release\*.exe` (verify-signatures.ps1:36) matches `directories.output: release`
  (electron-builder.yml:3-4) and `path: release/*.exe` (ci.yml:108). The throwaway cert expires
  after 2 days (ci.yml:82), but `rfc3161TimeStampServer` (electron-builder.yml:25) makes the
  signature permanently verifiable.
- **Dependabot checkout-7 / setup-node-7:** both branches merge conflict-free (merge-tree) and
  each change only the one `uses:` line — no collision with matrix/signing steps.
- **package-lock.json ↔ package.json:** lockfileVersion 3, root specs identical
  (0 mismatches, checked programmatically), electron 43.1.1, typescript 6.0.3,
  @types/node 26.1.1, vitest 4.1.10, eslint 10.7.0 → `npm ci` works.
- **assets:* scripts:** all targets exist (`scripts/gen-sprites/build.ts`,
  `build-adult-placeholder.ts`, `build-icons.ts`, `ingest-images.mjs`); no
  `enum`/`namespace` constructs in `scripts/` or `src/` (grep) → direct
  `node *.ts` via type stripping works (proven with local Node 22.19).
- **scripts/ untouched by the merge:** the merge stat (d7acaf0) contains no `scripts/` files;
  `verify-signatures.ps1`, `new-dev-signing-cert.ps1`, `cdp-screenshot.mjs` (Node 22+ APIs:
  fetch/WebSocket), `build-assets.js`, `usage-cli.js` remain functional; referenced
  paths (`dist/main/usage/tracker.js`, `src/main/mrr/settings.html`, `assets/sprites/`) exist.
- **electron-builder.yml:** merge conflict cleanly resolved; mac/win/nsis sections consistent
  (electron-builder.yml:9-34); signing strictly opt-in via WIN_CSC_LINK (comment line 20-21).
- **vitest.config.ts:** dist/ exclude intact (vitest.config.ts:8); `npm test` verified locally:
  43 files, **434 passed**, 6 skipped.
- **typecheck + lint:** `npm run typecheck` (3 tsconfigs) and `npm run lint` green locally.
- **engines/CI/Electron-Node coherence:** engines 24.x (package.json:9) = CI node-version 24
  (ci.yml:30) = Electron 43 runtime Node v24.18.0.

## 4. Proposed Flight-Plan Items

1. **TS-7-ready tsconfig (node10 → nodenext):** migrate the root tsconfig to `module`/`moduleResolution:
   nodenext` and remove `ignoreDeprecations` before Dependabot merges typescript-7.x.
2. **Couple @types/node to the Node 24 runtime:** pin the major bump (b94bffe) back to `^24` and
   set a Dependabot ignore for `@types/node` majors.
3. **Post-merge hygiene: `npm ci`:** bring the local installation up to the locked state
   (electron 43.1.0 → 43.1.1); optionally as a note in CONTRIBUTING.md.
