# Beaver Buddy — Phase 5: Deferred / Follow-up Plan

**Status:** Teilweise umgesetzt — BL-WIN-7 und Codex-Tracking wurden implementiert; BL-WIN-6 bleibt bis zur Admin-Entscheidung zurückgestellt. Keine Commits.  
**Ziel:** Die drei zurückgestellten Build-Items aus dem Windows-Port (BL-WIN-6, BL-WIN-7, Codex-Tracking) so weit wie möglich vorbereiten, Blocker dokumentieren und nächste Schritte definieren.  
**Basis:** [Hauptplan `.flightplan/Archive/WINDOWS_PORT_PLAN.md`](./WINDOWS_PORT_PLAN.md), Stand 2026-07-15.

---

## 1. Zusammenfassung der Phase

Phase 5 behandelt die Punkte, die in den Phasen 1–4 absichtlich zurückgestellt wurden, weil sie entweder eine Entscheidung des Projekt-Administrators oder externe Recherche erfordern. Die App ist auf Windows bereits voll funktionsfähig (Overlay, Tray, Animationen, Claude-Code-Token-Tracking). Phase 5 schließt die verbleibenden Lücken:

| Item | Thema | Blocker |
|------|-------|---------|
| **BL-WIN-6** | Windows Secret-Store / MRR-Mode | Entscheidung des Projekt-Administrators über Secret-Store-Backend |
| **BL-WIN-7** | Atomares Schreiben Windows-nativ | Recherche nach robusterem Windows-nativem Pattern |
| **Codex-Tracking** | Windows-Log-Pfade für Codex | Unklarer offizieller Codex-Windows-Log-Pfad |

Diese Phase kann erst umgesetzt werden, sobald die externen Klärungen vorliegen. Bis dahin dient dieser Plan als zentrale Dokumentation für Status, Optionen und nächste Schritte.

---

## 2. BL-WIN-6: Windows Secret-Store / MRR-Mode

### 2.1 Aktueller Status und Blocker

- **Status:** Zurückgestellt, offen.
- **Begründung:** Die Wahl eines Windows-Secret-Store-Backends (Windows Credential Manager, `electron.safeStorage`, Win32-API) muss mit dem Projekt-Administrator abgestimmt werden.
- **Code-Lage:** `src/main/mrr/keychain.ts` verwendet ausschließlich die macOS-`security`-CLI (`add-generic-password`, `find-generic-password`, `delete-generic-password`). Es gibt keine plattformabhängige Abstraktion.
- **Auswirkung:** Der MRR-Mode (Stripe/RevenueCat) ist auf Windows vorerst nicht verfügbar. Die App läuft ohne Credentials weiterhin vollständig (Overlay, Tray, Animationen, Token-Tracking).

### 2.2 Aktuelle Code-Architektur

- `src/main/mrr/keychain.ts` ist **funktionsbasiert**, nicht interfacebasiert. Es exportiert:
  - `setKeychainSecret`, `getKeychainSecret`, `deleteKeychainSecret`
  - `isValidKeychainService`
- Es gibt **kein Interface, keine Factory und keine Injektion**. Vor der Windows-Implementierung muss `keychain.ts` in ein plattformunabhängiges Interface + Factory + zwei Implementierungen (`keychain-darwin.ts`, `keychain-win32.ts`) refactored werden.
- Alle Aufrufer (`src/main/mrr/mrr-config.ts`, `src/main/mrr/mrr-engine.ts`, `src/main/mrr/settings-window.ts`, `src/main/main.ts:91-99`) müssen dann über die Factory oder Dependency Injection arbeiten.
- `--keychain-service` wird in `src/main/main.ts:91-99` geparst und in `src/main/mrr/mrr-config.ts:19` als `DEFAULT_KEYCHAIN_SERVICE = 'beaver-buddy'` definiert. `isValidKeychainService` aus `src/main/mrr/keychain.ts:27` muss auf Windows weiterhin verwendet werden, um Injection in Service-Namen zu verhindern.
- Eine Windows-Implementierung (`keychain-win32.ts`) muss `logRedacted` aus `src/main/mrr/redact.ts` wiederverwenden, damit Secrets niemals im Log landen.

