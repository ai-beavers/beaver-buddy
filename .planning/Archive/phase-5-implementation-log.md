# Beaver Buddy — Phase 5: Implementierungs-Log

**Datum:** 2026-07-15
**Implementierungs-Agent:** Kimi Code CLI
**Status:** BL-WIN-7 + Codex-Tracking umgesetzt; BL-WIN-6 zurückgestellt (Admin-Entscheidung ausstehend)

---

## 1. Zusammenfassung

Dieses Log dokumentiert die Umsetzung der Phase-5-Follow-ups gemäß `.flightplan/Archive/phase-5-plan.md` und `.flightplan/Archive/phase-5-plan-review.md`.

| Item | Status | Anmerkung |
|------|--------|-----------|
| **BL-WIN-7** | ✅ Umgesetzt | `atomicWriteFile` asynchron mit Retry-Backoff; alle Aufrufer und Tests angepasst. |
| **Codex-Tracking** | ✅ Umgesetzt | Windows-Kandidatenpfade (`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`) mit Priorität; defensiver Plattform-Fallback. |
| **BL-WIN-6** | ⏸️ Zurückgestellt | Keine Admin-Entscheidung zum Secret-Store-Backend; Ansatz dokumentiert, kein Code implementiert. |
| **Plan-Korrekturen** | ✅ Umgesetzt | Technische Fehler in `phase-5-plan.md` korrigiert (`cmdkey.exe`, `setTimeout` in synchroner Funktion, Empfehlungen, Tests, DoD). |

---

## 2. BL-WIN-7: Atomares Schreiben Windows-nativ

### 2.1 Entscheidung

Empfohlener asynchroner Ansatz mit Retry-Backoff umgesetzt. `atomicWriteFile` ist jetzt `async` und verwendet `fs.promises`.

### 2.2 Geänderte Dateien

- `src/main/atomic-file.ts`
  - `export async function atomicWriteFile(...)`
  - Retry-Logik: 4 Versuche mit Delays `[0, 10, 50, 100]` ms.
  - Retriable Fehler: `EPERM`, `EBUSY`.
  - Nicht retriable Fehler: `EACCES` (und alle anderen).
  - Temp-Datei im Zielverzeichnis (Same-Volume-Rename-Atomarität beibehalten).
  - Cleanup der Temp-Datei im `finally`.

- `src/main/onboarding.ts`
  - `saveOnboardingState` ist jetzt `async`.

- `src/main/xp/store.ts`
  - `saveState` ist jetzt `async`.

- `src/main/mrr/settings-store.ts`
  - `saveSettingsState` ist jetzt `async`.

- `src/main/xp/engine.ts`
  - `ingestLifetimeTokens`, `injectXp`, `awardMrr`, `applyXp`, `applyState`, `attachTracker` sind jetzt `async`.
  - `attachTracker` gibt jetzt `Promise<() => void>` zurück, damit der initiale Persistenzvorgang awaitet werden kann.
  - `TrackerLike.onChange` akzeptiert Callbacks, die `void | Promise<void>` zurückgeben.

- `src/main/mrr/mrr-engine.ts`
  - `await xpEngine.awardMrr(...)` im `pollNow`.

- `src/main/mrr/settings-window.ts`
  - `connect`/`disconnect` Handler awaiten `saveSettingsState`.

- `src/main/main.ts`
  - `app.whenReady().then(async () => { ... })`.
  - `await saveOnboardingState(...)`, `await saveSettingsState(...)`, `await xpEngine.injectXp(...)`, `await xpEngine.attachTracker(...)`.
  - `onSelectGrowthMode` ist jetzt `async`.

- `src/main/tray.ts`
  - `TrayCallbacks.onSelectGrowthMode` erlaubt jetzt `void | Promise<void>`.

- `src/main/usage/tracker.ts`
  - `onChange`/`onTick` Callback-Typen erlauben `void | Promise<void>`.

- Tests angepasst:
  - `src/main/onboarding.test.ts`
  - `src/main/xp/store.test.ts`
  - `src/main/mrr/settings-store.test.ts`
  - `src/main/xp/engine.test.ts`
  - `src/main/mrr/mrr-engine.test.ts` (`FakeXp.awardMrr` async)
  - `src/main/usage/tracker.test.ts` (Callback-Rückgaben angepasst)
  - `src/main/tray.test.ts` (Callback-Rückgabe angepasst)
  - `src/main/atomic-file.test.ts` — **neu erstellt**.

### 2.3 Testabdeckung `atomic-file.test.ts`

- Schreiben + keine tmp-Rückstände
- Erstellen verschachtelter Verzeichnisse
- Atomares Überschreiben
- Retry bei `EPERM` und `EBUSY`
- Kein Retry bei `EACCES`
- Aufgeben nach 4 Versuchen
- Temp-Cleanup bei Write-Fehler

---

## 3. Codex-Tracking: Windows-Log-Pfade

### 3.1 Entscheidung

Mehrere Kandidatenpfade mit klarer Priorität umgesetzt:

1. `CODEX_HOME` (Override)
2. `%LOCALAPPDATA%\Codex`
3. `%APPDATA%\Codex`
4. `~/.codex` (Legacy)

Nur der erste **existierende** Pfad wird verwendet.

### 3.2 Geänderte Dateien

- `src/main/usage/paths.ts`
  - `PathEnv` erweitert um `LOCALAPPDATA` und `APPDATA`.
  - `normalizePlatform(process.platform)` mit defensiver Fallback auf `linux` für unbekannte Plattformen (entfernt den unsicheren `as Platform`-Cast).
  - `codexHomes()` generiert Kandidatenpfade je nach Plattform.
  - `resolveCodexHome()` wählt den ersten existierenden Pfad aus.
  - `discoverPaths()` verwendet `resolveCodexHome`.

