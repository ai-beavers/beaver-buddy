# Beaver Buddy — Cross-Platform / Windows-Implementation Plan

**Status:** Phase 1, 2, 3 und 4 abgeschlossen. Phase 5 teilweise abgeschlossen — BL-WIN-7 und Codex-Tracking sind umgesetzt; BL-WIN-6 (Windows Secret-Store / MRR-Mode) bleibt bis zur Admin-Entscheidung zurückgestellt.  
**Ziel:** Beaver Buddy als cross-platform Electron-App für macOS und Windows
aufbauen; aktueller Fokus liegt auf der **Windows-Implementation**.  
**Scope-Entscheidung:** Siehe ADR 002 (`docs/adr/002-cross-platform-scope.md`).  
**Ausgangsbasis:** Electron-App mit macOS-spezifischen Annahmen (Node 24.x,
Electron 43.1.0, TypeScript strict).

---

## Gesamtstatus

| Phase | Status | Build-Items |
|-------|--------|-------------|
| **Phase 1: Foundation** | ✅ Abgeschlossen | BL-WIN-1, BL-WIN-2, BL-WIN-9 |
| **Phase 2: Core Windows Experience** | ✅ Abgeschlossen | BL-WIN-3, BL-WIN-4 |
| **Phase 3: Windows Integrations** | ✅ Abgeschlossen | BL-WIN-5 |
| **Phase 4: Polish & Release-Readiness** | ✅ Abgeschlossen | BL-WIN-8, BL-WIN-10 |
| **Phase 5: Deferred / Follow-up** | ✅ Teilweise abgeschlossen | BL-WIN-7 ✅, Codex-Tracking ✅, BL-WIN-6 ⏸️ zurückgestellt |
| **Post-Phase-5 Bugfix: Single-Instance-Schutz** | ✅ Abgeschlossen | Doppelte App-Instanzen werden verhindert (`app.requestSingleInstanceLock`). |

---

## 1. Zusammenfassung / Executive Summary

Die Codebasis ist überwiegend plattformneutral. Die harten Blocker für die
Windows-Implementation sitzen in vier Bereichen:

1. **Build & Packaging:** `npm run build` verwendet Unix-Shell-Kommandos;
   `electron-builder.yml` hat kein `win:`-Target.
2. **Overlay-Fenster:** `setAlwaysOnTop(true, 'floating')` platziert das Fenster
   auf Windows **unter die Taskleiste**; der Biber würde am unteren Rand
   verschwinden.
3. **Tray:** `setTemplateImage(true)` und das Template-PNG sind macOS-only.
4. **Secrets:** `security`-CLI für den macOS-Keychain hat kein Windows-Pendant.
5. **Usage-Logs:** Der Legacy-Pfad `~/.claude` funktioniert auf Windows bereits
   (`%USERPROFILE%\.claude`). Der XDG-Pfad `~/.config/claude` ist auf Windows
   nicht dokumentiert und muss geprüft/ersetzt werden.
6. **HiDPI/Scaling:** Der Canvas-Renderer arbeitet in logischen Pixeln; auf
   Windows mit 125 %/150 %/200 % Skalierung muss das Canvas physikalisch um den
   DPR skaliert werden, damit die Pixel-Art scharf bleibt.

Renderer, Sprite-Animation und State-Logik sind weitgehend portabel. Die
größten Unsicherheiten sind die Windows-Z-Order des Overlays und die Wahl eines
robusten Windows-Secret-Stores.

---

## 2. Gefundene plattformspezifische Stellen

| # | Datei:Zeile | Problem | Schwere |
|---|-------------|---------|---------|
| 1 | `package.json:12` | Build-Script nutzt `cp`, `rm -rf`, `mkdir -p` (Unix-only). | Blocker |
| 2 | `electron-builder.yml:9-12` | Nur `mac:`-Target konfiguriert, kein `win:`. | Blocker |
| 3 | `src/main/main.ts:118` | `setAlwaysOnTop(true, 'floating')` — auf Windows unter der Taskleiste. | Blocker |
| 4 | `src/main/tray.ts:82-84` | `setTemplateImage(true)` und `tray-iconTemplate.png` sind macOS-only. | Blocker |
| 5 | `src/main/mrr/keychain.ts:54-85` | Nutzt macOS-`security`-CLI zum Lesen/Schreiben/Löschen von Secrets. | Blocker |
| 6 | `src/main/usage/paths.ts:40` | XDG-Pfad `~/.config/claude` ist auf Windows nicht dokumentiert. | Mittel |
| 7 | `src/main/atomic-file.ts:18` | `fs.renameSync` kann auf Windows bei transienten Locks (`EPERM`) fehlschlagen. | Mittel |
| 8 | `.github/workflows/ci.yml:17` | CI läuft nur auf `ubuntu-latest`. | Mittel |
| 9 | `src/renderer/renderer.ts:81-82` | Canvas arbeitet in logischen Pixeln; auf Windows-HiDPI möglicherweise unscharf. | Niedrig-Mittel |
| 10 | `assets/tray-iconTemplate.png` | Kein Windows-Icon-Asset (`.ico`/farbiges PNG). | Mittel |

---

## 3. Architekturentscheidungen

### 3.1 Plattform-Adapter statt `if (platform)`-Spaghetti

