# Kritisches Review: Phase-1-Plan (Foundation)

**Geprüfte Dateien:**
- `.flightplan/Archive/WINDOWS_PORT_PLAN.md` (Hauptplan)
- `.flightplan/Archive/phase-1-plan.md` (zu prüfender Plan)
- `package.json`
- `electron-builder.yml`
- `.github/workflows/ci.yml`
- `assets/` (inkl. `assets/STYLE.md`)
- `scripts/`

**Review-Datum:** 2026-07-15

---

## 1. Zusammenfassung des geprüften Plans

Der Phase-1-Plan deckt die drei Foundation-Build-Items ab: plattformunabhängiges Build-Skript (BL-WIN-1), Windows-Packaging inkl. Icon-Assets (BL-WIN-2) und CI-Erweiterung auf `windows-latest` (BL-WIN-9). Die Reihenfolge ist logisch, die Akzeptanzkriterien sind größtenteils messbar, und der Plan verzichtet bewusst auf neue Dependencies sowie auf Änderungen an der App-Logik. Insgesamt ist der Plan umsetzbar, enthält aber mehrere Lücken, Inkonsistenzen zum Hauptplan und Windows-spezifische Fallstricke, die noch nicht ausreichend adressiert sind.

---

## 2. Gefundene Probleme / Lücken / Fehler

| # | Thema | Schweregrad | Beschreibung |
|---|-------|-------------|--------------|
| 1 | **Inkonsistenz: BL-WIN-9 hängt laut Hauptplan von BL-WIN-5 ab** | Mittel | `WINDOWS_PORT_PLAN.md` (Abschnitt 4, Zeile 236) listet als Abhängigkeit für BL-WIN-9: BL-WIN-1, BL-WIN-2, BL-WIN-5. BL-WIN-5 ist aber Phase-3 („Windows Integrations“). Der Phase-1-Plan erkennt dies an (Abschnitt 2.9) und sagt, CI müsse trotzdem grün werden, ohne BL-WIN-5 umzusetzen. Das ist die richtige Lesart, aber der Hauptplan ist hier nicht konsistent. |
| 2 | **Node-Version-Diskrepanz wird nicht operativ behandelt** | Mittel | Projekt verlangt Node 24.x (`package.json:8`), lokale Umgebung läuft auf 22.x. Der Plan erwähnt das als Risiko, gibt aber keine konkrete Handlungsanweisung für Phase 1 (z. B. ob Phase 1 CI-getrieben entwickelt wird, ob `engines.node` vorübergehend gelockert werden soll, oder ob ein Node-Manager-Wechsel empfohlen wird). |
| 3 | **Skalierung des Sprite-Assets auf 256×256 für `.ico` ist problematisch** | Mittel | Die vorhandenen Beaver-Sprites sind 96×96 px (`assets/STYLE.md:41`). Eine Skalierung auf 256×256 ist kein Integer-Multiple (96 × 2,666…). Bei nearest-neighbor entsteht ein verzerrtes, unscharfes Icon. Der Plan schlägt 256×256 vor, ohne auf das Padding/Canvas-Problem einzugehen. Besser: 2× auf 192×192 skalieren und in 256×256-Canvas mit transparentem Rand zentrieren. |
| 4 | **NSIS-/Portable-Ausgabenamen sind zu spezifisch formuliert** | Niedrig | Der Plan behauptet, `electron-builder --win` erzeuge exakt `Beaver Buddy Setup.exe` und `Beaver Buddy.exe`. Tatsächlich hängen die Dateinamen von `productName`, Version und electron-builder-Defaults ab; portable heißt oft `${productName} ${version}.exe` oder ähnlich. Das führt zu falschen Erwartungen im Smoke-Test. |
| 5 | **Fehlende Prüfung von `src/renderer/tsconfig.json` / `outDir`** | Mittel | BL-WIN-1 setzt voraus, dass `tsc -p src/renderer/tsconfig.json` die Dateien nach `dist/renderer/` ausgibt. Der Plan prüft die `tsconfig.json` nicht. Falls `outDir` fehlt oder anders konfiguriert ist, schlägt `fs.cpSync` nach `dist/renderer/...` fehl. |
| 6 | **Kein Hinweis auf Windows-Pfadlängen-Limit** | Niedrig-Mittel | Bei `node_modules`-verschachtelten Projekten kann das 260-Zeichen-Limit auf Windows zu Build-/Packaging-Fehlern führen. Der Plan erwähnt diesen klassischen Windows-Fallstrick nicht. |
| 7 | **Antivirus/Defender kann Build und Installer blockieren** | Niedrig-Mittel | SmartScreen wird erwähnt, nicht aber, dass Windows Defender (oder andere AV) den unsignierten Installer oder sogar die portable `.exe` in CI/lokal quarantänisieren kann. Das kann Smoke-Tests blockieren. |
| 8 | **`tray-icon.png` in Phase 1 ist out-of-scope für BL-WIN-2** | Niedrig | Der Plan will `assets/tray-icon.png` bereits in BL-WIN-2 erzeugen, obwohl es erst in BL-WIN-4 (Tray-Adapter) verwendet wird. Das ist nicht falsch, aber es verschleiert, dass BL-WIN-2 eigentlich nur `assets/icon.ico` braucht. |
| 9 | **Verwechslungsgefahr zwischen Build-Scripts** | Niedrig | Es existiert bereits `scripts/gen-sprites/build.ts` (aufgerufen via `npm run assets:build`). Das neue `scripts/build-assets.js` hat einen ähnlich klingenden Namen. Das ist nicht blockierend, aber dokumentationswürdig. |
| 10 | **Akzeptanzkriterium „Icon wird korrekt angezeigt“ ist nicht automatisierbar** | Niedrig | BL-WIN-2 fordert, das Icon werde „im Installer, im Explorer und im Task-Manager korrekt angezeigt“. Das ist ein manueller visueller Test. Der Plan sollte kennzeichnen, dass dies ein manuelles Smoke-Test-Kriterium ist. |
| 11 | **Keine Angabe zu `nsis.installerIcon` / Uninstaller-Icon** | Niedrig | Für einen vollständigen Windows-Installer-Eindruck sollte geprüft werden, ob `nsis.installerIcon` und ggf. `nsis.uninstallerIcon` gesetzt werden. Der Plan reduziert das auf `win.icon`, was für App/Explorer reicht, aber den Installer-Dialog selbst nicht zwingend styled. |
| 12 | **Fehlende Fallback-Strategie, wenn Tests auf Windows rot laufen** | Mittel | Der Plan sagt, man solle „vor Merge prüfen“ und ggf. Testfixes in Phase 1 oder Phase 3 einplanen. Das ist reaktiv. Für einen sauberen Phase-1-Abschluss sollte vor der CI-Erweiterung ein Testlauf auf Windows geplant oder zumindest eine klare Eskalationsregel definiert werden. |
| 13 | **`description` in `package.json` bleibt macOS-only** | Niedrig | `package.json:5` lautet noch „Pixel-art desktop beaver overlay for macOS“. Der Plan markiert die Aktualisierung als optional, aber diese Description kann in Windows-Installer/Explorer sichtbar werden und sollte daher spätestens in BL-WIN-2 angepasst werden. |
| 14 | **Keine Klärung, wie mit `assets:build` interagiert wird** | Niedrig | `npm run build` kopiert nur bestehende `assets/sprites/*.png`. Falls `assets/sprites` vor dem Build via `npm run assets:build` neu generiert werden muss, ist das nicht Teil von BL-WIN-1. Der Plan geht davon aus, dass `assets/sprites` bereits committed sind, was aktuell stimmt. |