- `src/main/usage/paths.test.ts`
  - Tests für Windows-Codex-Pfade hinzugefügt:
    - `%LOCALAPPDATA%\Codex` bevorzugt
    - Fallback auf `%APPDATA%\Codex`
    - Fallback auf `~/.codex`
    - `CODEX_HOME` hat höchste Priorität

---

## 4. BL-WIN-6: Windows Secret-Store / MRR-Mode

### 4.1 Status

**Nicht umgesetzt.** Admin-Entscheidung zum Secret-Store-Backend steht aus.

### 4.2 Blocker

- `CLAUDE.md` beschränkt neue Dependencies; Windows Credential Manager erfordert einen Native-Addon (`CredWriteW`/`CredReadW`/`CredDeleteW`), was einen ADR und Sicherheits-Review erfordert.
- `electron.safeStorage` ist einfacher, verstößt aber historisch gegen die Regel „secrets never in app-support dir“ und erfordert ebenfalls einen bewussten Scope-Entscheid.
- `cmdkey.exe` kann generische Credentials nicht lesen und ist keine Option.
- `keychain.ts` ist funktionsbasiert; ein Refactor zu Interface + Factory + plattformspezifischen Implementierungen würde alle Aufrufer (`mrr-engine.ts`, `settings-window.ts`, `main.ts`) ändern.

### 4.3 Geplanter Ansatz (dokumentiert, nicht implementiert)

1. Refactor von `src/main/mrr/keychain.ts` in ein Interface + Factory:
   - `src/main/mrr/keychain.ts`: Interface `KeychainAdapter` + Factory + `isValidKeychainService`.
   - `src/main/mrr/keychain-darwin.ts`: bestehende `security`-CLI-Logik.
   - `src/main/mrr/keychain-win32.ts`: Windows-Implementierung nach Admin-Entscheidung.
2. Aufrufer auf DI/Factory umstellen.
3. Windows-Implementierung muss `logRedacted` aus `src/main/mrr/redact.ts` verwenden.
4. `--keychain-service` QA-Flag bleibt erhalten; `isValidKeychainService` weiterhin als Injection-Schutz.
5. MRR-Mode auf Windows erst aktivieren, nachdem ein vollständiger Write/Read/Delete-Zyklus getestet ist.

### 4.4 Empfehlung

Unter den aktuellen `CLAUDE.md`-Restriktionen ist **Option B (`electron.safeStorage` + verschlüsselte JSON in `userData`)** die realistische Standardlösung. Option A (Windows Credential Manager mit Native-Addon) nur bei expliziter Admin-Entscheidung.

---

## 5. Plan-Korrekturen

`.flightplan/Archive/phase-5-plan.md` wurde mit den Review-Befunden aktualisiert:

- BL-WIN-6 Option A: `cmdkey.exe` als ungeeignet markiert; PowerShell-Modul nur für POCs; Native-Addon mit ADR-Hinweis.
- BL-WIN-6 Option B: `electron.safeStorage` erst nach `app.whenReady()` nutzbar; Lazy-Loading dokumentiert.
- BL-WIN-6: aktuelle funktionsbasierte Architektur und Refactor-Aufwand dokumentiert.
- BL-WIN-6: `--keychain-service` Code-Bezüge ergänzt.
- BL-WIN-6: klare Empfehlung (Option B als Default).
- BL-WIN-7 Option A: asynchroner Retry-Backoff statt `setTimeout` in synchroner Funktion.
- BL-WIN-7: Fehlerklassifikation `EPERM`/`EBUSY` retriable, `EACCES` nicht.
- BL-WIN-7 Option D: Temp-Datei bleibt im Zielverzeichnis.
- BL-WIN-7: Recherche-Zeitbox (4h) und Abbruchkriterien.
- Codex-Tracking: defensiver Plattform-Fallback; Risiko instabiler Windows-Support; klare Pfadpriorisierung.
- Tests: `atomic-file.test.ts`, `keychain.test.ts`, `paths.test.ts` erwähnt.
- Security: `logRedacted` Hinweis.
- Master-Icon / Design-Pass als visuelles Follow-up ausgegrenzt.
- Definition of Done für die Planungsphase ergänzt.

---

## 6. Ausgeführte Befehle und Ergebnisse

```bash
npm run typecheck  # ✅ grün
npm run lint       # ✅ grün
npm test           # ✅ 37 Test-Dateien, 341 passed, 6 skipped
npm run build      # ✅ grün
```

Keine unhandled rejections mehr nach der `TrackerLike`/`attachTracker` Korrektur.

---

## 7. Offene Punkte / Risiken

- **BL-WIN-6** bleibt blockiert bis zur Admin-Entscheidung.
- **BL-WIN-7** ist eine Heuristik; sehr langsame/lange Windows-Locks können trotzdem scheitern.
- **Codex-Tracking** auf Windows basiert auf Kandidatenpfaden, nicht auf empirisch verifizierten offiziellen Codex-Pfaden. Eine Testinstallation auf Windows wäre wünschenswert.
- Die Umwandlung von `atomicWriteFile` zu `async` hat eine weitreichende API-Änderung ausgelöst (`XpEngine`, `attachTracker`, `save*` Funktionen). Diese Änderung ist korrekt, aber sie muss bei zukünftigen Erweiterungen beachtet werden.

---

## 8. Nächste Schritte

1. Admin-Entscheidung für BL-WIN-6 einholen.
2. Nach Admin-Go: Refactor `keychain.ts` zu Interface + Factory + plattformspezifischen Implementierungen.
3. Optional: Windows-Testinstallation durchführen, um Codex-Pfade empirisch zu verifizieren.
4. Keine Commits durchgeführt — Änderungen liegen lokal vor.