### 2.3 Recherche-/Entscheidungsfragen

1. Welches Secret-Store-Backend entspricht den Sicherheits- und Dependency-Richtlinien des Projekts (insbesondere `CLAUDE.md`)?
2. Ist die Verwendung von `electron.safeStorage` + verschlüsselter JSON im `userData`-Verzeichnis akzeptabel, oder verstößt das gegen die Regel „secrets never in app-support dir“?
3. Soll Windows Credential Manager als primärer Store verwendet werden, auch wenn dies ggf. externe CLI-Abhängigkeiten oder einen kleinen Native-Addon erfordert?
4. Soll ein Adapter-Pattern eingeführt werden (`keychain.ts` als Interface/Factory, `keychain-darwin.ts`, `keychain-win32.ts`)?
5. Welche Teststrategie ist akzeptabel? (Mocken der externen APIs, Integrationstests auf Windows-CI, manuelle QA?)
6. Bleibt der `--keychain-service` QA-Flag erhalten und wie wird er auf Windows abgebildet?

### 2.3 Mögliche Lösungsansätze

#### Option A: Windows Credential Manager (primärer Prüfkandidat)

**Umsetzung:**
- Einführung eines Adapter-Patterns: `src/main/mrr/keychain.ts` als Interface + Factory, `src/main/mrr/keychain-darwin.ts` mit bestehender `security`-CLI-Logik, `src/main/mrr/keychain-win32.ts` mit Windows-Credential-Manager-Zugriff.
- Windows-Zugriff entweder über:
  - **Kleiner Native-Addon** über `node-gyp` mit Win32-Credential-API (`CredWriteW`, `CredReadW`, `CredDeleteW`).
    Dies ist die einzige seriöse Option für generische Credentials; erfordert aber eine Administrator-Entscheidung und ein ADR für die neue Native-Dependency (Konflikt mit `CLAUDE.md`).
  - PowerShell `CredentialManager`-Modul — **nur für lokale POCs**, nicht für Shipping, da es nicht standardmäßig installiert ist.
  - `cmdkey.exe` — **nicht geeignet** für generische Credentials; verwaltet nur Netzwerk-/Remote-Desktop-Credentials.

**Vorteile:**
- Echter systemeigener Secret-Store.
- Geheimnisse werden außerhalb des App-Datenverzeichnisses gehalten.
- Entspricht der ursprünglichen Design-Philosophie von `CLAUDE.md` (Secrets nicht in JSON im App-Support).

**Nachteile:**
- Nur über Native-Addon oder nicht-standardmäßige PowerShell-Module erreichbar; `cmdkey.exe` kann generische Credentials nicht lesen.
- Native-Addon führt Build-Komplexität und potenzielle Dependency-Probleme ein (verstößt gegen `CLAUDE.md`-Restriktionen, sofern nicht explizit begründet).
- Benötigt Administrator-Entscheidung, Lizenz-/Sicherheits-Review und ein ADR für die neue Native-Dependency.

#### Option B: `electron.safeStorage` + verschlüsselte JSON in `userData`

**Umsetzung:**
- Adapter-Pattern wie Option A, aber `keychain-win32.ts` verwendet `electron.safeStorage.encryptString` / `decryptString`.
- Secrets werden in einer verschlüsselten JSON-Datei im `userData`-Verzeichnis gespeichert (z. B. `state/secrets.enc.json`).
- `electron.safeStorage` ist erst nach `app.whenReady()` nutzbar; MRR-Credentials müssen lazy geladen werden (z. B. erst beim ersten `pollNow()` / Settings-Window-Öffnen), nicht beim App-Start vor Window-Creation.

**Vorteile:**
- Keine neue externe Dependency.
- Einfach zu implementieren und zu testen.
- Nutzt Windows DPAPI über Electron.

**Nachteile:**
- Verstößt historisch gegen `CLAUDE.md` („secrets never in app-support dir“).
- Erfordert ein ADR-Update oder eine bewusste Scope-Entscheidung des Administrators.
- Secrets liegen physisch im App-Datenverzeichnis (verschlüsselt, aber gegen die ursprüngliche Architektur).

