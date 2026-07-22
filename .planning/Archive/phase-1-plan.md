# Phase 1: Foundation — Detailed Implementation Plan

**Project:** Beaver Buddy (Electron TypeScript app)  
**Phase:** 1 / 5  
**Build Items:** BL-WIN-1, BL-WIN-2, BL-WIN-9  
**Goal:** The app can be built, packaged, and tested in CI on Windows.  
**No source code changes in this document — planning only.**

---

## 1. Phase Summary

Phase 1 lays the fundamental build, packaging, and CI scaffolding for the Windows port. The current codebase is largely platform-neutral, but the build process (`package.json`) uses Unix shell commands (`cp`, `rm -rf`, `mkdir -p`) that fail on Windows cmd/PowerShell. Additionally, `electron-builder.yml` lacks a Windows target, and CI runs exclusively on `ubuntu-latest`.

Phase 1 removes these blockers without introducing new dependencies and without changing the actual app logic (overlay, tray, renderer). The phase is complete once `npm run build` and `electron-builder --win --publish never` run successfully both locally on Windows and in the `windows-latest` CI runner.

---

## 2. Concrete Steps per Build Item

### BL-WIN-1: Platform-Independent Build Scripts

**Scope:** `package.json`, new `scripts/build-assets.js`.  
**Status:** Foundation blocker #1 — must be solved first.  
**Goal:** `npm run build` runs identically on Windows (cmd/PowerShell), macOS, and Linux.

#### 2.1 Analyze Current State

Current `package.json` (line 12):

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && cp src/renderer/index.html dist/renderer/index.html && mkdir -p dist/renderer/assets && rm -rf dist/renderer/assets/sprites && cp -R assets/sprites dist/renderer/assets/sprites && cp src/main/mrr/settings.html dist/main/mrr/settings.html"
```

Problems:
- `cp`, `cp -R` — Unix-only; Windows cmd/PowerShell does not know these commands.
- `mkdir -p` — On Windows only available in PowerShell, not in cmd.
- `rm -rf` — Unix-only; causes an error on Windows.
- A long shell chain is hard to read, hard to test, and fragile with spaces in paths.

#### 2.2 Create New Script `scripts/build-assets.js`

A Node script fully replaces the shell chain. It uses only `node:fs` and `node:path`, i.e. platform-independent Node APIs.

```js
// scripts/build-assets.js
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const assets = [
  { src: path.join(root, 'src', 'renderer', 'index.html'), dst: path.join(root, 'dist', 'renderer', 'index.html') },
  { src: path.join(root, 'src', 'main', 'mrr', 'settings.html'), dst: path.join(root, 'dist', 'main', 'mrr', 'settings.html') },
];

const spritesSrc = path.join(root, 'assets', 'sprites');
const spritesDst = path.join(root, 'dist', 'renderer', 'assets', 'sprites');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst) {
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      copyFile(srcPath, dstPath);
    }
  }
}

// Delete existing sprite target folder (idempotent)
fs.rmSync(spritesDst, { recursive: true, force: true });

// Copy static assets
for (const { src, dst } of assets) {
  copyFile(src, dst);
}

// Copy sprites recursively
copyDir(spritesSrc, spritesDst);

console.log('Assets built successfully.');
```

**Design decisions:**
- `fs.rmSync(..., { recursive: true, force: true })` has been available since Node 14.14 and works platform-independently.
- `fs.copyFileSync` copies individual files; `fs.readdirSync(..., { withFileTypes: true })` enables recursive copying without external tools.
- No additional dependencies; only the Node standard library.

#### 2.3 Adjust `package.json`

New `build` script:

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js"
```

Optionally, `scripts/build-assets.js` could be implemented as a `.ts` file with its own `tsconfig.json`. That would be overhead, since the script only performs filesystem operations and needs no TypeScript code. A CommonJS `.js` script is sufficient and minimizes changes.

**Further adjustments in `package.json`:**
- Update `description` (if desired): `"Pixel-art desktop beaver overlay for macOS and Windows"` — but this is not mandatory for Phase 1; recommended in BL-WIN-10.
- No new `scripts`, no new `devDependencies`.

#### 2.4 Expected Result

- `npm run build` runs without errors on Windows cmd/PowerShell.
- `dist/renderer/index.html`, `dist/main/mrr/settings.html`, and `dist/renderer/assets/sprites/*` exist after the build.
- `npm run build` continues to run identically on macOS and Linux.

---

### BL-WIN-2: electron-builder Windows Target + Icon Assets

**Scope:** `electron-builder.yml`, Windows icon assets.  
**Dependency:** BL-WIN-1 (build must work before packaging).  
**Goal:** `electron-builder --win` produces `.exe` / `.nsis` installer; the app shows an icon in the installer/Explorer.