---

## 3. Konkrete Verbesserungsvorschläge

### 3.1 Hauptplan-Abhängigkeit korrigieren
In `WINDOWS_PORT_PLAN.md` Abschnitt 4 (Build-Items) sollte die Abhängigkeit von BL-WIN-9 auf BL-WIN-5 entfernt werden. Richtig ist:

```text
BL-WIN-9: CI-Windows-Runner
Abhängigkeiten: BL-WIN-1, BL-WIN-2
```

BL-WIN-5 ist Phase-3 und darf keine Phase-1-Abhängigkeit sein.

### 3.2 Node-Version-Diskrepanz konkret behandeln
Im Phase-1-Plan Abschnitt 5 (Risiken) ergänzen:

> Für Phase 1 gilt: Die CI läuft explizit mit Node 24.x. Lokale Entwicklung auf Node 22.x ist akzeptabel, solange `npm run build` und `npx electron-builder --win` damit funktionieren. Falls `engines.node: "24.x"` ein `npm ci`-Fehler verursacht, kann vorübergehend `engines.node: ">=22.x <=24.x"` oder `.npmrc` mit `engine-strict=false` verwendet werden — dies muss aber in einem separaten ADR/Commit dokumentiert werden.

### 3.3 Icon-Generierungsanleitung präzisieren
In BL-WIN-2, Abschnitt 2.7:

- Statt „Skaliere auf 256×256 px“ sollte stehen:
  - Wähle ein 96×96-Quellsprite.
  - Skaliere mit nearest-neighbor auf 192×192 px (exakt 2×).
  - Platziere das 192×192-Bild in einem 256×256-Canvas mit transparentem Rand (z. B. zentriert unten).
  - Exportiere als `.ico` mit den Auflösungen 16, 32, 48, 128, 256 px, wobei die 256×256-Version das gepaddete Bild enthält.
  - Für `tray-icon.png` (32×32) ebenfalls 2×-Skalierung auf 192×192 und Downsample auf 32×32 mit nearest-neighbor.

Alternativ: Icon-Generierung in Phase 1 als „funktional, nicht visuell final“ markieren und BL-WIN-10 als Design-Gate verbindlich machen.

### 3.4 Ausgabenamen in Akzeptanzkriterien relativieren
In BL-WIN-2, Abschnitt 2.8:

