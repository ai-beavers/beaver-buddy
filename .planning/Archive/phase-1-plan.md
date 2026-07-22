# Phase 1: Foundation — Detaillierter Umsetzungsplan

**Projekt:** Beaver Buddy (Electron-TypeScript-App)  
**Phase:** 1 / 5  
**Build-Items:** BL-WIN-1, BL-WIN-2, BL-WIN-9  
**Ziel:** App lässt sich auf Windows bauen, packen und in der CI testen.  
**Keine Source-Code-Änderungen in diesem Dokument — nur Planung.**

---

## 1. Zusammenfassung der Phase

Phase 1 legt das fundamentale Build-, Packaging- und CI-Gerüst für den Windows-Port. Die aktuelle Codebasis ist zwar überwiegend plattformneutral, aber der Build-Prozess (`package.json`) verwendet Unix-Shell-Kommandos (`cp`, `rm -rf`, `mkdir -p`), die unter Windows cmd/PowerShell fehlschlagen. Außerdem fehlt im `electron-builder.yml` ein Windows-Target, und die CI läuft ausschließlich auf `ubuntu-latest`.

In Phase 1 werden diese Blocker beseitigt, ohne neue Dependencies einzuführen und ohne Änderungen an der eigentlichen App-Logik (Overlay, Tray, Renderer) vorzunehmen. Die Phase ist abschließbar, sobald `npm run build` und `electron-builder --win --publish never` lokal auf Windows sowie im `windows-latest`-CI-Runner erfolgreich durchlaufen.

---

## 2. Konkrete Schritte pro Build-Item

### BL-WIN-1: Build-Scripts plattformunabhängig

**Scope:** `package.json`, neues `scripts/build-assets.js`.  
**Status:** Foundation-Blocker #1 — muss als Erstes gelöst werden.  
**Ziel:** `npm run build` läuft identisch unter Windows (cmd/PowerShell), macOS und Linux.

#### 2.1 Ist-Zustand analysieren

Aktuelles `package.json` (Zeile 12):

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && cp src/renderer/index.html dist/renderer/index.html && mkdir -p dist/renderer/assets && rm -rf dist/renderer/assets/sprites && cp -R assets/sprites dist/renderer/assets/sprites && cp src/main/mrr/settings.html dist/main/mrr/settings.html"
```

Probleme:
- `cp`, `cp -R` — Unix-only; Windows kennt diese Befehle nicht in cmd/PowerShell.
- `mkdir -p` — Unter Windows nur mit PowerShell verfügbar, nicht in cmd.
- `rm -rf` — Unix-only; unter Windows führt dies zu einem Fehler.
- Lange Shell-Kette ist schwer lesbar, schwer zu testen und brüchig bei Leerzeichen in Pfaden.

#### 2.2 Neues Skript `scripts/build-assets.js` erstellen

Ein Node-Skript ersetzt die Shell-Kette vollständig. Es verwendet ausschließlich `node:fs` und `node:path`, also plattformunabhängige Node-APIs.

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

// Lösche vorhandene Sprite-Zielordner (idempotent)
fs.rmSync(spritesDst, { recursive: true, force: true });

// Kopiere statische Assets
for (const { src, dst } of assets) {
  copyFile(src, dst);
}

// Kopiere Sprites rekursiv
copyDir(spritesSrc, spritesDst);

console.log('Assets built successfully.');
```

**Design-Entscheidungen:**
- `fs.rmSync(..., { recursive: true, force: true })` ist seit Node 14.14 verfügbar und funktioniert plattformunabhängig.
- `fs.copyFileSync` kopiert einzelne Dateien; `fs.readdirSync(..., { withFileTypes: true })` ermöglicht rekursives Kopieren ohne externe Tools.
- Keine zusätzlichen Dependencies; nur Node-Standardbibliothek.

#### 2.3 `package.json` anpassen

