# Code-Verifikation #47 — Tray-Linksklick öffnet Kontextmenü (Windows)

Geprüft: ausschließlich die #47-Hunks in `src/main/tray.ts` und `src/main/tray.test.ts` (`git diff`), dagegen die gepinnte Electron-API (`node_modules/electron/electron.d.ts`, electron **43.1.0**), `src/main/main.ts`, `package.json`/`package-lock.json`. Plan: `47-tray-single-click-plan.md`, Plan-Verifikation: `47-tray-single-click-verification.md`.

## Urteil: FREIGABE

Keine Blocker, keine Minor-Befunde mit Handlungsbedarf. Die Umsetzung entspricht exakt dem Plan (§3-Skizze wortgleich übernommen) und ist fachlich korrekt.

## Verifizierte Punkte

### 1. Korrektheit der Produktionsänderung (`tray.ts:96-105`)

- **Einmalige Registrierung:** Der `click`-Handler steht in `createTray()` direkt nach `tray.setToolTip()` (`tray.ts:94`) und **außerhalb** von `rebuildMenu()` (`tray.ts:107-115`). `createTray()` läuft exakt einmal (`main.ts:279`, einziger Aufruf) → kein Handler-Stacking möglich. ✔
- **Gate:** `process.platform === 'win32'` (`tray.ts:103`), Laufzeit-Check wie in `loadTrayIcon()` (`tray.ts:82-85`) — gleiches Muster, gleiche Testbarkeit. ✔
- **`popUpContextMenu()` argumentlos:** d.ts:15382 bestätigt Signatur `popUpContextMenu(menu?: Menu, position?: Point)` mit Doc „Pops up the context menu of the tray icon. When `menu` is passed, the `menu` will be shown instead…" → ohne Argument öffnet er das zuletzt per `setContextMenu()` gesetzte Menü. Closure captured nur `tray`, nie ein `Menu`-Objekt → rebuild-sicher. ✔
- **Kommentar fachlich korrekt:** „popUpContextMenu() exists only on darwin/win32 (not Linux)" — bestätigt durch `@platform darwin,win32` (d.ts:15380). „Electron only shows a setContextMenu() menu on right-click there [Windows]" — korrekt (Rechtsklick-Default; `click` feuert unter Windows nur für Linksklick, Rechtsklick feuert `right-click` → kein Doppel-Popup mit dem Default-Menü). Keine falschen Electron-Behauptungen; die aus der Plan-Verifikation angemerkte darwin-Emissions-Behauptung (M1) wurde im Kommentar vermieden. ✔

### 2. Tests (`tray.test.ts`)

- **Echte Asserts, kein Smoke:** Listener-Anzahl (`toHaveLength(1)`), Argumentlosigkeit (`popUpContextMenuCalls` `toEqual([[]])` — leere Arg-Liste), Stacking-Test nach 2× `refresh()` (3× `setContextMenu`, weiterhin 1 Listener, Listener funktioniert danach), darwin/linux-Negativtests inkl. Menü-Bau-Kontrolle (`setContextMenuCalls` `toHaveLength(1)`). ✔
- **Mock ehrlich:** `FakeTray` deckt alle von `createTray()` genutzten APIs ab (`on` mit Listener-Map pro Event, `popUpContextMenu` mit Arg-Protokoll, `setContextMenu`-Zähler, `setToolTip`); Instanzen statisch gesammelt, Zugriff über `FakeTray.instances` statt `handle.tray` (vermeidet Casts, wie in M4 der Plan-Verifikation empfohlen). ✔
- **`process.platform` sauber gemockt und wiederhergestellt:** `withPlatform` (`tray.test.ts:79-87`) sichert den Original-Deskriptor und stellt ihn im `finally` wieder her — kein Leak, auch nicht bei Throw. Der Helper wurde unverändert von `loadTrayIcon`-Describe auf Modulebene gehoben (Plan §3). Funktioniert, weil `defineProperty` auf einer existierenden Property nur die angegebenen Attribute ändert (configurable bleibt erhalten). Gesamtsuite grün → kein Cross-Test-Leak nachweisbar. ✔
- **`vi.hoisted` korrekt:** Die `vi.mock`-Factory referenziert `FakeTray` zum Mock-Auswertungszeitpunkt, der vor modulweiten `const`-Initialisierungen liegt — ohne Hoisting TDZ-Fehler. Begründung im Kommentar (`tray.test.ts:8-11`) korrekt; Testlauf bestätigt es. ✔
- **Isoliert + Gesamtsuite stabil:** `npx vitest run src/main/tray.test.ts` → 18/18 grün; volle Suite siehe unten. ✔

