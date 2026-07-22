# Plan #47 — Tray-Kontextmenü öffnet unter Windows auch per Linksklick

## 1. Ziel & Akzeptanzkriterien

Unter Windows öffnet ein einzelner **Linksklick** auf das Tray-Icon dasselbe Kontextmenü, das heute nur per Rechtsklick kommt (Electron: `tray.on('click')` + `tray.popUpContextMenu()`).

Akzeptanzkriterien:

- Linksklick auf das Tray-Icon öffnet unter Windows das aktuelle Kontextmenü (identischer Inhalt wie Rechtsklick: Pet-Label, Pause/Resume, Growth-Submenu, Quit).
- Rechtsklick funktioniert weiterhin exakt wie bisher (Default-Verhalten von `setContextMenu()` wird nicht angefasst).
- macOS-Verhalten bleibt **byte-identisch**: kein Handler, kein Doppel-Öffnen. Linux ebenfalls unverändert.
- Das Menü zeigt nach einem `refresh()` (z. B. XP-Update, Pause-Toggle) weiterhin den aktuellen Stand — der Linksklick-Handler darf kein veraltetes `Menu`-Objekt festhalten.
- Kein Handler-Stacking: `refresh()` läuft bei jedem XP-Update (`main.ts:307`) — die Registrierung erfolgt exakt einmal, nicht pro Rebuild.
- Änderung auf `src/main/tray.ts` + `src/main/tray.test.ts` begrenzt. Keine neuen Dependencies, `package.json`/`package-lock.json` unverändert.
- `npm test` (389 bestehende Tests + neue) grün, `npm run typecheck` und `npm run lint` sauber.

## 2. Design-Entscheidung

### 2.1 Handler-Platzierung: einmalig in `createTray()`, nie in `rebuildMenu()`

`rebuildMenu()` (`src/main/tray.ts:96-104`) wird bei jeder Zustandsänderung erneut aufgerufen — u. a. bei jedem XP-Tick über `tray.refresh()` in `main.ts:307`. Ein Listener, der dort registriert würde, würde sich pro Rebuild akkumulieren (N Pop-ups pro Klick). Der Handler wird daher **einmalig** in `createTray()` direkt nach `tray.setToolTip(...)` (`tray.ts:94`) registriert, **vor** dem ersten `rebuildMenu()`-Aufruf.

### 2.2 Rebuild-Sicherheit: `popUpContextMenu()` ohne Argument

Der Handler ruft `tray.popUpContextMenu()` **ohne Argumente** auf. Laut Electron-API öffnet der Aufruf ohne `menu`-Parameter das jeweils zuletzt via `setContextMenu()` gesetzte Menü. Der Closure captured damit nur `tray`, nie ein `Menu`-Objekt — nach jedem `refresh()` zeigt derselbe eine Handler automatisch das frisch gebaute Menü. Kein zusätzlicher State, kein Update-Pfad nötig.

### 2.3 Plattform-Gate: ja, `process.platform === 'win32'`

**Entscheidung: Der Handler wird nur auf Windows registriert.**

Begründung:

- **macOS:** Ein via `setContextMenu()` gesetztes Menü öffnet dort nativ bereits bei Linksklick (gewünschtes Verhalten existiert). Ob Electron das `click`-Event bei gesetztem Menü auf darwin unterdrückt, ist in der gepinnten `electron.d.ts` (43.1.0) nicht dokumentiert (die Unterdrückungs-Notiz steht nur an `mouse-up`/`mouse-down`) — die Implementierung spekuliert nicht darüber: das Gate hält macOS byte-identisch, unabhängig vom darwin-click-Verhalten.
- **Linux:** `popUpContextMenu` ist laut gepinnter `electron.d.ts` als `@platform darwin,win32` markiert (d.ts:15380) — auf Linux nicht verfügbar; ein ungegatter Handler würde dort auf nicht vorhandener API laufen. Das Gate ist damit **zwingend**, nicht nur vorsichtig. (Zusätzlich ist der Tray-Klick-Support je nach Desktop/AppIndicator uneinheitlich.)
- **Windows:** Linksklick = „Aktion/Menü öffnen" ist die etablierte Tray-Konvention (Owner-Wunsch). Das `click`-Event feuert auf Windows nur für Linksklick; Rechtsklick löst weiterhin das Default-ContextMenu aus (plus `right-click`-Event, das wir nicht nutzen). Kein Konflikt, kein Doppel-Popup.
- `process.platform` wird zur Laufzeit in `createTray()` gelesen — gleiches Muster wie `loadTrayIcon()` (`tray.ts:82-85`), dadurch mit dem bestehenden `withPlatform`-Testhelfer prüfbar.