**Empfehlung BL-WIN-6:** Unter den aktuellen `CLAUDE.md`-Restriktionen (keine neuen Dependencies ohne ADR) ist **Option B (`electron.safeStorage` + verschlüsselte JSON in `userData`) die realistische Standardlösung**. Option A (Windows Credential Manager) ist nur bei expliziter Administrator-Entscheidung inklusive Native-Addon-ADR und Sicherheits-Review umsetzbar.

#### Option C: `keytar`-ähnliche Dependency

**Umsetzung:**
- Einbindung einer etablierten Bibliothek wie `@napi-rs/keyring` oder ähnlichem.

**Vorteile:**
- Fertige Cross-Platform-API.

**Nachteile:**
- `CLAUDE.md` erschwert neue Dependencies; Native-Bindings erhöhen Build-Komplexität.
- Lizenz- und Sicherheitsprüfung nötig.
- **Empfehlung:** Vermeiden, sofern Option A oder B umsetzbar sind.

### 2.4 Nächste konkrete Schritte

1. **Termin mit Projekt-Administrator vereinbaren**, um die Secret-Store-Strategie festzulegen.
2. **Entscheidungsvorlage erstellen** mit den Optionen A–C, Risiken und einem klaren Empfehlungsvorschlag (Option A primär, Option B als dokumentierter Fallback).
3. **Nach Entscheidung:**
   - Adapter-Pattern in `src/main/mrr/keychain.ts` einführen.
   - `keychain-darwin.ts` aus bestehendem Code extrahieren.
   - `keychain-win32.ts` gemäß gewählter Option implementieren.
   - Tests anpassen/erweitern (`keychain.test.ts` oder neue `keychain-win32.test.ts`).
   - `--keychain-service` QA-Flag für Windows-Verhalten dokumentieren.
   - MRR-Mode auf Windows aktivieren, sobald Secrets robust gespeichert werden können.

### 2.5 Akzeptanzkriterien (sobald umgesetzt)

- `src/main/mrr/keychain.ts` definiert ein klares, plattformunabhängiges Interface.
- macOS-Verhalten bleibt unverändert (`security`-CLI).
- Windows-Implementierung speichert, liest und löscht Secrets robust.
- `--keychain-service` QA-Flag funktioniert weiterhin.
- Alle Tests grün (`npm run typecheck`, `npm run lint`, `npm test`).
- `npm run build` und `npx electron-builder --win --publish never` sind grün.
- MRR-Mode ist auf Windows aktiviert und dokumentiert.

---

## 3. BL-WIN-7: Atomares Schreiben Windows-nativ

### 3.1 Aktueller Status und Blocker

- **Status:** Recherche-Phase / Zurückgestellt.
- **Begründung:** Einfache Retry-Logik ist bekannt, aber es soll geprüft werden, ob es eine robustere, Windows-nähere Lösung gibt.
- **Code-Lage:** `src/main/atomic-file.ts` implementiert atomares Schreiben via temporärer Datei + `fs.renameSync(tmpPath, filePath)`. Das funktioniert auf POSIX-Systemen atomar, auf Windows kann `renameSync` jedoch bei transienten Locks (`EPERM`) fehlschlagen, z. B. wenn Virenscanner oder Indexer die temporäre Datei kurz blockieren.
- **Auswirkung:** State-Dateien werden in der Regel korrekt geschrieben, aber das Risiko eines kurzzeitigen Schreibfehlers bleibt bestehen.

### 3.2 Recherche-/Entscheidungsfragen

1. Ist eine einfache Retry-Logik mit kurzem Backoff für das Projekt ausreichend robust?
2. Gibt es einen Windows-nativen Weg, der `EPERM`-Fälle bei `rename` zuverlässig vermeidet?
3. Soll ein Native-Addon (`MoveFileExW` mit `MOVEFILE_REPLACE_EXISTING`) in Betracht gezogen werden?
4. Sind transaktionale NTFS-Operationen (`CreateTransaction`, `MoveFileTransactedW`) sinnvoll, oder over-engineering?
5. Gibt es etablierte Node-Bibliotheken, die dieses Problem lösen, ohne neue Dependencies zu erzwingen?
6. Welche Fehler müssen abgefangen werden (nur `EPERM`, auch `EACCES`, `EBUSY`)?

