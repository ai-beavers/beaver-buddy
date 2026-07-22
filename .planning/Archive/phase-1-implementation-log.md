# Phase 1: Foundation — Implementationslog

**Datum:** 2026-07-15
**Build-Items:** BL-WIN-1, BL-WIN-2, BL-WIN-9
**Lokale Umgebung:** Windows 10.0.26200, Node v22.19.0, npm 11.14.1
**CI-Ziel:** Node 24.x, `ubuntu-latest` + `windows-latest`

---

## 1. Geänderte Dateien

| Datei | Build-Item | Änderung |
|-------|------------|----------|
| `package.json` | BL-WIN-1, BL-WIN-2 | `build`-Script plattformunabhängig gemacht, `description` aktualisiert, `author` hinzugefügt |
| `scripts/build-assets.js` | BL-WIN-1 | Neues Node-Skript zur plattformunabhängigen Asset-Kopie |
| `electron-builder.yml` | BL-WIN-2 | `win:`-Target (nsis + portable), Icon, NSIS-Installer/Uninstaller-Icon |
| `assets/icon.ico` | BL-WIN-2 | Neues Windows-Icon aus `assets/sprites/beaver-baby.png` generiert |
| `assets/tray-icon.png` | BL-WIN-2 | Neues farbiges 32×32-Tray-Icon aus demselben Sprite |
| `.github/workflows/ci.yml` | BL-WIN-9 | Matrix `ubuntu-latest` + `windows-latest`, Build- und Packaging-Steps, Artifact-Upload |
| `.flightplan/Archive/phase-1-plan.md` | Dokumentation | Node-Version-Hinweis, Icon-Skalierung präzisiert, `publisherName`-Hinweis, BL-WIN-9-Abhängigkeit korrigiert |
| `.flightplan/Archive/WINDOWS_PORT_PLAN.md` | Dokumentation | BL-WIN-9-Abhängigkeit von BL-WIN-5 entfernt |

---

## 2. BL-WIN-1: Build-Scripts plattformunabhängig

### 2.1 Analyse `src/renderer/tsconfig.json`

`src/renderer/tsconfig.json` definiert korrekt:

```json
"outDir": "../../dist/renderer"
```

`tsconfig.json` (Root) definiert:

```json
"rootDir": "src",
"outDir": "dist"
```

Damit schreibt `tsc` nach `dist/main/` und `tsc -p src/renderer/tsconfig.json` nach `dist/renderer/`. `scripts/build-assets.js` kopiert anschließend die statischen Assets in diese Ordner.

### 2.2 `scripts/build-assets.js`

Neues Skript mit `node:fs`/`node:path`:

- Löscht `dist/renderer/assets/sprites` idempotent via `fs.rmSync(..., { recursive: true, force: true })`.
- Kopiert `src/renderer/index.html` → `dist/renderer/index.html`.
- Kopiert `src/main/mrr/settings.html` → `dist/main/mrr/settings.html`.
- Kopiert `assets/sprites` rekursiv → `dist/renderer/assets/sprites`.

### 2.3 `package.json`-Änderungen

```diff
-  "description": "Pixel-art desktop beaver overlay for macOS",
+  "description": "Pixel-art desktop beaver overlay for macOS and Windows",
+  "author": "AI Beavers",

-    "build": "tsc && tsc -p src/renderer/tsconfig.json && cp src/renderer/index.html dist/renderer/index.html && mkdir -p dist/renderer/assets && rm -rf dist/renderer/assets/sprites && cp -R assets/sprites dist/renderer/assets/sprites && cp src/main/mrr/settings.html dist/main/mrr/settings.html",
+    "build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js",
```

### 2.4 Verifikation

```cmd
npm run build
```

Ergebnis:

```
> beaver-buddy@0.1.0 build
> tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js

Assets built successfully.
```

Erzeugte Dateien:

- `dist/renderer/index.html`
- `dist/main/mrr/settings.html`
- `dist/renderer/assets/sprites/beaver-baby.png`
- `dist/renderer/assets/sprites/beaver-baby.json`
- `dist/renderer/assets/sprites/beaver-teen.png`
- `dist/renderer/assets/sprites/beaver-teen.json`
- `dist/renderer/assets/sprites/lodge.png`
- `dist/renderer/assets/sprites/lodge.json`

---

## 3. BL-WIN-2: Windows-Target + Icon-Assets

### 3.1 Icon-Generierung

**Quelle:** `assets/sprites/beaver-baby.png` (192×192-Sheet, erstes 96×96-Idle-Tile).  
**Tool:** Python 3.13.14 + Pillow 12.1.1 (lokal verfügbar, keine neue Projektabhängigkeit).

Befehl (inline, nicht im Repo gespeichert):

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

**Design-Entscheidungen:**