### 2.4 Testbarkeit ohne Extraktion neuer Produktions-Funktionen

`createTray()` ist heute bewusst untestbar (`tray.test.ts:31-35`: Electron-Import liefert unter Node nur einen Pfad-String; die Tests rufen nie `Tray`/`Menu`-APIs auf). Statt Produktionscode zu verbiegen (extrahierte `attachSingleClickMenu`-Hilfsfunktion als Fallback verworfen), wird der **bestehende Electron-Mock in `tray.test.ts`** um eine minimale Fake-`Tray`-Klasse und `Menu.buildFromTemplate` erweitert. Damit wird `createTray()` selbst durchtestbar — inklusive der zwei riskanten Eigenschaften (genau-eine-Registrierung, Plattform-Gate), die eine extrahierte Hilfsfunktion gerade *nicht* abdecken würde. Änderung bleibt auf die zwei Zieldateien begrenzt.

## 3. Konkrete Änderungsliste pro Datei

### `src/main/tray.ts` (einziger Produktions-Eingriff, ~8 Zeilen inkl. Kommentar)

In `createTray()`, direkt nach Zeile 94 (`tray.setToolTip('Beaver Buddy');`), einfügen:

```ts
// Windows convention: a single left-click opens the tray menu, but Electron
// only shows a setContextMenu() menu on right-click there — wire it manually.
// win32-gated: popUpContextMenu() exists only on darwin/win32 (not Linux),
// and the gate keeps macOS/Linux behavior byte-identical. Registered once,
// outside rebuildMenu(): popUpContextMenu() without arguments always pops
// the menu most recently passed to setContextMenu(), so refresh() needs no
// handler changes.
if (process.platform === 'win32') {
  tray.on('click', () => tray.popUpContextMenu());
}
```

Kommentar-Stil folgt der Datei (englisch, erklärende Block-Kommentare wie `tray.ts:26-27`, `77-80`). Keine Änderung an `buildMenuTemplate`, `rebuildMenu`, `TrayHandle`, `main.ts` oder anderen Dateien.

### `src/main/tray.test.ts` (Test-Infrastruktur + neue Tests)

1. **`vi.mock('electron', …)`-Factory erweitern** (heute Zeilen 8-29): zusätzlich zu `app`/`nativeImage` exportiert der Mock
   - eine Fake-`Tray`-Klasse: sammelt Instanzen (`static instances`), speichert Listener pro Event (`on(event, listener)` → `Map<string, Array<() => void>>`), zählt `popUpContextMenu()`-Aufrufe inkl. Argumentliste, protokolliert `setContextMenu()`-Aufrufe. Konstruktor nimmt das Icon entgegen (Mock-`nativeImage` liefert bereits ein Plain-Objekt).
   - `Menu: { buildFromTemplate: vi.fn((template) => ({ template })) }` — Rückgabewert ist irrelevant, da nur `setContextMenu`-Aufrufe gezählt werden.
   - `...actual`-Spread und die bestehenden `app`/`nativeImage`-Mocks bleiben unverändert → kein Bruch der laufenden Tests.