### 3. Nebenwirkungen

- Bestehende Suites (`formatPetLabel`, `buildMenuTemplate` ×2, `loadTrayIcon`) inhaltlich unverändert; einzige Berührung: `withPlatform`-Verschiebung und präzisierter Mock-Erklärkommentar. ✔
- `main.ts`: kein Eingriff nötig und im #47-Scope keiner geschehen (Handler-Registrierung komplett innerhalb `createTray()`). ✔
- `package.json`: Diff enthält nur zwei Asset-Skript-Zeilen aus älteren Runden, **keine** #47-bezogene Änderung, keine neue Dependency. `package-lock.json`: unverändert. ✔
- Electron bleibt gepinnt auf 43.1.0 (`package.json:27`). ✔

### 4. Ausgeführte Checks

- `npx vitest run` → **42 Dateien passed, 393 passed | 6 skipped (399)** — exakt die behauptete Zahl (Baseline 389 + 4 neue). ✔
- `npx vitest run src/main/tray.test.ts` → 18/18 passed (isoliert stabil). ✔
- `npx eslint src/main/tray.ts src/main/tray.test.ts` → sauber, keine Meldungen. ✔

### 5. Fachliche Risikobewertung (click-Handler-Szenarien)

- **Doppelklick (win32):** `double-click` feuert zusätzlich zu zwei `click`-Events → zwei `popUpContextMenu()`-Aufrufe (Menü schließt/öffnet sich erneut). Kosmetisch, vom Plan §5 bewusst ohne Code akzeptiert (KISS). **akzeptabel.**
- **Menü offen + erneuter Linksklick:** Fokusverlust schließt das Menü, der Handler öffnet es sofort wieder (kurzes Flackern möglich). Standardverhalten von `popUpContextMenu`, kosmetisch. **akzeptabel.**
- **Schnelles Mehrfachklicken:** Nur ein Listener registriert → keine kumulierenden Pop-ups; wiederholtes `popUpContextMenu()` ist idempotent-artig (re-popup). **akzeptabel.**
- **Tray im Pause-Zustand:** Der Handler captured keinen Zustand und hält kein `Menu`-Objekt; Pause-Toggle läuft über Menu-Item-`click` → `onTogglePause` → `rebuildMenu()` → `setContextMenu()`. Der Linksklick-Handler zeigt danach automatisch das frische Menü (durch den Stacking-Test mit `refresh()` abgesichert). **kein Risiko.**
- **Rechtsklick unverändert:** `click` feuert unter Windows nur für Linksklick; das `setContextMenu()`-Defaultverhalten (Rechtsklick) wird nicht angefasst. **kein Risiko.**
- **darwin/linux:** Gate hält beide Pfade byte-identisch; auf Linux wäre `popUpContextMenu` ohne Gate nicht vorhanden (`@platform darwin,win32`) — Gate ist zwingend und korrekt gesetzt. **kein Risiko.**

## Befunde

Keine (weder blocker noch minor). Die aus der Plan-Verifikation offenen Punkte M1 (darwin-Kommentar-Behauptung), M2 (Linux-Begründung im Kommentar) und M4 (statischer FakeTray-Zugriff) sind in der Umsetzung alle adressiert: der Kommentar nennt die Linux-Plattform-Einschränkung explizit und vermeidet die nicht hart belegbare darwin-Emissions-Behauptung; die Tests greifen über `FakeTray.instances` zu.

## Bewusste Nicht-Verifikation

Natives Windows-Laufzeitverhalten (tatsächliches Menü-Popup bei Linksklick) ist per Unit-Test nicht prüfbar — die Tests verifizieren das Wiring gegen eine Fake-`Tray`-Klasse. Laut Plan §4 ist dafür eine manuelle Live-Verifikation auf Windows vorgesehen; diese liegt außerhalb dieser Code-Verifikation.