Für Keychain, Usage-Paths und ggf. Overlay/Tray werden kleine Adapter-Module
eingeführt:

```text
src/main/mrr/keychain.ts          → Interface + Factory
src/main/mrr/keychain-darwin.ts   → bestehende security-CLI-Logik
src/main/mrr/keychain-win32.ts    → Windows secure storage
src/main/usage/paths.ts           → plattformabhängige Defaults beibehalten/erweitern
```

Vorteil: Testbarkeit, klare Trennung, spätere Erweiterbarkeit.

### 3.2 Secret-Storage auf Windows

Optionen:

| Option | Umsetzung | Vor- / Nachteile |
|--------|-----------|------------------|
| A. Windows Credential Manager | PowerShell `CredentialManager`-Modul oder `cmdkey.exe` + ggf. kleiner Native-Addon | Nativer Store, CLI-Abhängigkeit, komplexere Tests, Lesen von Secrets eingeschränkt. |
| B. `electron.safeStorage` + verschlüsselte JSON im `userData` | DPAPI-verschlüsselt, keine externe CLI | Einfach, keine neue Dependency, verstößt historisch gegen CLAUDE.md („secrets never in app-support dir“) — erfordert ADR/Scope-Update. |
| C. `keytar`-ähnliche Dependency | Würde native Bindings erfordern; CLAUDE.md erschwert neue Dependencies. | Vermeiden. |

**Empfehlung:** Option A (Windows Credential Manager) als primärer Weg prüfen;
Option B (`safeStorage`) als dokumentierter Fallback, falls Option A zu
instabil oder zu aufwändig ist.

### 3.3 Overlay-Verhalten auf Windows

**Entscheidung:** Der Biber darf niemals hinter der Windows-Taskleiste
verschwinden. Er muss immer sauber sichtbar sein und am unteren Bildschirmrand
laufen, ohne verdeckt zu werden — auch bei Auto-Hide-Taskleiste und bei
Taskleisten an beliebiger Position (unten, oben, links, rechts).

Umsetzung:

- Auf macOS: `setAlwaysOnTop(true, 'floating')` beibehalten.
- Auf Windows: `setAlwaysOnTop(true, 'normal')` oder `'pop-up-menu'` verwenden,
  um das Overlay über normalen Fenstern zu halten, ohne Screensaver-Ebene zu
  erreichen.
- Die Roaming-Bounds und Hatch-Position orientieren sich nicht an der
  Bildschirmauflösung, sondern an der tatsächlich verfügbaren Arbeitsfläche
  **abzüglich Taskleiste**.
- Taskleisten-Detektion:
  - Primär: `screen.getPrimaryDisplay().workArea` vs. `bounds` vergleichen.
  - Sekundär (falls `workArea` bei Auto-Hide ungenau ist): Windows-AppBar/
    Taskleisten-API nutzen, um die reservierte Taskleisten-Region zu ermitteln.
- Bei Änderungen der Taskleisten-Sichtbarkeit/Position wird die workArea neu
  berechnet und der Biber sanft in die verfügbare Fläche zurückgeführt (kein
  Sprung, sondern neues Roaming-Ziel oberhalb der Taskleiste).
- `skipTaskbar: true`, `focusable: false`, `transparent: true` beibehalten.
- Akzeptanztest: Klick-Through, kein Fokus-Diebstahl, kein Taskleisten-Eintrag,
  Biber bleibt immer über/sichtbar neben der Taskleiste, Überleben von
  Vollbild-Anwendungen.

### 3.4 Build-Script

Ein neues Node-Skript `scripts/build-assets.js` ersetzt die Unix-Kette:

```js
fs.rmSync('dist/renderer/assets/sprites', { recursive: true, force: true });
fs.mkdirSync('dist/renderer/assets', { recursive: true });
fs.cpSync('assets/sprites', 'dist/renderer/assets/sprites', { recursive: true });
fs.cpSync('src/renderer/index.html', 'dist/renderer/index.html');
fs.cpSync('src/main/mrr/settings.html', 'dist/main/mrr/settings.html');
```

`package.json` Build-Script verkürzt sich auf:

```json
"build": "tsc && tsc -p src/renderer/tsconfig.json && node scripts/build-assets.js"
```

### 3.5 Packaging & Icons

`electron-builder.yml` erweitern:

```yaml
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
  publisherName: AI Beavers
```

**Icons (vorläufig):**

- Es gibt noch kein finales Master-Icon.
- Vorerst wird `assets/icon.ico` und ein farbiges `assets/tray-icon.png` aus den
  bestehenden Sprite-Assets (z. B. `assets/sprites/beaver-baby.png` oder
  `assets/sprites/lodge.png`) generiert.
- Tray-Icon = gleiches Beaver-Icon in Farbe (Entscheidung Punkt 5).
- Später muss ein Design-Gate ein echtes, hochauflösendes Master-Icon liefern
  und die generierten Icons ersetzen.

**Code-Signing:**

- Vorerst Out-of-Scope (Entscheidung Punkt 6).
- Der NSIS/Portable-Installer wird unsigniert erzeugt; Windows Defender
  SmartScreen-Warnung wird akzeptiert.
- Echtes Code-Signing kann später als eigenes Build-Item nachgereicht werden.

### 3.6 Usage-Log-Pfade

- Legacy-Pfad `~/.claude` bleibt erhalten und funktioniert auf Windows
  automatisch (`%USERPROFILE%\.claude`).
