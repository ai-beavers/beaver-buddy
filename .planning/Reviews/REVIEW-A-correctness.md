# Review A — Correctness & Security

Branch: `bl-item/pixijs-puppet-studio/BL-14`  
Reviewer: A (Correctness & Security)  
Datum: 2026-07-18  

## Findings

### critical

- `src/renderer/index.html:1` — Pet-Overlay-Renderer hat keine `Content-Security-Policy`. Das widerspricht den P1-Electron-Hardening-Invarianten aus `CLAUDE.md` (CSP etc.). Das Settings-Fenster (`src/main/mrr/settings.html`) hat eine CSP, der Pet-Overlay aber nicht. Da der Renderer `fetch` für Sprite-Sheets und Meta-JSON verwendet, erlaubt eine fehlende CSP theoretisch jegliche `connect-src` / Navigation / Script-Ausführung, falls die Invarianten einmal durchkämen.  
  **Fix:** `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'">` in `src/renderer/index.html` ergänzen.

### major

- `src/main/mrr/mrr-engine.ts:38-40` (Start) + `pollNow()` (ab Zeile 55) — `MrrEngine.pollNow()` ist nicht gegen gleichzeitige Ausführung geschützt. Ein Timer-Tick (alle 24 h) und ein manueller `pollNow()` (z. B. über den `--mrr-poll-now`-Flag bei Moduswechsel) können sich überlappen. Beide rufen nacheinander `getLastMrrAwardDate()` auf, sehen beide `null`/einen alten Wert, führen beide Netzwerkabfragen durch und verleihen beide XP für denselben Tag. Die Test-Suite deckt das nicht ab, weil alle Mocks synchron sind.  
  **Fix:** Ein `private inFlight = false`-Guard in `MrrEngine` einführen; `pollNow()` soll sofort zurückkehren, wenn bereits ein Poll läuft.

- `src/main/mrr/settings-window.ts:147-150` — `win.loadFile(...).catch()` loggt nur `console.error` und lässt das Fenster offen. Wenn das HTML/Preload nicht geladen werden kann, bleibt ein leeres, nicht-funktionales Settings-Fenster bestehen. Für ein Fenster, in dem API-Keys eingegeben werden, ist das eine schwache Error-Recovery.  
  **Fix:** Im `catch`-Block `win.destroy()` aufrufen und `settingsWindow = null` setzen, damit ein erneuter Aufruf von `openSettingsWindow()` ein neues Fenster aufbaut.

### minor

- `src/main/atomic-file.ts:8` — Kommentar sagt "Three attempts", aber `RETRY_DELAYS_MS = [0, 10, 50, 100]` führt zu vier Versuchen (Attempt 0..3). Der Gesamtworst-Case-Wert stimmt, die Beschreibung ist irreführend.  
  **Fix:** Kommentar auf "Four attempts" korrigieren oder Array an den Kommentar anpassen.

- `src/main/usage/paths.ts:76-78` — `codexHomes` auf Windows gibt `path.join('', 'Codex')` zurück, wenn `LOCALAPPDATA`/`APPDATA` als leerer String gesetzt sind. Das ist ein relativer Pfad (`'Codex'`) im aktuellen Arbeitsverzeichnis. Zwar filtert `resolveCodexHomes` über `fs.existsSync`, aber falls tatsächlich ein `Codex`-Ordner im Arbeitsverzeichnis liegt, wird er fälschlich als Log-Quelle verwendet.  
  **Fix:** In `codexHomes` leere Strings vor dem `path.join` filtern oder Pfade auf Absolutheit prüfen.

- `tools/puppet-studio/studio.ts:50-90` — `loadRig` kann nach `await app.init()` fehlschlagen (z. B. Textur-Laden fehlerhaft). Die neu erstellte `Application` wird dann nicht zerstört, da `session` erst ganz am Ende zugewiesen wird. Bei häufigem Rig-Wechsel im Dev-Tool bleiben PixiJS-Canvas/Texturen im Speicher.  
  **Fix:** Nach Fehlern in `loadRig` `app.destroy(true)` aufrufen (z. B. in einem `finally` oder dedizierten `catch`).