#### 2.5 Analyze Current State

Current `electron-builder.yml`:

```yaml
appId: com.aibeavers.beaverbuddy
productName: Beaver Buddy
directories:
  output: release
files:
  - dist/**/*
  - assets/**/*
  - package.json
mac:
  category: public.app-category.utilities
  minimumSystemVersion: '14.0'
  target: dmg
```

Problems:
- Only a `mac:` target is configured; no `win:` target.
- No Windows icon defined.
- `files:` contains `assets/**/*`, so macOS-specific assets also land in the Windows build — acceptable as long as no conflicts arise.

#### 2.6 Add Windows Target in `electron-builder.yml`

Target configuration:

```yaml
appId: com.aibeavers.beaverbuddy
productName: Beaver Buddy
directories:
  output: release
files:
  - dist/**/*
  - assets/**/*
  - package.json
mac:
  category: public.app-category.utilities
  minimumSystemVersion: '14.0'
  target: dmg
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
nsis:
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
```

**Design decisions:**
- `target: nsis` — standard installer for Windows; produces `Beaver Buddy Setup.exe`.
- `target: portable` — additionally a portable `.exe` that runs without installation; useful for smoke tests and QA.
- `icon: assets/icon.ico` — Windows requires `.ico` with multiple resolutions (16x16, 32x32, 48x48, 128x128, 256x256).
- `publisherName` is not configured under `win:`, because `electron-builder` 26.15.3 rejects that key. Instead, `author` is set in `package.json` (`"author": "AI Beavers"`), from which `electron-builder` derives the publisher.

#### 2.7 Generate Icon Assets

**Starting point:**
- There is no final Windows icon yet.
- Existing sprite assets: `assets/sprites/beaver-baby.png`, `assets/sprites/beaver-teen.png`, `assets/sprites/lodge.png`.
- Current tray asset: `assets/tray-iconTemplate.png` (macOS template, not suitable for Windows).

**Procedure:**
1. Choose a suitable source sprite, e.g. `assets/sprites/beaver-baby.png` or `assets/sprites/lodge.png`.
2. Generate a colored `assets/tray-icon.png` from it (for the Windows tray, approx. 16x16 to 32x32 px, colored, not a transparent template).
3. Generate `assets/icon.ico` with multiple resolutions (16, 32, 48, 128, 256 px) for the app icon, installer, and Explorer.

**Option A: Manual generation with an image-editing tool**
- Open `assets/sprites/beaver-baby.png` in GIMP/Photoshop/Affinity.
- Extract the first 96×96 idle tile.
- Scale to 192×192 px with nearest-neighbor (exactly 2×).
- Place the 192×192 image on a 256×256 canvas with a transparent border (centered horizontally and vertically).
- Export `assets/tray-icon.png` as a 32×32 downsample (192→32 with nearest-neighbor, 6:1).
- Export the Windows icon `assets/icon.ico` with the resolutions 16, 32, 48, 128, 256 px; the 256×256 version contains the padded image.

**Option B: Automated generation via Node script (recommended if Sharp were available)**
- **Not** recommended here, because `sharp` or `canvas` would be new native dependencies and would violate the constraint "no new dependencies without justification".
- Instead: create a small Node script that converts the existing PNG into an ICO file, **if** a suitable pure-JS tool is found. Otherwise generate manually.

**Recommended interim solution for Phase 1:**
- Add `assets/icon.ico` and `assets/tray-icon.png` manually or with a local conversion tool.
- Document in `assets/STYLE.md` or a new file that these icons are temporarily generated from sprite assets and must be replaced by a final design gate (see BL-WIN-10).

#### 2.8 Expected Result

- `electron-builder --win --publish never` produces in the `release/` directory:
  - `Beaver Buddy Setup.exe` (NSIS installer)
  - `Beaver Buddy.exe` (portable version)
- The Windows icon is displayed in the installer, in Explorer, and in Task Manager.
- The macOS build (`electron-builder --mac`) remains functional unchanged.

---

### BL-WIN-9: Extend CI with `windows-latest`

**Scope:** `.github/workflows/ci.yml`.  
**Dependencies:** BL-WIN-1, BL-WIN-2.  
**Note:** BL-WIN-5 (usage log paths) is a Phase-3 item, but relevant for CI because tests must run on Windows. Since BL-WIN-5 is not implemented in Phase 1, the CI steps must be configured so they still go green — either because the affected tests are platform-neutral or because they are temporarily excluded/adjusted on Windows. **In Phase 1, CI may only run on Windows if the existing tests pass there.**