- XDG-Pfad `~/.config/claude` wird auf Windows nicht geprüft, da nicht
  dokumentiert.
- `CLAUDE_CONFIG_DIR` bleibt als Override mit höchster Priorität.
- **Codex-Tracking auf Windows ist vorerst zurückgestellt** (siehe
  „Verschobene Aufgaben“).

### 3.7 HiDPI/Scaling auf Windows

**Entscheidung:** Der Renderer skaliert das Canvas physikalisch um den
`devicePixelRatio` (DPR), während alle Spielwelt-Koordinaten (Roaming, Hatch,
Bubble, Dirty Rects) in logischen Pixeln bleiben.

Umsetzung:

- `canvas.width`/`canvas.height` = `logicalBounds * DPR` (gerundet).
- `canvas.style.width`/`canvas.style.height` = logische Bounds.
- `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` statt kumulativer `scale()`.
- `ctx.imageSmoothingEnabled = false` bleibt aktiv.
- `bounds()` gibt logische Bounds zurück; kein Code interpretiert
  `canvas.width/height` als logische Größe.
- `ctx.clearRect(0, 0, bounds().width, bounds().height)` löscht den gesamten
  physikalischen Canvas durch die transformierte logische Größe.
- DPR-Änderungen werden zusätzlich zu `onBoundsChanged` über einen
  `window.resize`-Listener erfasst, der `window.devicePixelRatio` mit dem
  zuletzt bekannten Wert vergleicht.

---

## 4. Build-Items (Reihenfolge)

### BL-WIN-1: Build-Scripts plattformunabhängig ✅
- **Scope:** `package.json`, neues `scripts/build-assets.js`.
- **Akzeptanz:** `npm run build` läuft unter Windows cmd/PowerShell, macOS und Linux identisch.
- **Abhängigkeiten:** Keine.
- **Status:** Abgeschlossen. `package.json:build` ruft nun `node scripts/build-assets.js` auf; alle Assets werden plattformunabhängig via `node:fs`/`node:path` kopiert.

### BL-WIN-2: electron-builder Windows-Konfiguration ✅
- **Scope:** `electron-builder.yml`, Windows-Icon-Assets.
- **Akzeptanz:** `electron-builder --win` erzeugt `.exe`/`.nsis`-Installer; App zeigt Icon im Installer/Explorer.
- **Abhängigkeiten:** BL-WIN-1.
- **Status:** Abgeschlossen. `win:`-Target mit `nsis` + `portable`, `assets/icon.ico` und `assets/tray-icon.png` hinzugefügt. `author` in `package.json` auf "AI Beavers" gesetzt (Herausgeber für Windows-Installer).

### BL-WIN-3: Overlay-Windows-Adapter ✅
- **Scope:** `src/main/overlay-adapter.ts`, `src/main/main.ts`, `src/main/ipc-channels.ts`,
  `src/main/preload.ts`, `src/renderer/renderer.ts`, `src/renderer/roam.ts`.
- **Akzeptanz:**
  - Plattformabhängiger `setAlwaysOnTop`-Aufruf.
  - Taskleiste wird erkannt und die verfügbare Arbeitsfläche wird an die
    Taskleisten-Region angepasst.
  - Biber bleibt bei sichtbarer Taskleiste am unteren Rand sichtbar und wird nicht
    von der Taskleiste verdeckt.
  - Smoke-Test bestätigt Klick-Through und keinen Fokus-Diebstahl.
- **Abhängigkeiten:** Keine.
- **Status:** Abgeschlossen. `configureAlwaysOnTop` wählt auf macOS `floating`, auf
  Windows/Linux `normal`. `fitWindowToWorkArea` richtet das Fenster auf die Work-Area
  des primären Displays aus; Änderungen werden dedupliziert und über `state:bounds`
  an den Renderer gesendet.

### BL-WIN-4: Tray-Windows-Adapter ✅
- **Scope:** `src/main/tray.ts`, Windows-Tray-Asset.
- **Akzeptanz:** Unter Windows wird farbiges `.ico`/PNG geladen; unter macOS bleibt Template-Image-Verhalten erhalten; Tray-Menü funktioniert.
- **Abhängigkeiten:** BL-WIN-2 (für Asset).
- **Status:** Abgeschlossen. `loadTrayIcon` lädt auf Windows/Linux `assets/tray-icon.png`
  und ruft `setTemplateImage` nur auf macOS auf.

### BL-WIN-5: Claude-Usage-Log-Path-Windows-Adapter ✅
- **Scope:** `src/main/usage/paths.ts`, `paths.test.ts`.
- **Akzeptanz:** `discoverPaths()` funktioniert auf Windows für Claude Code
  (`%USERPROFILE%\.claude`, ggf. `CLAUDE_CONFIG_DIR`); XDG-Pfad wird auf Windows
  ignoriert; Codex-Pfade bleiben unverändert (vorerst zurückgestellt, siehe
  „Verschobene Aufgaben“).
- **Abhängigkeiten:** Keine.
- **Status:** Abgeschlossen. `discoverPaths` erhält einen optionalen `platform`-Parameter;
  auf `win32` wird nur `~/.claude` geprüft, auf `darwin`/`linux` bleibt XDG + Legacy erhalten.
  `CLAUDE_CONFIG_DIR` bleibt Override mit höchster Priorität und akzeptiert zusätzlich
  zum Komma auch Semikolon als Trennzeichen.

