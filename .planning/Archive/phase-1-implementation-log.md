# Phase 1: Foundation — Implementation Log

**Date:** 2026-07-15
**Build Items:** BL-WIN-1, BL-WIN-2, BL-WIN-9
**Local Environment:** Windows 10.0.26200, Node v22.19.0, npm 11.14.1
**CI Target:** Node 24.x, `ubuntu-latest` + `windows-latest`

---

## 1. Files Changed

| File | Build Item | Change |
|------|------------|--------|
| `package.json` | BL-WIN-1, BL-WIN-2 | `build` script made platform-independent, `description` updated, `author` added |
| `scripts/build-assets.js` | BL-WIN-1 | New Node script for platform-independent asset copying |
| `electron-builder.yml` | BL-WIN-2 | `win:` target (nsis + portable), icon, NSIS installer/uninstaller icon |
| `assets/icon.ico` | BL-WIN-2 | New Windows icon generated from `assets/sprites/beaver-baby.png` |
| `assets/tray-icon.png` | BL-WIN-2 | New colored 32×32 tray icon from the same sprite |
| `.github/workflows/ci.yml` | BL-WIN-9 | Matrix `ubuntu-latest` + `windows-latest`, build and packaging steps, artifact upload |
| `.flightplan/Archive/phase-1-plan.md` | Documentation | Node version note, icon scaling clarified, `publisherName` note, BL-WIN-9 dependency corrected |
| `.flightplan/Archive/WINDOWS_PORT_PLAN.md` | Documentation | BL-WIN-9 dependency on BL-WIN-5 removed |

---

## 2. BL-WIN-1: Platform-Independent Build Scripts

### 2.1 Analysis of `src/renderer/tsconfig.json`

`src/renderer/tsconfig.json` correctly defines:

```json
"outDir": "../../dist/renderer"
```

`tsconfig.json` (root) defines:

```json
"rootDir": "src",
"outDir": "dist"
```

So `tsc` writes to `dist/main/` and `tsc -p src/renderer/tsconfig.json` writes to `dist/renderer/`. `scripts/build-assets.js` then copies the static assets into these folders.

### 2.2 `scripts/build-assets.js`

New script with `node:fs`/`node:path`:

- Deletes `dist/renderer/assets/sprites` idempotently via `fs.rmSync(..., { recursive: true, force: true })`.
- Copies `src/renderer/index.html` → `dist/renderer/index.html`.
- Copies `src/main/mrr/settings.html` → `dist/main/mrr/settings.html`.
- Copies `assets/sprites` recursively → `dist/renderer/assets/sprites`.

### 2.3 `package.json` Changes

```diff
-  "description": "Pixel-art desktop beaver overlay for macOS",
+  "description": "Pixel-art desktop beaver overlay for macOS and Windows",
+  "author": "AI Beavers",

-    "build": "tsc && tsc -p src/renderer/tsconfig.json && cp src/renderer/index.html dist/renderer/index.html && mkdir -p dist/renderer/assets && rm -rf dist/renderer/assets/sprites && cp -R assets/sprites dist/renderer/assets/sprites && cp src/main/mrr/settings.html dist/main/mrr/settings.html",
+    "build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js",
```

### 2.4 Verification

```cmd
npm run build
```

Result:

```
> beaver-buddy@0.1.0 build
> tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js

Assets built successfully.
```

Files produced:

- `dist/renderer/index.html`
- `dist/main/mrr/settings.html`
- `dist/renderer/assets/sprites/beaver-baby.png`
- `dist/renderer/assets/sprites/beaver-baby.json`
- `dist/renderer/assets/sprites/beaver-teen.png`
- `dist/renderer/assets/sprites/beaver-teen.json`
- `dist/renderer/assets/sprites/lodge.png`
- `dist/renderer/assets/sprites/lodge.json`

---

## 3. BL-WIN-2: Windows Target + Icon Assets

### 3.1 Icon Generation

**Source:** `assets/sprites/beaver-baby.png` (192×192 sheet, first 96×96 idle tile).  
**Tool:** Python 3.13.14 + Pillow 12.1.1 (available locally, no new project dependency).

Command (inline, not stored in the repo):

```python
python - <<'PY'
from PIL import Image
import os

root = os.getcwd()
src = os.path.join(root, 'assets', 'sprites', 'beaver-baby.png')
dst_ico = os.path.join(root, 'assets', 'icon.ico')
dst_tray = os.path.join(root, 'assets', 'tray-icon.png')

sheet = Image.open(src).convert('RGBA')
tile = sheet.crop((0, 0, 96, 96))
scaled = tile.resize((192, 192), Image.NEAREST)
canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
canvas.paste(scaled, ((256 - 192) // 2, (256 - 192) // 2), scaled)

img256 = canvas
img128 = canvas.resize((128, 128), Image.NEAREST)
img48 = scaled.resize((48, 48), Image.NEAREST)
img32 = scaled.resize((32, 32), Image.NEAREST)
img16 = scaled.resize((16, 16), Image.NEAREST)

frames = [img256, img128, img48, img32, img16]
frames[0].save(dst_ico, append_images=frames[1:])

scaled.resize((32, 32), Image.NEAREST).save(dst_tray, format='PNG')
PY
```