### 3.3 Mögliche Lösungsansätze

#### Option A: Asynchrone Retry-Logik mit Backoff

**Umsetzung:**
- `atomicWriteFile` wird asynchron (`async function`) und verwendet `fs.promises.writeFile` + `fs.promises.rename` + `setTimeout`-Backoff.
- `fs.rename` wird bis zu 4-mal wiederholt (sofort, 10 ms, 50 ms, 100 ms).
- Fehlerklassifikation: `EPERM` und `EBUSY` sind transient retriable; `EACCES` ist ein dauerhaftes Berechtigungsproblem und wird nicht retriert.
- Die temporäre Datei bleibt im Zielverzeichnis (`${filePath}.tmp-...`), damit `rename` auf demselben Volume atomar bleibt.

**Vorteile:**
- Minimale Code-Änderung.
- Keine neuen Dependencies.
- Löst die meisten transienten Lock-Probleme.

**Nachteile:**
- Nicht deterministisch; sehr lange Blockaden können trotzdem scheitern.
- Keine echte Garantie atomaren Verhaltens unter Windows.
- Testbarkeit erschwert (Timing-abhängig).
- Erfordert Anpassung aller synchronen Aufrufer (`saveOnboardingState`, `saveState`, `saveSettingsState`) und deren Tests.

#### Option B: `MoveFileExW` via Native-Addon oder NAPI

**Umsetzung:**
- Kleiner Native-Addon, der `MoveFileExW` mit `MOVEFILE_REPLACE_EXISTING` aufruft.
- Optional mit `MOVEFILE_WRITE_THROUGH` für synchrones Commit.

**Vorteile:**
- Windows-native API, häufig robuster gegen Lock-Konflikte.
- Explizites Überschreiben der Zieldatei ist möglich.

**Nachteile:**
- Einführung von Native-Code/Build-Komplexität.
- Ggf. Konflikt mit `CLAUDE.md`-Restriktionen gegen neue Dependencies.
- Testbarkeit auf Nicht-Windows-Systemen erschwert.

#### Option C: Transaktionale NTFS-Operationen

**Umsetzung:**
- Verwendung von `CreateTransaction`, `MoveFileTransactedW`, `CommitTransaction` über Native-Addon.

**Vorteile:**
- Strengste Konsistenzgarantie.

**Nachteile:**
- Stark over-engineering für eine einzelne State-Datei.
- NTFS-transaktionale APIs sind veraltet/deprecated und nicht empfohlen.
- Hohe Komplexität, geringer Nutzen.
- **Empfehlung:** Nicht verfolgen.

#### Option D: Kombination aus Retry + robuster Fehlerbehandlung

**Umsetzung:**
- Asynchrone Retry-Logik wie Option A, aber zusätzlich:
  - Explizite Prüfung auf `EPERM`/`EBUSY` (retriable) vs. `EACCES` (nicht retriable).
  - Temporäre Datei bleibt im Zielverzeichnis (Same-Volume-Rename ist die entscheidende Atomaritätsgarantie).
  - Bei wiederholtem Scheitern: Aufräumen und aussagekräftige Fehlermeldung.

**Vorteile:**
- Pragmatisch und gut testbar.
- Keine neuen Dependencies.
- Bessere Diagnosemöglichkeiten.

**Nachteile:**
- Bleibt eine Heuristik, keine 100 %-Garantie.

### 3.4 Recherche-Abbruchkriterien

- **Zeitbox:** maximal 4 Stunden Recherche.
- **Abbruchkriterium:** Wenn innerhalb der Zeitbox kein empirischer Beweis gefunden wird, dass ein Windows-nativer Ansatz (Option B) deutlich zuverlässiger ist als Retry-Backoff, wird **Option A/D** als Default gewählt.
- **Fallback:** Option A/D ist jederzeit umsetzbar und erfordert keine neuen Dependencies.