### BL-WIN-6: Keychain-Windows-Adapter ⏸️ ZURÜCKGESTELLT
- **Status:** Zurückgestellt / Offen — Admin-Entscheidung ausstehend.
- **Begründung:** Muss mit dem Projekt-Administrator besprochen und detailliert
  geplant werden (Credential Manager vs. `safeStorage` vs. andere Lösung).
- **Scope:** `src/main/mrr/keychain.ts` → Adapter, `keychain-darwin.ts`,
  `keychain-win32.ts`, Tests.
- **Akzeptanz:** Interface-basierte Implementierung; Windows-Variante
  speichert/liest/löscht Secrets robust; `--keychain-service` QA-Flag bleibt
  erhalten.
- **Abhängigkeiten:** Entscheidung durch Projekt-Administrator.
- **Auswirkung:** Der MRR-Mode (Stripe/RevenueCat) ist auf Windows vorerst nicht
  verfügbar. Die App ist ohne Credentials voll funktionsfähig (Overlay, Tray,
  Animationen, Token-Tracking).

### BL-WIN-7: Atomares Schreiben auf Windows ✅
- **Status:** Abgeschlossen.
- **Begründung:** `fs.renameSync` kann auf Windows bei transienten Locks (`EPERM`)
  fehlschlagen. Eine asynchrone Retry-Logik mit kurzem Backoff bietet eine
  pragmatische, dependency-freie Lösung.
- **Scope:** `src/main/atomic-file.ts` und alle synchronen Aufrufer (`saveOnboardingState`,
  `saveState`, `saveSettingsState`, `XpEngine`).
- **Akzeptanz:** State-Dateien werden auf Windows robust persistiert; Lösung ist
  dokumentiert und getestet.
- **Ergebnis:** `atomicWriteFile` ist jetzt `async`, verwendet `fs.promises.writeFile` +
  `fs.promises.rename`, wiederholt den Rename bis zu 4-mal mit Delays `[0, 10, 50, 100]` ms
  bei `EPERM`/`EBUSY`, und bereinigt die Temp-Datei im `finally`. Alle Aufrufer und Tests
  wurden auf `async` umgestellt; `src/main/atomic-file.test.ts` wurde neu erstellt.

### BL-WIN-8: Renderer HiDPI / Scaling ✅
- **Scope:** `src/renderer/renderer.ts`, `src/renderer/canvas-dpr.ts`,
  `src/renderer/canvas-dpr.test.ts`, `src/renderer/renderer.test.ts`.
- **Akzeptanz:** Overlay bleibt auf 125 %/150 %/200 % Windows-Skalierung scharf;
  Pixel-Art bleibt nearest-neighbor; logische Bounds für Roaming/Hatch/Bubble
  bleiben erhalten; DPR-Änderungen ohne Fenster-Resize werden erkannt.
- **Abhängigkeiten:** BL-WIN-3.
- **Status:** Abgeschlossen. `applyDpr` kapselt die DPR-Mathematik in einer
  testbaren Hilfsdatei; `bounds()` gibt logische Pixel zurück; `clearRect`
  verwendet logische Bounds; ein `window.resize`-Listener erfasst reine
  DPR-Änderungen. 200 % Skalierung ist integer-scharf; 125 %/150 % zeigen
  keine Bilinear-Unschärfe, können aber ein leicht ungleichmäßiges Pixel-Raster
  aufweisen.

### BL-WIN-9: CI-Windows-Runner ✅
- **Scope:** `.github/workflows/ci.yml`.
- **Akzeptanz:** CI-Matrix enthält `windows-latest`; `typecheck`, `lint`, `test`, `npm run build` und `electron-builder --win --publish never` sind grün.
- **Abhängigkeiten:** BL-WIN-1, BL-WIN-2.
- **Status:** Abgeschlossen. Matrix läuft auf `ubuntu-latest` und `windows-latest` mit `fail-fast: false`; Windows-Artifakte werden als GitHub Actions Artifacts hochgeladen.

### BL-WIN-10: Dokumentation & Design-Gate ✅
- **Scope:** `README.md`, `PRD.md`, `CLAUDE.md`,
  `docs/design-reviews/phase-4-windows/verdict.md`.
- **Akzeptanz:** README/PRD/CLAUDE spiegeln macOS + Windows wider; Design-Gate für
  Windows-Icons und HiDPI abgeschlossen; Screenshots/Verdict liegen vor.
- **Abhängigkeiten:** BL-WIN-2, BL-WIN-4, BL-WIN-8.
- **Status:** Abgeschlossen. Dokumentation um HiDPI-Hinweise, Troubleshooting
  und Design-Gate-Kriterien ergänzt. Verdict bewertet die vorläufigen
  Sprite-generierten Icons als „CONDITIONAL PASS“; ein professionelles
  Master-Icon bleibt als bekanntes Follow-up offen.

---

## 5. Risiken & offene Fragen

| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| Overlay-Z-Order auf Windows | Biber hinter Taskleiste oder über Vollbild-Apps. | Smoke-Tests mit verschiedenen Levels (`pop-up-menu`, `screen-saver`). |
| Windows Secret-Store noch nicht entschieden. | MRR-Mode auf Windows vorerst nicht nutzbar. | Mit Projekt-Administrator abstimmen; bis dahin MRR-Mode auf Windows deaktiviert lassen. |
| Codex-Usage-Tracking auf Windows zurückgestellt. | Token-Burn-Tracker auf Windows berücksichtigt vorerst nur Claude Code. | Recherche/Testinstallation; späteres Build-Item. |
| HiDPI-Scaling bei 125 %/150 % zeigt ungleichmäßiges Pixel-Raster. | Visuelle Qualität leidet leicht bei nicht-integer-DPR. | Akzeptiert: kein bilinearer Blur, 200 % ist integer-scharf. |
| Neue Dependencies verstoßen gegen CLAUDE.md. | Review-Blocker. | Keine neuen Dependencies für Build/Keychain; nur falls absolut nötig, mit Lizenz + Begründung. |
| Atomares Schreiben auf Windows noch nicht final gelöst. | State-Dateien können kurzzeitig nicht geschrieben werden. | Recherche nach Windows-nativer Lösung (BL-WIN-7). |
| Node-Version-Mismatch (Projekt will 24.x, lokale Umgebung hat 22.x). | Build-Warnungen, potenzielle Inkompatibilitäten. | Für Windows-CI Node 24.x vorsehen; Entwicklungsumgebung anpassen. |

---

## 6. Empfohlene Vorgehensweise

1. **Sofort:** Recherche der Windows-Log-Pfade für Codex (blockiert BL-WIN-5).
2. **Erste Umsetzung:** BL-WIN-1 + BL-WIN-2 + BL-WIN-9 (Build, Packaging, CI),
   damit Windows-Entwicklung und -Packaging überhaupt möglich sind.
3. **Danach:** BL-WIN-3 + BL-WIN-4 (Overlay/Tray), dann BL-WIN-5 (Paths).
4. **Polish:** BL-WIN-8 + BL-WIN-10.
5. **Später (nach Recherche):** BL-WIN-7 (Atomares Schreiben).
6. **Später (nach Administrator-Abstimmung):** BL-WIN-6 (Keychain/Secrets) und
   MRR-Mode-Aktivierung auf Windows.

---

## 7. Milestones & Phasen

| Phase | Milestone | Build-Items | Ziel |
|-------|-----------|-------------|------|
| **Phase 1** | **Foundation** | BL-WIN-1, BL-WIN-2, BL-WIN-9 | App lässt sich auf Windows bauen, packen und in der CI testen. |
| **Phase 2** | **Core Windows Experience** | BL-WIN-3, BL-WIN-4 | Overlay und Tray funktionieren nativ auf Windows; Biber bleibt immer sichtbar, auch bei Taskleiste. |
| **Phase 3** | **Windows Integrations** | BL-WIN-5 | Claude-Code-Usage-Tracking funktioniert auf Windows. |
| **Phase 4** | **Polish & Release-Readiness** | BL-WIN-8, BL-WIN-10 | HiDPI/Scaling, Icons, Doku, Design-Gate. |
| **Phase 5** | **Deferred / Follow-up** | BL-WIN-6, BL-WIN-7, Codex-Tracking | Secrets/MRR, atomares Schreiben, Codex-Tracking — nach Abstimmung/Recherche. |

### Phase 1: Foundation (BL-WIN-1, BL-WIN-2, BL-WIN-9) ✅

**Ziel:** Windows-Build und -Packaging ist stabil.

**Status:** Abgeschlossen am 2026-07-15.

1. **BL-WIN-1** — Build-Scripts plattformunabhängig (`scripts/build-assets.js`).
2. **BL-WIN-2** — `electron-builder.yml` Windows-Target + Icons.
3. **BL-WIN-9** — CI-Matrix um `windows-latest` erweitern, inkl. `npm run build`
   und `electron-builder --win --publish never`.

**Akzeptanz:** `npm run build` und Packaging laufen lokal und in der CI auf
Windows durch.

**Ergebnisse:**
- `npm run build`, `npm run typecheck`, `npm run lint` und `npm test` laufen lokal
  auf Windows (Node 22.x) und in der CI (Node 24.x) erfolgreich durch.
- `npx electron-builder --win --publish never` erzeugt `release/Beaver Buddy Setup 0.1.0.exe`
  (NSIS-Installer) und `release/Beaver Buddy 0.1.0.exe` (portable Version).
- Nach Bereinigung unerwünschter ZIP-Artefakte aus `assets/sprites/` beträgt die
  Installer-Größe ca. 95 MB pro `.exe`.
- Alle 32 Test-Dateien bestehen auf Windows (292 passed, 6 skipped).

**Verbleibende Hinweise:**
- Der visuelle Smoke-Test des Icons im Installer/Explorer/Task-Manager ist ein
  manueller Schritt, der noch nachgeholt werden sollte.
- Der macOS-Build (`electron-builder --mac`) konnte lokal nicht verifiziert
  werden, da die Umgebung Windows ist; eine Prüfung auf macOS-Hardware oder in
  einer macOS-CI bleibt empfohlen.
- Die lokale Entwicklungsumgebung läuft auf Node 22.x, während das Projekt
  Node 24.x vorsieht; `npm ci` warnt, bricht aber nicht ab. Eine Anhebung der
  lokalen Node-Version sollte außerhalb der Phase erfolgen.