Neues `build`-Script:

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js"
```

Optional kann man `scripts/build-assets.js` als `.ts`-Datei mit einem eigenen `tsconfig.json` umsetzen. Das wäre aber Overhead, da das Skript nur Dateisystemoperationen ausführt und keinen TypeScript-Code benötigt. Ein CommonJS-`.js`-Skript ist ausreichend und minimiert Änderungen.

**Weitere Anpassungen in `package.json`:**
- `description` aktualisieren (falls gewünscht): `"Pixel-art desktop beaver overlay for macOS and Windows"` — dies ist aber nicht zwingend für Phase 1; empfohlen in BL-WIN-10.
- Keine neuen `scripts`, keine neuen `devDependencies`.

#### 2.4 Erwartetes Ergebnis

- `npm run build` läuft unter Windows cmd/PowerShell ohne Fehler durch.
- `dist/renderer/index.html`, `dist/main/mrr/settings.html` und `dist/renderer/assets/sprites/*` existieren nach dem Build.
- `npm run build` läuft weiterhin unter macOS und Linux identisch.

---

### BL-WIN-2: electron-builder Windows-Target + Icon-Assets

**Scope:** `electron-builder.yml`, Windows-Icon-Assets.  
**Abhängigkeit:** BL-WIN-1 (Build muss vor Packaging funktionieren).  
**Ziel:** `electron-builder --win` erzeugt `.exe` / `.nsis`-Installer; App zeigt Icon im Installer/Explorer.

#### 2.5 Ist-Zustand analysieren

Aktuelles `electron-builder.yml`:

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

Probleme:
- Nur `mac:`-Target konfiguriert; kein `win:`-Target.
- Kein Windows-Icon definiert.
- `files:` enthält `assets/**/*`, wodurch auch macOS-spezifische Assets im Windows-Build landen — das ist akzeptabel, solange keine Konflikte entstehen.

#### 2.6 Windows-Target in `electron-builder.yml` ergänzen

Zielkonfiguration:

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

**Design-Entscheidungen:**
- `target: nsis` — Standard-Installer für Windows; erzeugt `Beaver Buddy Setup.exe`.
- `target: portable` — Zusätzlich eine portable `.exe`, die ohne Installation läuft; nützlich für Smoke-Tests und QA.
- `icon: assets/icon.ico` — Windows benötigt `.ico` mit mehreren Auflösungen (16x16, 32x32, 48x48, 128x128, 256x256).
- `publisherName` wird nicht unter `win:` konfiguriert, da `electron-builder` 26.15.3 diesen Schlüssel ablehnt. Stattdessen wird `author` in `package.json` gesetzt (`"author": "AI Beavers"`), woraus `electron-builder` den Herausgeber ableitet.

#### 2.7 Icon-Assets generieren

**Ausgangslage:**
- Es gibt noch kein finales Windows-Icon.
- Vorhandene Sprite-Assets: `assets/sprites/beaver-baby.png`, `assets/sprites/beaver-teen.png`, `assets/sprites/lodge.png`.
- Aktuelles Tray-Asset: `assets/tray-iconTemplate.png` (macOS-Template, nicht für Windows geeignet).

**Vorgehen:**
1. Wähle ein geeignetes Quell-Sprite, z. B. `assets/sprites/beaver-baby.png` oder `assets/sprites/lodge.png`.
2. Generiere daraus ein farbiges `assets/tray-icon.png` (für Windows-Tray, ca. 16x16 bis 32x32 px, farbig, nicht transparent als Template).
3. Generiere `assets/icon.ico` mit mehreren Auflösungen (16, 32, 48, 128, 256 px) für App-Icon, Installer und Explorer.

**Option A: Manuelle Generierung mit einem Bildbearbeitungs-Tool**
- Öffne `assets/sprites/beaver-baby.png` in GIMP/Photoshop/Affinity.
- Extrahiere das erste 96×96-Idle-Tile.
- Skaliere mit nearest-neighbor auf 192×192 px (exakt 2×).
- Platziere das 192×192-Bild in einem 256×256-Canvas mit transparentem Rand (horizontal und vertikal zentriert).
- Exportiere `assets/tray-icon.png` als 32×32-Downsample (192→32 mit nearest-neighbor, 6:1).
- Exportiere Windows-Icon `assets/icon.ico` mit den Auflösungen 16, 32, 48, 128, 256 px; die 256×256-Version enthält das gepaddete Bild.

**Option B: Automatisierte Generierung via Node-Skript (empfohlen, falls Sharp verfügbar wäre)**
- Wird hier **nicht** empfohlen, weil `sharp` oder `canvas` neue native Dependencies wären und gegen die Randbedingung „Keine neuen Dependencies ohne Begründung“ verstoßen.
- Stattdessen: Erstelle ein kleines Node-Skript, das das vorhandene PNG in eine ICO-Datei umwandelt, **falls** ein passendes reines-JS-Tool gefunden wird. Andernfalls manuell generieren.

**Empfohlene Zwischenlösung für Phase 1:**
- Füge `assets/icon.ico` und `assets/tray-icon.png` manuell oder mit einem lokalen Konvertierungs-Tool hinzu.
- Dokumentiere in `assets/STYLE.md` oder einer neuen Datei, dass diese Icons temporär aus Sprite-Assets generiert sind und durch ein finales Design-Gate ersetzt werden müssen (siehe BL-WIN-10).

#### 2.8 Erwartetes Ergebnis

- `electron-builder --win --publish never` erzeugt im `release/`-Verzeichnis:
  - `Beaver Buddy Setup.exe` (NSIS-Installer)
  - `Beaver Buddy.exe` (portable Version)
- Das Windows-Icon wird im Installer, im Explorer und im Task-Manager angezeigt.
- Der macOS-Build (`electron-builder --mac`) bleibt unverändert funktionsfähig.

---

### BL-WIN-9: CI um `windows-latest` erweitern

**Scope:** `.github/workflows/ci.yml`.  
**Abhängigkeiten:** BL-WIN-1, BL-WIN-2.  
**Anmerkung:** BL-WIN-5 (Usage-Log-Pfade) ist zwar Phase-3-Item, aber für CI relevant, weil Tests unter Windows laufen müssen. Da BL-WIN-5 in Phase 1 noch nicht umgesetzt wird, müssen die CI-Schritte so konfiguriert werden, dass sie trotzdem grün werden — entweder weil die betroffenen Tests plattformneutral sind oder weil sie vorläufig auf Windows ausgeschlossen/angepasst werden. **In Phase 1 darf CI nur dann auf Windows laufen, wenn die bestehenden Tests dort bestehen.**

**Ziel:** CI-Matrix enthält `windows-latest`; `typecheck`, `lint`, `test`, `npm run build` und `electron-builder --win --publish never` sind grün.

#### 2.9 Ist-Zustand analysieren

Aktuelle `.github/workflows/ci.yml`:

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

Probleme:
- Nur ein einzelner Job auf `ubuntu-latest`.
- Kein Build-Schritt (`npm run build`), obwohl dieser für Packaging und Smoke-Tests essenziell ist.
- Kein Packaging-Schritt für Windows.

#### 2.10 CI-Matrix erweitern

Zielstruktur:

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

**Design-Entscheidungen:**
- `fail-fast: false` — Damit ein Fehler auf Windows nicht sofort den Ubuntu-Job abbricht und umgekehrt.
- `matrix.os: [ubuntu-latest, windows-latest]` — Erweiterung auf Windows. `macos-latest` ist vorerst optional; da der ursprüngliche Fokus macOS war und die macOS-Build-Kosten in GitHub Actions höher sind, kann macOS später ergänzt werden (z. B. in BL-WIN-10).
- Node-Version bleibt bei `24`, wie vom Projekt gefordert.
- `npm run build` wird vor Packaging ausgeführt, damit `dist/` existiert.
- `npx electron-builder --win --publish never` wird nur auf Windows ausgeführt, da macOS/Linux keine Windows-Installer erzeugen können.

#### 2.11 Umgang mit fehlenden Windows-Abhängigkeiten in CI

- `electron-builder` ist bereits als `devDependency` vorhanden.
- Windows-CI-Runner haben .NET/Visual Studio Build Tools vorinstalliert, sodass `electron-builder` native Abhängigkeiten (z. B. für `app-builder-lib`) normalerweise ohne Zusatzaufwand kompiliert.
- Falls der Windows-Build an fehlenden Build-Tools scheitert, kann `npm install --global windows-build-tools` oder die Nutzung von `actions/setup-python` helfen. Das sollte aber nicht nötig sein.

#### 2.12 Erwartetes Ergebnis

- CI läuft auf `ubuntu-latest` und `windows-latest`.
- Alle Schritte (`typecheck`, `lint`, `test`, `build`, `electron-builder --win --publish never`) sind auf beiden Plattformen grün.
- Build-Artifakte (optional) können als GitHub Actions Artifacts hochgeladen werden, um den Windows-Installer herunterzuladen.

---

## 3. Abhängigkeiten zwischen den Build-Items

```
BL-WIN-1 (Build-Scripts)
    │
    ▼