### 3.5 Nächste konkrete Schritte

1. **Recherche durchführen:**
   - Erfahrungen aus dem Node-Ökosystem sammeln (z. B. wie `electron-store`, `conf`, `write-file-atomic` das Problem lösen).
   - Windows-API-Dokumentation zu `MoveFileExW` und `ReplaceFile` prüfen.
2. **Entscheidung treffen**, ob Option A/D oder B verfolgt wird.
3. **Proof-of-Concept erstellen** für die gewählte Lösung.
4. **Tests erweitern:**
   - Unit-Tests für Retry-Logik mit gemocktem `fs`.
   - Ggf. Windows-CI-Integrationstest für atomares Schreiben.
5. **Dokumentation aktualisieren** in `CLAUDE.md` oder ADR, falls das Vorgehen von der ursprünglichen POSIX-Annahme abweicht.
6. **Umsetzung in `src/main/atomic-file.ts`** und Regressionstests laufen lassen.

### 3.6 Akzeptanzkriterien (sobald umgesetzt)

- `atomicWriteFile` schreibt State-Dateien auf Windows zuverlässig, auch unter transienten Lock-Bedingungen.
- Das Schreiben bleibt atomar: Leser sehen niemals eine partielle Datei.
- Alle bestehenden Tests bleiben grün.
- Die Lösung ist dokumentiert (Warum wurde diese Option gewählt? Welche Fehler werden abgefangen?).
- `npm run build` und `npx electron-builder --win --publish never` bleiben grün.

---

## 4. Codex-Tracking: Windows-Log-Pfade recherchieren und ergänzen

### 4.1 Aktueller Status und Blocker