- Doku-Updates an `CLAUDE.md`, `PRD.md`, `README.md`, `.gitignore` und
  `docs/adr/002-cross-platform-scope.md` stammen aus der vorherigen
  Planungsphase und sind nicht Teil der strikten BL-WIN-1/2/9-Build-Items.

### Phase 2: Core Windows Experience (BL-WIN-3, BL-WIN-4) ✅

**Ziel:** App startet auf Windows und fühlt sich nativ an.

1. **BL-WIN-3** — Overlay-Adapter mit Taskleisten-Erkennung.
2. **BL-WIN-4** — Tray-Adapter mit Windows-farbigem Icon.

**Akzeptanz:** Biber ist sichtbar, bleibt bei sichtbarer Taskleiste sichtbar, Tray-Menü
funktioniert, keine Fokus-Diebstähle.

**Status:** Abgeschlossen am 2026-07-15.

**Ergebnisse:**
- `src/main/overlay-adapter.ts` wurde neu eingeführt: `detectTaskbarEdge`,
  `getPrimaryWorkAreaInfo`, `configureAlwaysOnTop`, `fitWindowToWorkArea`,
  `onWorkAreaChanged`.
- `src/main/main.ts` verwendet den Adapter, dedupliziert WorkArea-Änderungen und
  sendet Bounds über `state:bounds` an den Renderer.
- `src/main/ipc-channels.ts` und `src/main/preload.ts` stellen den neuen
  `onBoundsChanged`-Kanal bereit.
- `src/renderer/renderer.ts` und `src/renderer/roam.ts` verwenden die expliziten
  IPC-Bounds und klemmen den Roaming-State bei Größenänderungen in die neue
  Work-Area.
- `src/main/tray.ts` lädt auf Windows `assets/tray-icon.png` und auf macOS weiterhin
  `assets/tray-iconTemplate.png` mit `setTemplateImage(true)`.
- Neue Tests: `src/main/overlay-adapter.test.ts` (14 Tests),
  `src/main/preload.test.ts` (3 Tests), `src/main/tray.test.ts` (+3 Tests).
- `npm run typecheck`, `npm run lint`, `npm test` (312 passed, 6 skipped),
  `npm run build` und `npx electron-builder --win --publish never` sind grün.

**Verbleibende Warnungen:**
- **Auto-Hide-Limitation:** `detectTaskbarEdge` vergleicht `display.bounds` mit
  `display.workArea`. Bei einer Auto-Hide-Taskleiste sind beide auf Windows oft
  identisch, sodass die Taskleisten-Kante nicht erkannt wird. Das Overlay wird
  dann auf die volle Bildschirmgröße ausgerichtet; der Biber kann kurzzeitig von
  der eingeblendeten Taskleiste verdeckt werden. Eine robuste Lösung würde die
  native Windows AppBar-API erfordern, was neue Dependencies bedeuten würde.
- **Z-Order-Hardware-Test ausstehend:** `setAlwaysOnTop(true, 'normal')` ist die
  konservative Startwahl für Windows. Ob diese über der sichtbaren Taskleiste
  bleibt, kann nur auf echter Windows-Hardware verifiziert werden. Der
  dokumentierte Fallback ist `setAlwaysOnTop(true, 'pop-up-menu')`.
- **Tray-Icon-Kontrast:** Das farbige `assets/tray-icon.png` wurde nicht visuell auf
  dunklen Windows-Taskleisten-Hintergründen geprüft. Phase 4 (BL-WIN-10/HiDPI)
  sollte ein Design-Gate vorsehen.

### Phase 3: Windows Integrations (BL-WIN-5)

**Ziel:** Token-Burn-Tracking funktioniert auf Windows.

1. **BL-WIN-5** — Claude-Usage-Log-Pfade Windows-kompatibel machen.

**Akzeptanz:** App findet `%USERPROFILE%\.claude` und wertet Logs korrekt aus.

**Status:** Abgeschlossen am 2026-07-15.

**Ergebnisse:**
- `src/main/usage/paths.ts` wurde angepasst: `discoverPaths` und `claudeConfigDirs`
  erhalten einen optionalen `platform`-Parameter (Default `process.platform`).
- Auf `win32` wird ausschließlich der Legacy-Pfad `~/.claude` geprüft, der auf
  Windows zu `%USERPROFILE%\.claude` aufgelöst wird.
- Auf `darwin`/`linux` bleibt das bestehende Verhalten mit XDG (`~/.config/claude`)
  plus Legacy-Pfad erhalten.
- `CLAUDE_CONFIG_DIR` bleibt auf allen Plattformen der Override mit höchster
  Priorität und akzeptiert nun zusätzlich zum Komma auch Semikolon als Trennzeichen.
- `src/main/usage/paths.test.ts` wurde um plattformspezifische Tests für Windows
  und Nicht-Windows erweitert; alle `discoverPaths`-Aufrufe sind explizit parametrisiert.
- `npm run typecheck`, `npm run lint`, `npm test` (323 passed, 6 skipped) und
  `npm run build` sind lokal auf Windows grün; `npx electron-builder --win --publish never`
  erzeugt Installer und portable `.exe` erfolgreich.

**Verbleibende Hinweise:**
- **Codex-Tracking auf Windows** ist weiterhin zurückgestellt; Codex-Log-Pfade
  wurden in dieser Phase nicht auf Windows aktiviert (siehe „Verschobene Aufgaben“).