> Statt exakter Dateinamen prüfen:
> - Im `release/`-Verzeichnis existiert **ein** `*.exe`-Installer (NSIS) und **eine** portable `*.exe`.
> - Optional: Dateinamen via `artifactName` in `electron-builder.yml` festlegen, z. B. `${productName}-${version}-Setup.${ext}` und `${productName}-${version}-Portable.${ext}`.

### 3.5 `src/renderer/tsconfig.json` vor BL-WIN-1 prüfen
Empfohlene Voraussetzung für BL-WIN-1:

```bash
npx tsc -p src/renderer/tsconfig.json --showConfig | grep outDir
```

Falls `outDir` nicht `dist/renderer` ist, muss `scripts/build-assets.js` angepasst oder die `tsconfig.json` korrigiert werden.

### 3.6 Windows-Fallstricke ergänzen
In Abschnitt 5 (Risiken) hinzufügen:

| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| Windows-Pfadlängen-Limit (260 Zeichen) | `node_modules` oder `release/`-Pfade werden abgeschnitten. | In CI `LongPathsEnabled` prüfen; lokal ggf. `\\?\`-Präfix oder kürzere Pfade verwenden. |
| Antivirus/Windows Defender blockiert unsignierte `.exe` | Smoke-Test oder CI-Artifact-Download schlägt fehl. | Ausnahme für `release/`-Ordner; Artefakte als ZIP packen, falls nötig. |
| `tsc`-Ausgabe-Pfade nicht wie erwartet | `build-assets.js` kopiert in nicht existierende `dist/`-Pfade. | `tsconfig.json` vorab validieren (siehe 3.5). |

### 3.7 Installer-Icon separat konfigurieren
In `electron-builder.yml` ergänzen:

```yaml
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
  publisherName: AI Beavers
nsis:
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
```

Das verbessert den visuellen Eindruck im Setup-Dialog.

### 3.8 `description` in `package.json` anpassen
In BL-WIN-1 oder BL-WIN-2:

```json
"description": "Pixel-art desktop beaver overlay for macOS and Windows"
```

### 3.9 Testlauf auf Windows vor CI-Matrix-Erweiterung
Vor BL-WIN-9 sollte explizit ein Schritt „Test-Plattformneutralität prüfen“ eingeführt werden:

> Bevor `windows-latest` zur Matrix hinzugefügt wird, `npm test` lokal auf Windows (oder in einem temporären Windows-Runner) ausführen. Falls Tests rot sind, entweder minimal plattformneutral machen oder dokumentieren, warum sie vorerst auf Windows ausgeschlossen werden.

---

## 4. GO / NO-GO Empfehlung

**Empfehlung: GO — mit Vorbedingungen.**

Der Plan ist grundsätzlich solide und umsetzbar. Die drei Build-Items sind sinnvoll gereiht, die Akzeptanzkriterien sind überwiegend messbar, und der Verzicht auf neue Dependencies sowie App-Logik-Änderungen ist richtig. Allerdings sollten die oben genannten Lücken (insbesondere die Hauptplan-Inkonsistenz bei BL-WIN-9, die Node-Version-Diskrepanz und die Icon-Skalierung) vor oder parallel zur Umsetzung behoben werden.

---

## 5. Wichtige Hinweise für den Implementierungs-Agenten

1. **Reihenfolge strikt einhalten:** BL-WIN-1 muss vor BL-WIN-2 laufen, BL-WIN-2 vor BL-WIN-9. Lokale Windows-Verifikation Schritt für Schritt durchführen.
2. **`src/renderer/tsconfig.json` vorab prüfen:** Stelle sicher, dass `tsc -p src/renderer/tsconfig.json` die Dateien wirklich nach `dist/renderer/` schreibt, bevor `scripts/build-assets.js` kopiert.
3. **Icon-Generierung nicht übersehen:** `assets/icon.ico` und `assets/tray-icon.png` existieren noch nicht. Für Phase 1 reicht eine funktionale Zwischenlösung aus Sprite-Assets, aber die Skalierung muss integer (z. B. 96→192 in 256-Canvas) oder visuell geprüft werden.
4. **Node-Version beachten:** Lokale Umgebung hat Node 22.x, Projekt verlangt 24.x. CI läuft mit 24.x — nutze CI als Quelle der Wahrheit für Phase 1.
5. **Tests auf Windows vor CI-Erweiterung laufen lassen:** Falls `npm test` auf Windows fehlschlägt, nicht einfach die CI-Matrix auf Windows erweitern. Entscheide: minimal fixen oder Testausschluss dokumentieren.
6. **Windows-Fallstricke im Hinterkopf behalten:** Pfadlängen, Defender/AV, SmartScreen. Bei Problemen Artefakte als ZIP hochladen oder Ausnahmen konfigurieren.
7. **Keine Source-Dateien anfassen:** Phase 1 beschränkt sich auf `package.json`, `scripts/build-assets.js`, `electron-builder.yml`, `assets/*` und `.github/workflows/ci.yml`.
8. **Dokumentation nachziehen:** README/PRD/CLAUDE werden in BL-WIN-10 final angepasst, aber `assets/STYLE.md` sollte spätestens mit den neuen Icons einen Hinweis auf temporäre Windows-Icons erhalten.