**Goal:** The CI matrix contains `windows-latest`; `typecheck`, `lint`, `test`, `npm run build`, and `electron-builder --win --publish never` are green.

#### 2.9 Analyze Current State

Current `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
```

Problems:
- Only a single job on `ubuntu-latest`.
- No build step (`npm run build`), even though it is essential for packaging and smoke tests.
- No packaging step for Windows.

#### 2.10 Extend CI Matrix

Target structure:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Package Windows
        if: matrix.os == 'windows-latest'
        run: npx electron-builder --win --publish never
```

**Design decisions:**
- `fail-fast: false` — so a failure on Windows does not immediately abort the Ubuntu job and vice versa.
- `matrix.os: [ubuntu-latest, windows-latest]` — extension to Windows. `macos-latest` is optional for now; since the original focus was macOS and macOS build costs in GitHub Actions are higher, macOS can be added later (e.g. in BL-WIN-10).
- Node version stays at `24`, as required by the project.
- `npm run build` runs before packaging so that `dist/` exists.
- `npx electron-builder --win --publish never` runs only on Windows, since macOS/Linux cannot produce Windows installers.

#### 2.11 Handling Missing Windows Dependencies in CI

- `electron-builder` is already present as a `devDependency`.
- Windows CI runners have .NET/Visual Studio Build Tools preinstalled, so `electron-builder` usually compiles native dependencies (e.g. for `app-builder-lib`) without extra effort.
- If the Windows build fails due to missing build tools, `npm install --global windows-build-tools` or using `actions/setup-python` can help. That should not be necessary, though.

#### 2.12 Expected Result

- CI runs on `ubuntu-latest` and `windows-latest`.
- All steps (`typecheck`, `lint`, `test`, `build`, `electron-builder --win --publish never`) are green on both platforms.
- Build artifacts (optional) can be uploaded as GitHub Actions artifacts to download the Windows installer.

---

## 3. Dependencies Between the Build Items

```
BL-WIN-1 (Build-Scripts)
    │
    ▼
BL-WIN-2 (electron-builder Windows-Target)
    │
    ▼