**Design decisions:**

- The 96×96 idle tile is scaled to 192×192 with nearest-neighbor (exactly 2×).
- The 192×192 image is centered on a 256×256 canvas with a transparent border.
- The ICO contains the resolutions 16, 32, 48, 128, 256 px.
- Smaller resolutions (16, 32, 48) are generated from the 192×192 source with an integer factor to keep the pixel art sharp.
- 128×256 are derived from the padded 256×256 image (128 = 2× downsample).
- `tray-icon.png` is 32×32, generated from 192×192 with nearest-neighbor (6:1).

Verification:

```cmd
ls -la assets/icon.ico assets/tray-icon.png
```

```
-rw-r--r-- 1 rodgi 197609 21027 Jul 15 19:42 assets/icon.ico
-rw-r--r-- 1 rodgi 197609  1123 Jul 15 19:42 assets/tray-icon.png
```

```python
from PIL import Image
ico = Image.open('assets/icon.ico')
print(ico.info)
# {'sizes': {(16, 16), (32, 32), (48, 48), (128, 128), (256, 256)}}
```

### 3.2 `electron-builder.yml`

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

**Note:** `publisherName: AI Beavers` under `win:` was rejected by `electron-builder` 26.15.3 with a schema error. Instead, `"author": "AI Beavers"` was set in `package.json`.

### 3.3 Packaging Verification

```cmd
npx electron-builder --win --publish never
```

Result (truncated):

```
• electron-builder  version=26.15.3 os=10.0.26200
• loaded configuration  file=...\electron-builder.yml
• packaging       platform=win32 arch=x64 electron=43.1.0 appOutDir=release\win-unpacked
• building        target=nsis file=release\Beaver Buddy Setup 0.1.0.exe archs=x64
• building        target=portable file=release\Beaver Buddy 0.1.0.exe archs=x64
```

Files produced:

```cmd
ls -la release/*.exe
```

```
-rwxr-xr-x 1 rodgi 197609 164803555 Jul 15 19:45 release/Beaver Buddy 0.1.0.exe
-rwxr-xr-x 1 rodgi 197609 164987079 Jul 15 19:45 release/Beaver Buddy Setup 0.1.0.exe
```

Both files are present: an NSIS installer and a portable `.exe`.

---

## 4. BL-WIN-9: Extend CI with `windows-latest`

### 4.1 Preliminary Test on Windows

Before the CI extension, `npm test` was run locally on Windows:

```cmd
npm test
```

Result:

```
 Test Files  32 passed (32)
      Tests  292 passed | 6 skipped (298)
   Duration  4.51s
```

All tests pass on Windows (Node 22.x). No test changes needed.

### 4.2 `.github/workflows/ci.yml`

Matrix extended:

```yaml
jobs:
  ci:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
```

New steps:

```yaml
      - name: Build
        run: npm run build

      - name: Package Windows
        if: matrix.os == 'windows-latest'
        run: npx electron-builder --win --publish never

      - name: Upload Windows artifacts
        if: matrix.os == 'windows-latest'
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: release/*.exe
```

### 4.3 Dependency Correction

In the main plan `.flightplan/Archive/WINDOWS_PORT_PLAN.md`, the dependency of BL-WIN-9 on BL-WIN-5 was removed:

```diff
- **Dependencies:** BL-WIN-1, BL-WIN-2, BL-WIN-5.
+ **Dependencies:** BL-WIN-1, BL-WIN-2.
```

---

## 5. Node Version

Local environment: Node v22.19.0  
Project requirement: `engines.node: "24.x"`

`npm ci` was run locally:

```cmd
npm ci
```

Result:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'beaver-buddy@0.1.0',
npm warn EBADENGINE   required: { node: '24.x' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '11.14.1' }
npm warn EBADENGINE }

added 390 packages, and audited 391 packages in 14s
found 0 vulnerabilities
```

`npm ci` warns but does not abort. Therefore `engines.node` was **not** temporarily relaxed. CI continues to run explicitly with Node 24.x.

---

## 6. Summary of Commands and Results

| Command | Result |
|---------|--------|
| `npm ci` | ✅ Successful (warning about Node 22.x vs. 24.x, no error) |
| `npm run build` | ✅ Successful, all assets present |
| `npm test` | ✅ 32/32 test files, 292 passed, 6 skipped |
| `npx electron-builder --win --publish never` | ✅ Successful, `release/*.exe` produced |

---

## 7. Open Items / Blockers

- No blockers for Phase 1.
- A visual smoke test of the icon in the installer/Explorer/Task Manager is still pending (manual test).
- `electron-builder --mac --publish never` could not be verified locally because the environment is Windows. The macOS build should remain functional unchanged; check on macOS CI or hardware if needed.
- The Node version of the local development environment should be raised to 24.x outside this phase.