BL-WIN-2 (electron-builder Windows-Target)
    │
    ▼
BL-WIN-9 (CI Windows-Runner)
```

| Abhängigkeit | Begründung |
|--------------|------------|
| BL-WIN-2 → BL-WIN-1 | `electron-builder` setzt voraus, dass `npm run build` funktioniert, damit `dist/` vorliegt. Ohne plattformunabhängigen Build kann das Packaging auf Windows nicht gestartet werden. |
| BL-WIN-9 → BL-WIN-1 | CI führt `npm run build` aus; dies muss auf Windows funktionieren. |
| BL-WIN-9 → BL-WIN-2 | CI führt `electron-builder --win` aus; dies erfordert die Windows-Konfiguration und das Icon-Asset. |

**Reihenfolge:** BL-WIN-1 → BL-WIN-2 → BL-WIN-9.

---

## 4. Akzeptanzkriterien für die gesamte Phase

1. **BL-WIN-1 erfüllt:**
   - `npm run build` läuft lokal auf Windows (cmd und PowerShell) ohne Fehler.
   - `npm run build` läuft weiterhin lokal auf macOS und Linux ohne Fehler.
   - Alle erwarteten Dateien (`dist/renderer/index.html`, `dist/main/mrr/settings.html`, `dist/renderer/assets/sprites/*`) sind nach dem Build vorhanden.

2. **BL-WIN-2 erfüllt:**
   - `electron-builder --win --publish never` erzeugt im `release/`-Verzeichnis einen NSIS-Installer (`*.exe`) und eine portable Version (`*.exe`).
   - Das Windows-Icon wird im Installer, im Explorer und im Task-Manager korrekt angezeigt (manueller visueller Smoke-Test).
   - `electron-builder --mac --publish never` bleibt funktionsfähig (keine Regression).

3. **BL-WIN-9 erfüllt:**
   - Die CI-Matrix enthält `windows-latest` zusätzlich zu `ubuntu-latest`.
   - Alle CI-Jobs (`typecheck`, `lint`, `test`, `build`, `package-windows`) sind grün.
   - Fehlschläge auf einer Plattform brechen die andere nicht ab (`fail-fast: false`).

4. **Cross-Plattform-Regressionen ausgeschlossen:**
   - Keine Änderungen an Source-Dateien außerhalb der Build-/CI-Konfiguration.
   - Keine neuen Dependencies eingeführt.
   - Bestehende macOS-Funktionalität (Build, Packaging) bleibt erhalten.

---

## 5. Risiken und wie sie gemindert werden

| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| **Icon-Generierung aus Sprites ist manuell/fehleranfällig** | Windows-Icon könnte unscharf oder in falscher Größe geraten. | Pixel-Art mit nearest-neighbor skalieren; mehrere Auflösungen (16–256 px) im `.ico` ablegen; visuellen Smoke-Test im Installer/Explorer machen. |
| **Node 24.x nicht in lokaler Umgebung verfügbar** | Lokale Tests laufen auf Node 22.x; potenzielle Inkompatibilitäten. | CI explizit auf Node 24.x konfigurieren; `npm ci` warnt auf Node 22.x, bricht aber nicht ab, daher bleibt `engines.node` auf `24.x`. Lokale Entwicklungsumgebung zeitnah auf Node 24.x aktualisieren (außerhalb dieser Phase). |
| **electron-builder auf Windows benötigt Build-Tools** | CI könnte wegen fehlender VC++ Build Tools fehlschlagen. | GitHub Actions `windows-latest` hat Build Tools vorinstalliert; bei Fehlern alternativ `windows-2019` oder explizite Setup-Steps ergänzen. |
| **Bestehende Tests sind auf Windows nicht plattformneutral** | CI-Test-Schritt könnte auf Windows rot werden, obwohl Phase 1 keine Teständerungen vorsieht. | Vor Merge Phase 1 kurz prüfen, ob Tests auf Windows laufen; falls nicht, Testfix entweder in Phase 1 (minimal) oder in Phase 3 (BL-WIN-5) einplanen. |
| **Lange CI-Laufzeiten durch Windows-Runner** | Feedback-Schleifen werden langsamer. | Nur `typecheck`, `lint`, `test`, `build` und Windows-Packaging ausführen; macOS-CI vorerst weglassen. |
| **Fehlende Code-Signing-Warnungen** | Windows Defender SmartScreen warnt vor unsigniertem Installer. | Akzeptiert für Phase 1; echtes Code-Signing als späteres Build-Item planen. |

---

## 6. Test- und Verifikationsschritte

### 6.1 Lokale Verifikation (Windows)

1. **Build-Script testen:**
   ```cmd
   npm run build
   ```
   - Erwartung: Kein Fehler, `dist/renderer/index.html`, `dist/main/mrr/settings.html`, `dist/renderer/assets/sprites/*` vorhanden.

2. **Packaging testen:**
   ```cmd
   npx electron-builder --win --publish never
   ```
   - Erwartung: `release/Beaver Buddy Setup.exe` und `release/Beaver Buddy.exe` erzeugt.

3. **Installer-Smoke-Test:**
   - `Beaver Buddy Setup.exe` ausführen (lokale Testinstallation).
   - Prüfen, ob App startet, Icon im Task-Manager/Explorer sichtbar ist, kein Crash beim Start.

4. **Portable-Version testen:**
   - `Beaver Buddy.exe` starten.
   - Erwartung: App läuft ohne Installation; Overlay erscheint (ggf. noch mit Phase-2-Problemen, aber kein sofortiger Crash).

### 6.2 Lokale Verifikation (macOS/Linux)

1. **Build-Script testen:**
   ```bash
   npm run build
   ```
   - Erwartung: Identisches Ergebnis wie vor der Änderung.

2. **macOS-Packaging-Regression testen:**
   ```bash
   npx electron-builder --mac --publish never
   ```
   - Erwartung: `release/Beaver Buddy.dmg` wird erzeugt.

### 6.3 CI-Verifikation

1. **Workflow auf Feature-Branch auslösen:**
   - Push auf einen Branch mit offenem Pull-Request.
   - `.github/workflows/ci.yml` wird auf `ubuntu-latest` und `windows-latest` ausgeführt.

2. **Erfolgskriterien prüfen:**
   - Beide Jobs grün.
   - `Package Windows`-Schritt erzeugt Installer/Portable.

3. **Optional: Artifacts hochladen**
   Falls QA den Installer herunterladen soll, kann ein Upload-Step ergänzt werden:
   ```yaml
   - name: Upload Windows artifacts
     if: matrix.os == 'windows-latest'
     uses: actions/upload-artifact@v4
     with:
       name: windows-installer
       path: release/*.exe
   ```
   Dies ist für Phase 1 optional, aber empfohlen, um manuelle Smoke-Tests zu ermöglichen.

---

## 7. Dateien, die in Phase 1 angefasst werden

| Datei / Pfad | Build-Item | Art der Änderung |
|--------------|------------|------------------|
| `package.json` | BL-WIN-1 | `build`-Script anpassen |
| `scripts/build-assets.js` (neu) | BL-WIN-1 | Neues Node-Skript erstellen |
| `electron-builder.yml` | BL-WIN-2 | `win:`-Target ergänzen |
| `assets/icon.ico` (neu) | BL-WIN-2 | Aus Sprite-Asset generieren |
| `assets/tray-icon.png` (neu) | BL-WIN-2 | Aus Sprite-Asset generieren (für spätere Tray-Anpassung in BL-WIN-4) |
| `.github/workflows/ci.yml` | BL-WIN-9 | Matrix erweitern, Build- und Packaging-Steps ergänzen |

**Nicht angefasst werden in Phase 1:**
- `src/main/main.ts`
- `src/main/tray.ts`
- `src/main/usage/paths.ts`
- `src/main/atomic-file.ts`
- `src/renderer/renderer.ts`
- Alle Test-Dateien (außer falls CI-Tests auf Windows rot laufen — dann minimaler Ausgleich)

---

## 8. Nächste Schritte nach Phase 1

- **Phase 2: Core Windows Experience** — BL-WIN-3 (Overlay-Adapter) und BL-WIN-4 (Tray-Adapter).
- **Phase 3: Windows Integrations** — BL-WIN-5 (Claude-Usage-Log-Pfade).
- **Phase 4: Polish & Release-Readiness** — BL-WIN-8 (HiDPI/Scaling) und BL-WIN-10 (Doku/Design-Gate).
- **Phase 5: Deferred / Follow-up** — BL-WIN-6 (Keychain/Secrets), BL-WIN-7 (atomares Schreiben), Codex-Tracking.

---

## 9. Zusammenfassung für Stakeholder

Phase 1 macht Beaver Buddy auf Windows **bau- und paketierbar**, ohne die App-Logik zu verändern. Die drei Build-Items bauen aufeinander auf: zuerst das plattformunabhängige Build-Skript, dann die Windows-Packaging-Konfiguration mit temporären Icons, schließlich die CI-Erweiterung auf `windows-latest`. Nach Abschluss kann das Team Windows-Installer aus der CI herunterladen und mit Phase 2 (Overlay/Tray-Verhalten) fortfahren.