BL-WIN-9 (CI Windows-Runner)
```

| Dependency | Rationale |
|------------|-----------|
| BL-WIN-2 → BL-WIN-1 | `electron-builder` requires `npm run build` to work so that `dist/` exists. Without a platform-independent build, packaging on Windows cannot be started. |
| BL-WIN-9 → BL-WIN-1 | CI runs `npm run build`; this must work on Windows. |
| BL-WIN-9 → BL-WIN-2 | CI runs `electron-builder --win`; this requires the Windows configuration and the icon asset. |

**Order:** BL-WIN-1 → BL-WIN-2 → BL-WIN-9.

---

## 4. Acceptance Criteria for the Entire Phase

1. **BL-WIN-1 fulfilled:**
   - `npm run build` runs locally on Windows (cmd and PowerShell) without errors.
   - `npm run build` continues to run locally on macOS and Linux without errors.
   - All expected files (`dist/renderer/index.html`, `dist/main/mrr/settings.html`, `dist/renderer/assets/sprites/*`) are present after the build.

2. **BL-WIN-2 fulfilled:**
   - `electron-builder --win --publish never` produces in the `release/` directory an NSIS installer (`*.exe`) and a portable version (`*.exe`).
   - The Windows icon is displayed correctly in the installer, in Explorer, and in Task Manager (manual visual smoke test).
   - `electron-builder --mac --publish never` remains functional (no regression).

3. **BL-WIN-9 fulfilled:**
   - The CI matrix contains `windows-latest` in addition to `ubuntu-latest`.
   - All CI jobs (`typecheck`, `lint`, `test`, `build`, `package-windows`) are green.
   - Failures on one platform do not abort the other (`fail-fast: false`).

4. **Cross-platform regressions ruled out:**
   - No changes to source files outside the build/CI configuration.
   - No new dependencies introduced.
   - Existing macOS functionality (build, packaging) is preserved.

---

## 5. Risks and How They Are Mitigated

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Icon generation from sprites is manual/error-prone** | Windows icon could end up blurry or in the wrong size. | Scale pixel art with nearest-neighbor; store multiple resolutions (16–256 px) in the `.ico`; do a visual smoke test in the installer/Explorer. |
| **Node 24.x not available in local environment** | Local tests run on Node 22.x; potential incompatibilities. | Configure CI explicitly on Node 24.x; `npm ci` warns on Node 22.x but does not abort, so `engines.node` stays at `24.x`. Update the local development environment to Node 24.x soon (outside this phase). |
| **electron-builder on Windows needs build tools** | CI could fail due to missing VC++ Build Tools. | GitHub Actions `windows-latest` has build tools preinstalled; on errors, alternatively add `windows-2019` or explicit setup steps. |
| **Existing tests are not platform-neutral on Windows** | CI test step could go red on Windows even though Phase 1 plans no test changes. | Before merging Phase 1, briefly check whether tests run on Windows; if not, schedule a test fix either in Phase 1 (minimal) or in Phase 3 (BL-WIN-5). |
| **Long CI runtimes due to Windows runner** | Feedback loops become slower. | Run only `typecheck`, `lint`, `test`, `build`, and Windows packaging; leave out macOS CI for now. |
| **Missing code-signing warnings** | Windows Defender SmartScreen warns about the unsigned installer. | Accepted for Phase 1; plan real code signing as a later build item. |

---

## 6. Test and Verification Steps

### 6.1 Local Verification (Windows)

1. **Test the build script:**
   ```cmd
   npm run build
   ```
   - Expectation: no error; `dist/renderer/index.html`, `dist/main/mrr/settings.html`, `dist/renderer/assets/sprites/*` present.

2. **Test packaging:**
   ```cmd
   npx electron-builder --win --publish never
   ```
   - Expectation: `release/Beaver Buddy Setup.exe` and `release/Beaver Buddy.exe` produced.

3. **Installer smoke test:**
   - Run `Beaver Buddy Setup.exe` (local test installation).
   - Check whether the app starts, the icon is visible in Task Manager/Explorer, and there is no crash on startup.

4. **Test the portable version:**
   - Start `Beaver Buddy.exe`.
   - Expectation: the app runs without installation; the overlay appears (possibly still with Phase-2 issues, but no immediate crash).

### 6.2 Local Verification (macOS/Linux)

1. **Test the build script:**
   ```bash
   npm run build
   ```
   - Expectation: identical result as before the change.

2. **Test the macOS packaging regression:**
   ```bash
   npx electron-builder --mac --publish never
   ```
   - Expectation: `release/Beaver Buddy.dmg` is produced.

### 6.3 CI Verification

1. **Trigger the workflow on a feature branch:**
   - Push to a branch with an open pull request.
   - `.github/workflows/ci.yml` runs on `ubuntu-latest` and `windows-latest`.

2. **Check success criteria:**
   - Both jobs green.
   - The `Package Windows` step produces the installer/portable.

3. **Optional: upload artifacts**
   If QA should download the installer, an upload step can be added:
   ```yaml
   - name: Upload Windows artifacts
     if: matrix.os == 'windows-latest'
     uses: actions/upload-artifact@v4
     with:
       name: windows-installer
       path: release/*.exe
   ```
   This is optional for Phase 1, but recommended to enable manual smoke tests.

---

## 7. Files Touched in Phase 1

| File / Path | Build Item | Type of Change |
|-------------|------------|----------------|
| `package.json` | BL-WIN-1 | Adjust `build` script |
| `scripts/build-assets.js` (new) | BL-WIN-1 | Create new Node script |
| `electron-builder.yml` | BL-WIN-2 | Add `win:` target |
| `assets/icon.ico` (new) | BL-WIN-2 | Generate from sprite asset |
| `assets/tray-icon.png` (new) | BL-WIN-2 | Generate from sprite asset (for later tray adjustment in BL-WIN-4) |
| `.github/workflows/ci.yml` | BL-WIN-9 | Extend matrix, add build and packaging steps |

**Not touched in Phase 1:**
- `src/main/main.ts`
- `src/main/tray.ts`
- `src/main/usage/paths.ts`
- `src/main/atomic-file.ts`
- `src/renderer/renderer.ts`
- All test files (except if CI tests run red on Windows — then minimal adjustment)

---

## 8. Next Steps After Phase 1

- **Phase 2: Core Windows Experience** — BL-WIN-3 (overlay adapter) and BL-WIN-4 (tray adapter).
- **Phase 3: Windows Integrations** — BL-WIN-5 (Claude usage log paths).
- **Phase 4: Polish & Release Readiness** — BL-WIN-8 (HiDPI/scaling) and BL-WIN-10 (docs/design gate).
- **Phase 5: Deferred / Follow-up** — BL-WIN-6 (Keychain/secrets), BL-WIN-7 (atomic writes), Codex tracking.

---

## 9. Summary for Stakeholders

Phase 1 makes Beaver Buddy **buildable and packageable** on Windows without changing the app logic. The three build items build on each other: first the platform-independent build script, then the Windows packaging configuration with temporary icons, and finally the CI extension to `windows-latest`. After completion, the team can download Windows installers from CI and proceed with Phase 2 (overlay/tray behavior).