- Auf nicht gelisteten Plattformen (z. B. `freebsd`, `openbsd`) fällt `discoverPaths`
  ohne expliziten `platform`-Parameter auf XDG + Legacy zurück, was dem Verhalten
  vor BL-WIN-5 entspricht. Für typsichere Aufrufe sollten nur `win32`, `darwin`
  oder `linux` übergeben werden.
- Die Semikolon-Trennung für `CLAUDE_CONFIG_DIR` war nicht im ursprünglichen Plan
  vorgesehen, ist aber für Windows-Pfade sinnvoll und wurde dokumentiert.

### Phase 4: Polish & Release-Readiness (BL-WIN-8, BL-WIN-10) ✅

**Ziel:** Visuelle Qualität und Dokumentation passen für Windows.

1. **BL-WIN-8** — HiDPI/Scaling für Windows-Displays.
2. **BL-WIN-10** — Design-Gate, Screenshots, finale Doku-Updates.

**Akzeptanz:** Icons und Overlay sehen auf Windows scharf aus; README/PRD/CLAUDE
sind konsistent.

**Status:** Abgeschlossen am 2026-07-15.

**Ergebnisse:**
- `src/renderer/canvas-dpr.ts` neu eingeführt: reine, unit-testbare Hilfsfunktionen
  `computeCanvasSize` und `applyDpr`.
- `src/renderer/renderer.ts` angepasst: logische Bounds (`logicalBounds`) werden
  vom physischen Canvas getrennt; `bounds()` gibt logische Pixel zurück;
  `ctx.clearRect` verwendet logische Bounds; `window.resize`-Listener erkennt
  reine DPR-Änderungen.
- `src/renderer/canvas-dpr.test.ts` (3 Tests) und `src/renderer/renderer.test.ts`
  (3 Tests) hinzugefügt; sie decken DPR-Mathematik, `bounds()`-Regression und
  korrekten Clear-Bereich ab.
- `README.md`, `PRD.md` und `CLAUDE.md` um Windows-HiDPI-Hinweise,
  Troubleshooting, Design-Gate-Kriterien und Definition-of-Done-Ergänzungen
  aktualisiert.
- `docs/design-reviews/phase-4-windows/verdict.md` mit Bewertung der vorläufigen
  Icons und des HiDPI-Status erstellt.
- `npm run typecheck`, `npm run lint`, `npm test` (329 passed, 6 skipped),
  `npm run build` und `npx electron-builder --win --publish never` sind grün.

**Verbleibende Hinweise:**
- **Visuelles Design-Gate auf echter Hardware ausstehend:** Das Verdict basiert
  auf Code-Review und Architektur; echte Screenshots auf Windows bei 100 %,
  125 %, 150 % und 200 % Skalierung sollten nachgeholt werden, sobald eine
  Windows-Testmaschine verfügbar ist.
- **125 %/150 %-Pixel-Raster:** Bei nicht-integer-DPR kann das Pixel-Raster
  leicht ungleichmäßig wirken. Dies ist ein fundamentales Limit von
  nearest-neighbor bei 1.25×/1.5×, kein Implementierungsfehler.
- **Finales Master-Icon:** Die vorläufigen `assets/icon.ico` und
  `assets/tray-icon.png` wurden nur gegen Sprite-Assets bewertet. Ein
  professionelles Master-Icon ist als bekanntes Follow-up in Phase 5
  verankert.

### Phase 5: Deferred / Follow-up

**Ziel:** Offene Punkte nachholen, sobald Klärung vorliegt.

**Status:** Teilweise abgeschlossen.

- **BL-WIN-7 — Atomares Schreiben Windows-nativ:** ✅ Abgeschlossen. `atomicWriteFile`
  wurde asynchron mit Retry-Backoff umgebaut; State-Persistenz ist auf Windows robuster
  gegen transiente Locks. Alle Tests und Build-Pipelines laufen grün.
- **Codex-Tracking — Windows-Log-Pfade:** ✅ Abgeschlossen. `discoverPaths` prüft auf
  Windows nacheinander `CODEX_HOME` (Override), `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`
  und `~/.codex` (Legacy). Der erste existierende Pfad wird verwendet. Unbekannte
  Plattformen fallen defensiv auf `linux`-Verhalten zurück. Windows-Tests wurden in
  `src/main/usage/paths.test.ts` ergänzt.
- **BL-WIN-6 — Secret-Store / MRR-Mode:** ⏸️ Zurückgestellt. Die Wahl des
  Windows-Secret-Store-Backends erfordert eine Entscheidung des Projekt-Administrators.
  Unter den aktuellen `CLAUDE.md`-Restriktionen ist `electron.safeStorage` + verschlüsselte
  JSON in `userData` die realistische Standardlösung; Windows Credential Manager mit
  Native-Addon nur bei expliziter Admin-Entscheidung. Der MRR-Mode bleibt auf Windows
  vorerst deaktiviert.
- **Finales Master-Icon / Design-Pass** — Zurückgestellter visueller Follow-up;
  ersetzt die vorläufigen Sprite-generierten `assets/icon.ico` und
  `assets/tray-icon.png`.