- 96×96-Idle-Tile wird nearest-neighbor auf 192×192 skaliert (exakt 2×).
- 192×192-Bild wird in 256×256-Canvas mit transparentem Rand zentriert.
- ICO enthält die Auflösungen 16, 32, 48, 128, 256 px.
- Kleinere Auflösungen (16, 32, 48) werden aus der 192×192-Quelle mit integerem Faktor generiert, um die Pixel-Art scharf zu halten.
- 128×256 werden aus dem gepaddeten 256×256-Bild abgeleitet (128 = 2×-Downsample).
- `tray-icon.png` ist 32×32, generiert aus 192×192 mit nearest-neighbor (6:1).

Verifikation:

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

**Hinweis:** `publisherName: AI Beavers` unter `win:` wurde von `electron-builder` 26.15.3 mit einem Schema-Fehler abgelehnt. Stattdessen wurde `"author": "AI Beavers"` in `package.json` gesetzt.

### 3.3 Verifikation Packaging

```cmd
npx electron-builder --win --publish never
```

Ergebnis (gekürzt):

```
• electron-builder  version=26.15.3 os=10.0.26200
• loaded configuration  file=...\electron-builder.yml
• packaging       platform=win32 arch=x64 electron=43.1.0 appOutDir=release\win-unpacked
• building        target=nsis file=release\Beaver Buddy Setup 0.1.0.exe archs=x64
• building        target=portable file=release\Beaver Buddy 0.1.0.exe archs=x64
```

Erzeugte Dateien:

```cmd
ls -la release/*.exe
```

```
-rwxr-xr-x 1 rodgi 197609 164803555 Jul 15 19:45 release/Beaver Buddy 0.1.0.exe
-rwxr-xr-x 1 rodgi 197609 164987079 Jul 15 19:45 release/Beaver Buddy Setup 0.1.0.exe
```

Beide Dateien sind vorhanden: ein NSIS-Installer und eine portable `.exe`.

---

## 4. BL-WIN-9: CI um `windows-latest` erweitern

### 4.1 Vorab-Test unter Windows

Vor der CI-Erweiterung wurde `npm test` lokal auf Windows ausgeführt:

```cmd
npm test
```

Ergebnis:

```
 Test Files  32 passed (32)
      Tests  292 passed | 6 skipped (298)
   Duration  4.51s
```

Alle Tests bestehen auf Windows (Node 22.x). Keine Test-Änderungen nötig.

### 4.2 `.github/workflows/ci.yml`

Matrix erweitert:

```yaml
jobs:
  ci:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
```

Neue Steps:

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

### 4.3 Abhängigkeitskorrektur

Im Hauptplan `.flightplan/Archive/WINDOWS_PORT_PLAN.md` wurde die Abhängigkeit von BL-WIN-9 auf BL-WIN-5 entfernt:

```diff
- **Abhängigkeiten:** BL-WIN-1, BL-WIN-2, BL-WIN-5.
+ **Abhängigkeiten:** BL-WIN-1, BL-WIN-2.
```

---

## 5. Node-Version

Lokale Umgebung: Node v22.19.0  
Projekt-Vorgabe: `engines.node: "24.x"`

`npm ci` wurde lokal ausgeführt:

```cmd
npm ci
```

Ergebnis:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'beaver-buddy@0.1.0',
npm warn EBADENGINE   required: { node: '24.x' },
npm warn EBADENGINE   current: { node: 'v22.19.0', npm: '11.14.1' }
npm warn EBADENGINE }

added 390 packages, and audited 391 packages in 14s
found 0 vulnerabilities
```

`npm ci` warnt, bricht aber nicht ab. Daher wurde `engines.node` **nicht** vorübergehend gelockert. CI läuft weiterhin explizit mit Node 24.x.

---

## 6. Zusammenfassung der Befehle und Ergebnisse

| Befehl | Ergebnis |
|--------|----------|
| `npm ci` | ✅ Erfolgreich (Warnung wegen Node 22.x vs. 24.x, kein Fehler) |
| `npm run build` | ✅ Erfolgreich, alle Assets vorhanden |
| `npm test` | ✅ 32/32 Test-Dateien, 292 passed, 6 skipped |
| `npx electron-builder --win --publish never` | ✅ Erfolgreich, `release/*.exe` erzeugt |

---

## 7. Offene Punkte / Blocker

- Keine Blocker für Phase 1.
- Visueller Smoke-Test des Icons im Installer/Explorer/Task-Manager ist noch ausstehend (manueller Test).
- `electron-builder --mac --publish never` konnte lokal nicht verifiziert werden, da die Umgebung Windows ist. Der macOS-Build sollte unverändert funktionsfähig bleiben; gegebenenfalls auf macOS-CI oder -Hardware prüfen.
- Node-Version der lokalen Entwicklungsumgebung sollte außerhalb dieser Phase auf 24.x angehoben werden.