2. **Erklär-Kommentar (Zeilen 31-35) aktualisieren**: die Aussage „never calling Tray/Menu/app APIs" präzisieren — ab jetzt werden die *gemockten* `Tray`/`Menu`-APIs aufgerufen; weiterhin kein echter Electron-Prozess nötig.
3. **Neues `describe('createTray single-click menu')`** mit `withPlatform`-Helper (Muster aus `loadTrayIcon`-Tests, Zeilen 154-162, ggf. auf Modulebene heben, damit beide Describes ihn nutzen) und dem bestehenden `callbacks()`-Factory-Muster:
   - **win32 registriert genau einen `click`-Listener**, dessen Aufruf `popUpContextMenu` exakt einmal **ohne Argumente** aufruft (Rebuild-Sicherheit: kein Menu-Objekt gecaptured).
   - **Kein Stacking:** nach `handle.refresh(); handle.refresh();` existiert weiterhin genau **ein** `click`-Listener; der Listener funktioniert danach weiterhin (`popUpContextMenu`-Zähler inkrementiert).
   - **darwin:** `createTray()` registriert **keinen** `click`-Listener; `setContextMenu` wurde trotzdem aufgerufen (Rebuild-Pfad unverändert).
   - **linux:** kein `click`-Listener (Gate ist win32-spezifisch).
   - `beforeEach`: `FakeTray.instances.length = 0` zurücksetzen (Muster: `createdIcons.length = 0`, Zeile 165).
   - Zugriff auf Listener/Zähler statisch über `FakeTray.instances`, nicht über `handle.tray` (`TrayHandle.tray` bleibt als echter `Tray` typisiert — sonst wären Casts nötig).
   - Die Fake-Klasse wird per `vi.hoisted` definiert: die `vi.mock`-Factory läuft vor modulweiten Deklarationen, ein direkter Verweis auf eine Top-Level-Klasse läge in der TDZ (die bestehende `createdIcons`-Referenz funktioniert nur, weil sie innerhalb des `createFromPath`-Callbacks verzögert ausgewertet wird).

## 4. Testplan

- `npm test` — alle 389 bestehenden Tests plus die ~4 neuen grün. Bestehende Suites (`formatPetLabel`, `buildMenuTemplate`, `loadTrayIcon`) dürfen sich nicht ändern.
- `npm run typecheck` — sauber (Fake-`Tray` wird nur im Testfile typisiert; Produktions-Typen von `TrayHandle.tray: Tray` unberührt).
- `npm run lint` — sauber.
- **Manuelle Live-Verifikation auf Windows** (nach Umsetzung, nicht Teil des Unit-Tests — gleiche Kategorie wie „visual tray verified live", vgl. `docs/design-reviews`): App starten, einmal Linksklick aufs Tray-Icon → Menü öffnet sich; Rechtsklick → Menü öffnet sich identisch; Pause togglen / XP injizieren (`--inject-xp`), dann erneut Linksklick → Menü zeigt aktualisiertes Label. Optional im Verifikations-Report festhalten.

## 5. Risiken / Offenes

- **Doppel-Popup auf Windows bei offenem Menü:** Bei bereits offenem Menü kann ein weiterer Linksklick das Menü schließen und sofort wieder öffnen (Standardverhalten von `popUpContextMenu`) — kosmetisch, akzeptabel, kein Code nötig.
- **Doppelklick auf Windows:** `double-click` feuert zusätzlich zu zwei `click`-Events → zwei `popUpContextMenu()`-Aufrufe (Menü schließt und öffnet sich). Kosmetisch, bekannt, bewusst kein Code (KISS).
- **Electron-Versionsdrift:** Die Aussage zu argumentlosem `popUpContextMenu()` beruht auf der gepinnten Electron-API (43.1.0), daher kein akutes Risiko. Über das darwin-`click`-Verhalten wird bewusst keine Annahme getroffen (siehe §2.3); das Gate macht die Windows-Änderung davon unabhängig.
- **Mock-Ehrlichkeit:** Die Fake-`Tray`-Klasse prüft Wiring, nicht natives Verhalten — bewusster Trade-off, durch die manuelle Windows-Live-Verifikation (Abschnitt 4) abgedeckt. Risiko, dass die Fakes von der echten API abweichen, ist bei drei Methoden (`on`, `popUpContextMenu`, `setContextMenu`) minimal.
- **Offen (kein Blocker):** Ob Linksklick langfristig statt Menü eine andere Primäraktion (z. B. Overlay-Fokus) bekommen soll, ist eine separate Product-Entscheidung — diese Änderung implementiert ausschließlich den Owner-Wunsch „Linksklick = Menü".