- **Status:** Zurückgestellt, offen.
- **Begründung:** Der offizielle Windows-Log-Pfad der Codex-CLI ist nicht klar dokumentiert; die Windows-Unterstützung der Codex-CLI selbst kann experimentell oder versionabhängig sein.
- **Code-Lage:** `src/main/usage/paths.ts` verwendet für Codex standardmäßig `path.join(home, '.codex')` (bzw. `CODEX_HOME`-Override). Dieser Pfad funktioniert auf macOS/Linux; auf Windows ist unklar, ob Codex tatsächlich `%USERPROFILE%\.codex` verwendet oder einen anderen Ort (z. B. `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, etc.). Der aktuelle Cast `process.platform as Platform` in `src/main/usage/paths.ts:129` ist für unbekannte Plattformen (z. B. `freebsd`) latent fehlerhaft.
- **Auswirkung:** Token-Burn-Tracking auf Windows berücksichtigt vorerst nur Claude Code. Codex-Logs werden weiterhin nur auf macOS/Linux über `~/.codex` verarbeitet.

### 4.2 Recherche-/Entscheidungsfragen

1. Welchen Pfad verwendet Codex auf Windows für seine Log-Dateien?
2. Verwendet Codex `%USERPROFILE%\.codex`, `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, oder einen anderen Ort?
3. Gibt es offizielle Dokumentation oder Issue-Diskussionen zu Codex-Windows-Pfaden?
4. Unterscheidet sich das Verhalten zwischen Codex-CLI-Versionen?
5. Soll `CODEX_HOME` als Override weiterhin höchste Priorität haben?
6. Soll auf Windows mehr als ein Pfad geprüft werden (z. B. Legacy + moderner AppData-Pfad)?

### 4.3 Mögliche Lösungsansätze

#### Option A: Recherche + Testinstallation

**Umsetzung:**
- Codex-CLI auf einer Windows-Maschine installieren und ausführen.
- Beobachten, welche Verzeichnisse angelegt werden.
- Offizielle Dokumentation, README und GitHub-Issues prüfen.

**Vorteile:**
- Empirisch gesicherte Erkenntnis.
- Vermeidet falsche Annahmen.

**Nachteile:**
- Erfordert Zugriff auf Windows-Testumgebung.
- Zeitaufwändig.

#### Option B: Mehrere Kandidatenpfade prüfen

**Umsetzung:**
- In `discoverPaths` für `win32` mehrere potenzielle Codex-Home-Verzeichnisse in dieser Priorität prüfen:
  1. `env.CODEX_HOME` (Override)
  2. `path.join(env.LOCALAPPDATA || '', 'Codex')` (modernster Windows-AppData-Pfad)
  3. `path.join(env.APPDATA || '', 'Codex')`
  4. `path.join(home, '.codex')` (Legacy / WSL-ähnliche Umgebungen)
- Erster existierender Pfad gewinnt.
- Unbekannte `process.platform`-Werte werden defensiv auf `linux`-Verhalten zurückgeführt, statt blind `as Platform` zu casten.

**Vorteile:**
- Robust gegen unterschiedliche Codex-Versionen.
- Schnell umsetzbar.

**Nachteile:**
- Könnte versehentlich falsche/veraltete Verzeichnisse einlesen.
- Erfordert sorgfältige Priorisierung und Tests.

#### Option C: `CODEX_HOME`-Override beibehalten + Dokumentation

**Umsetzung:**
- Vorerst nur `~/.codex` prüfen (aktuelles Verhalten).
- `CODEX_HOME`-Override bleibt als Ausweg für Windows-Nutzer erhalten.
- Dokumentation ergänzen, wie Windows-Nutzer Codex-Tracking manuell aktivieren können.

**Vorteile:**
- Kein Code-Risiko.
- Sofort umsetzbar.

**Nachteile:**
- Keine Out-of-the-Box-Codex-Unterstützung auf Windows.
- Schlechtere User Experience.

### 4.4 Nächste konkrete Schritte

1. **Recherche:**
   - Offizielle Codex-Dokumentation und Repository nach Windows-Pfaden durchsuchen.
   - GitHub-Issues/Discussions zu Codex + Windows durchsuchen.
2. **Testinstallation:**
   - Codex-CLI auf Windows installieren und ausführen.
   - Protokollieren, welche Pfade angelegt werden.
3. **Entscheidung treffen**, welche Pfade auf Windows geprüft werden sollen.
4. **Code-Anpassung in `src/main/usage/paths.ts`:**
   - Plattformspezifische Codex-Logik ähnlich `claudeConfigDirs` einführen.
   - `CODEX_HOME` bleibt Override mit höchster Priorität.
5. **Tests erweitern** in `src/main/usage/paths.test.ts` für Windows-Codex-Szenarien.
6. **Dokumentation aktualisieren** (`README.md`, `CLAUDE.md`), falls ein zusätzlicher Windows-Pfad hinzukommt.

### 4.5 Akzeptanzkriterien (sobald umgesetzt)

- `discoverPaths` findet Codex-Log-Dateien auf Windows automatisch am korrekten, dokumentierten Ort.
- `CODEX_HOME` bleibt auf allen Plattformen der Override mit höchster Priorität.
- Die Pfadauflösung ist plattformspezifisch und testbar.
- Alle Tests grün (`npm run typecheck`, `npm run lint`, `npm test`).
- `npm run build` bleibt grün.

---

## 5. Querschnittliche Hinweise

### 5.1 Zu aktualisierende Testdateien

- `src/main/atomic-file.test.ts` — **neu erstellen** (gibt aktuell keine eigene Testdatei).
- `src/main/mrr/keychain.test.ts` — muss bei einem Adapter-Refactor komplett umgebaut werden.
- `src/main/usage/paths.test.ts` — muss um Windows-Codex-Szenarien erweitert werden.

### 5.2 Security: `logRedacted` wiederverwenden

Eine zukünftige `keychain-win32.ts` muss `logRedacted` aus `src/main/mrr/redact.ts` verwenden, damit Secrets niemals im Log landen — analog zur aktuellen macOS-Implementierung.

### 5.3 Finales Master-Icon / Design-Pass

Das **finale Master-Icon / Design-Pass** aus `WINDOWS_PORT_PLAN.md:511-513` ist kein technisches Build-Item, sondern ein visuelles Follow-up. Es wird in Phase 5 nicht umgesetzt, sondern als separater Design-Pass nachgelagert.

---

## 6. Abhängigkeiten zu externen Entscheidungen/Recherchen

| Item | Externer Blocker | Wer klärt? | Nächster Schritt |
|------|------------------|-----------|------------------|
| **BL-WIN-6** | Wahl des Windows-Secret-Store-Backends | Projekt-Administrator | Termin vereinbaren, Entscheidungsvorlage präsentieren |
| **BL-WIN-7** | Recherche nach Windows-nativem atomarem Schreib-Pattern | Entwicklungsteam | Recherche durchführen, POC erstellen, Entscheidung dokumentieren |
| **Codex-Tracking** | Offizieller Windows-Log-Pfad der Codex-CLI | Entwicklungsteam + ggf. Codex-Community | Testinstallation und Dokumentationssuche |

**Wichtig:** Ohne diese externen Klärungen kann Phase 5 nicht vollständig abgeschlossen werden. Dieser Plan sollte als lebendes Dokument gepflegt werden, sobald neue Erkenntnisse vorliegen.

---

## 7. Risiken und Mitigationen

| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| **BL-WIN-6:** Administrator-Entscheidung verzögert sich | MRR-Mode bleibt auf Windows länger deaktiviert | App ohne Credentials weiterhin voll funktionsfähig halten; klare Kommunikation im UI/Doku |
| **BL-WIN-6:** Gewähltes Backend verstößt gegen `CLAUDE.md` | Review-Blocker, ggf. Rework | Vorab ADR/Scope-Update einplanen; Optionen mit Vor-/Nachteilen transparent dokumentieren |
| **BL-WIN-7:** Recherche ergibt kein deutlich besseres Pattern als Retry | Zeitverlust, keine Verbesserung | Option A/D als Fallback sofort umsetzbar halten; klare Abbruchkriterien für Recherche definieren |
| **BL-WIN-7:** Native-Addon erhöht Build-Komplexität | CI-Probleme, Portabilitätsrisiken | Nur verwenden, wenn empirisch belegt, dass Retry nicht ausreicht |
| **Codex-Tracking:** Codex-Windows-Support selbst ist experimentell; Pfad kann sich zwischen Versionen ändern | Tracking funktioniert nicht für alle Nutzer | Mehrere Kandidatenpfade prüfen, `CODEX_HOME`-Override prominent dokumentieren |
| **Allgemein:** Phase 5 wird nicht priorisiert | Technische Schuld bleibt bestehen | Regelmäßiges Review des Plans im Team; klare Definition-of-Done für jedes Item |

---

## 8. Empfohlene Reihenfolge

1. **Codex-Tracking-Recherche** (niedrigster externer Blocker, schnellster Wert für Windows-Nutzer).
2. **BL-WIN-7-Recherche + POC** (kann parallel laufen; Fallback-Implementierung ist trivial).
3. **BL-WIN-6-Administrator-Termin** (größter Entscheidungsblocker; erst danach Umsetzung möglich).

---

## 9. Notizen zum Vorgehen

- **Keine Source-Änderungen** in dieser Planungsphase — nur dieses Dokument wird erstellt.
- **Keine Commits** — der Plan ist lokal in `.flightplan/Archive/phase-5-plan.md` hinterlegt.
- Sobald die externen Klärungen vorliegen, sollten die einzelnen Items in eigene Build-Items/Branches aufgeteilt und mit dem üblichen Test- und Review-Prozess umgesetzt werden.

### 9.1 Definition of Done für diese Planungsphase

- [ ] Technische Fehler im Plan korrigiert (BL-WIN-6 Option A, BL-WIN-7 Option A).
- [ ] BL-WIN-6: Entscheidungsvorlage mit klarer Empfehlung (Option B als Default) vorhanden.
- [ ] BL-WIN-7: Recherche-Zeitbox und Abbruchkriterien definiert.
- [ ] Codex-Tracking: Kandidatenpfade priorisiert; defensiver Plattform-Fallback dokumentiert.
- [ ] Querschnittliche Test- und Security-Hinweise ergänzt.
- [ ] Offene Punkte, Blocker und nächste Schritte sind kommuniziert.