**Verbleibende Blocker:**
- Admin-Entscheidung für BL-WIN-6 (Secret-Store-Backend).
- Empirische Verifizierung der Codex-Windows-Pfade auf echter Windows-Hardware wäre
  wünschenswert, da die aktuelle Lösung auf Kandidatenpfaden basiert.
- Finales Master-Icon / Design-Pass.

---

## 8. Verschobene Aufgaben

### BL-WIN-6: Windows Secret-Store / MRR-Mode
- **Status:** ⏸️ Zurückgestellt, offen — Admin-Entscheidung ausstehend.
- **Begründung:** Entscheidung über Secret-Store-Backend (Windows Credential
  Manager, `electron.safeStorage`, ggf. Win32-API) muss mit dem
  Projekt-Administrator besprochen werden.
- **Auswirkung:** MRR-Mode (Stripe/RevenueCat) ist auf Windows vorerst nicht
  verfügbar. Die App ist ohne Credentials voll funktionsfähig (Overlay, Tray,
  Animationen, Token-Tracking).
- **Empfohlung:** Unter den aktuellen `CLAUDE.md`-Restriktionen ist
  `electron.safeStorage` + verschlüsselte JSON in `userData` die realistische
  Standardlösung; Windows Credential Manager mit Native-Addon nur bei expliziter
  Admin-Entscheidung.
- **Nächster Schritt:** Termin mit Projekt-Administrator; danach Detailplanung
  und Umsetzung von BL-WIN-6.

### Codex-Usage-Log-Tracking auf Windows
- **Status:** ✅ Abgeschlossen.
- **Begründung:** Offizieller Windows-Log-Pfad der Codex-CLI ist nicht klar
  dokumentiert; daher werden mehrere Kandidatenpfade geprüft.
- **Umsetzung:** `discoverPaths` prüft auf Windows in dieser Priorität:
  `CODEX_HOME` (Override) > `%LOCALAPPDATA%\Codex` > `%APPDATA%\Codex` >
  `~/.codex` (Legacy). Der erste existierende Pfad wird verwendet.
- **Auswirkung:** Token-Burn-Tracking auf Windows berücksichtigt jetzt auch
  Codex, sofern einer der Kandidatenpfade existiert.
- **Hinweis:** Die Lösung basiert auf Kandidatenpfaden, nicht auf empirisch
  verifizierten offiziellen Codex-Pfaden. Eine Testinstallation auf Windows
  wäre wünschenswert, um die Reihenfolge ggf. anzupassen.

### Atomares Schreiben auf Windows (BL-WIN-7)
- **Status:** ✅ Abgeschlossen.
- **Begründung:** `fs.renameSync` kann auf Windows bei transienten Locks (`EPERM`)
  fehlschlagen.
- **Umsetzung:** `atomicWriteFile` wurde asynchron mit Retry-Backoff umgebaut:
  bis zu 4 Versuche mit Delays `[0, 10, 50, 100]` ms bei `EPERM`/`EBUSY`,
  Temp-Datei im Zielverzeichnis (Same-Volume-Rename), Cleanup im `finally`.
- **Auswirkung:** State-Persistenz ist auf Windows robuster gegen transiente
  Locks. Alle Tests und Build-Pipelines laufen grün.
- **Hinweis:** Sehr langsame oder lang andauernde Locks können die Heuristik
  trotzdem überfordern.

### Finales Master-Icon / Design-Pass
- **Status:** Zurückgestellt, offen.
- **Begründung:** Es gibt noch kein professionelles Master-Icon; `assets/icon.ico`
  und `assets/tray-icon.png` sind vorläufig aus Sprite-Assets generiert. Ein
  Design-Pass muss durchgeführt und abgesegnet werden.
- **Auswirkung:** App-Icon im Explorer/Installer/Task-Manager und Tray-Icon auf
  dunklen Taskleisten-Hintergründen erreichen noch nicht das finale
  Qualitätsniveau.
- **Nächster Schritt:** Design-Review oder Beauftragung eines Designers; danach
  Erstellung neuer Assets und Ersetzung der vorläufigen Dateien.

---

## 9. Post-Phase-5 Bugfix: Single-Instance-Schutz ✅

**Auslöser:** Beim manuellen Windows-Test wurden zwei Biber-Instanzen gleichzeitig angezeigt.

**Lösung:** In `src/main/main.ts` wird direkt beim Start ein Electron-Single-Instance-Lock angefordert. Ein zweiter Start beendet sich sofort mit Exit-Code `0` und öffnet kein weiteres Fenster; die laufende Instanz wird in den Vordergrund geholt.

**Akzeptanz:**
- `npm start` (erster Start) zeigt den Biber.
- `npm start` (zweiter Start) beendet sich sofort ohne zweites Overlay/Tray-Icon.
- `npm run typecheck`, `npm run lint`, `npm test` bleiben grün.

**Details:** Siehe `single-instance-fix.md`.

---

## 10. Nicht-Ziele

- Keine neuen Features (Chat, Buttons, zusätzliche Animationen).
- Keine Änderung der Renderer-Logik außer HiDPI/Scaling.
- Keine Migration bestehender macOS-Keychain-Einträge zu Windows.
- Kein App-Store-Release für Windows (erstmal natives `.exe` / Installer).
- Keine aktive Weiterentwicklung der macOS-Version; macOS-Pfade bleiben
  erhalten, aber der Fokus liegt auf Windows.