## Test-Ergebnis

`npm test` (vitest run) ausgeführt:

```
Test Files  46 passed (46)
Tests       466 passed | 6 skipped (472)
Duration    3.43s
```

Alle 46 Test-Dateien und 466 Tests sind grün. Keine neuen Regressionen.

Windows-spezifische Abdeckung ist vorhanden:
- `src/main/overlay-adapter.test.ts` prüft Windows-Plattform (`win32`), Auto-Hide-Inset, sichtbare Taskbar und `always-on-top` Level.
- `src/main/usage/paths.test.ts` deckt `%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`, `CLAUDE_CONFIG_DIR` mit Semikolon-Separator und Deduplizierung auf Windows ab.
- `src/main/atomic-file.test.ts` deckt Windows-typische `EPERM`/`EBUSY`-Rename-Fehler ab.
- `src/main/mrr/secrets.test.ts` deckt Windows DPAPI (`safeStorage`) für `setSecret`/`getSecret`/`deleteSecret` ab.
- `src/main/installer-config.test.ts` deckt NSIS-Sprachkonfiguration ab.

## Geprüfte Dateien

Hauptprozess / Windows:
- `src/main/main.ts`
- `src/main/overlay-adapter.ts` (+ Test)
- `src/main/tray.ts` (+ Test)
- `src/main/atomic-file.ts` (+ Test)
- `src/main/usage/paths.ts` (+ Test)
- `src/main/usage/tracker.ts` (+ Test)
- `src/main/usage/read-lines.ts` (+ Test)
- `src/main/usage/claude-parser.ts` (+ Test)
- `src/main/usage/codex-parser.ts` (+ Test)
- `src/main/mrr/secrets.ts` (+ Test)
- `src/main/mrr/mrr-engine.ts` (+ Test)
- `src/main/mrr/settings-window.ts` (+ Test)
- `src/main/mrr/settings-validate.ts` (+ Test)
- `src/main/mrr/settings-preload.ts`
- `src/main/mrr/https-allowlist.ts` (+ Test)
- `src/main/mrr/stripe.ts` (+ Test)
- `src/main/mrr/revenuecat.ts` (+ Test)
- `src/main/hardening.ts`
- `src/main/preload.ts` (+ Test)
- `src/main/ipc-channels.ts` (+ Test)
- `src/main/app-icon.ts` (+ Test)
- `src/main/onboarding.ts` (+ Test)
- `src/main/pause-state.ts` (+ Test)
- `src/main/installer-config.test.ts`
- `electron-builder.yml`

Renderer:
- `src/renderer/index.html`
- `src/renderer/renderer.ts`
- `src/renderer/sprites.ts` (+ Test)

Puppet Studio:
- `tools/puppet-studio/studio.ts`
- `tools/puppet-studio/puppet.ts`
- `tools/puppet-studio/bake.ts`
- `tools/puppet-studio/keyframes.ts` (+ Test)
- `tools/puppet-studio/rig.ts` (+ Test)
- `tools/puppet-studio/sheet.ts` (+ Test)
- `tools/puppet-studio/anims/parachute.ts`
- `tools/puppet-studio/anims/index.ts`

## Verdict

**PR-ready: nein.**

Der Code ist grundsätzlich solide, die Test-Suite ist grün und die Windows-Portierung zeigt eine gute Plattform-Abdeckung. Allerdings blockiert das fehlende CSP im Pet-Overlay die Hardening-P1-Invarianten aus `CLAUDE.md`. Zusammen mit dem fehlenden Concurrency-Guard in `MrrEngine.pollNow` (potenzielle Doppel-XP-Verleihung) gibt es zwei konkrete Korrektheits-/Security-Probleme, die vor dem Merge behoben werden müssen. Die Minor-Findings sollten ebenfalls adressiert werden, sind aber kein Blocker.

Co-authored-by: rodgi040 <220582878+rodgi040@users.noreply.github.com>
