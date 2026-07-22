# Verifikation Plan #47 — Tray-Linksklick öffnet Kontextmenü (Windows)

Geprüft: `.flightplan/Archive/plans/47-tray-single-click-plan.md` gegen `src/main/tray.ts`, `src/main/tray.test.ts`, `src/main/main.ts`, `package.json` und die im Projekt gepinnte Electron-API (`node_modules/electron/electron.d.ts`, electron **43.1.0**).

## Urteil: PLAN OK (keine Blocker, nur Klarstellungen/minor)

Der Plan ist technisch korrekt, deckt sich mit der echten Codebase und mit der gepinnten Electron-API. Umsetzbar wie geschrieben.

## Verifizierte Annahmen

1. **`click` feuert unter Windows bei Linksklick trotz gesetztem `setContextMenu()`** — Die Event-Unterdrückung bei gesetztem ContextMenu ist eine macOS-Einschränkung (in `electron.d.ts` an den darwin-only Events `mouse-up`/`mouse-down` dokumentiert: „This will not be emitted if you have set a context menu… as a result of macOS-level constraints", d.ts ~Zeile 15230). Für Windows existiert keine solche Notiz; das Muster `tray.on('click')` + gesetztes ContextMenu ist der seit Jahren dokumentierte Standardweg. ✔
2. **`popUpContextMenu()` ohne Argument öffnet das zuletzt per `setContextMenu()` gesetzte Menü** — d.ts:15382 Doc: „Pops up the context menu of the tray icon. When `menu` is passed, the `menu` will be shown instead of the tray icon's context menu." Da `rebuildMenu()` (`tray.ts:96-104`) bei jedem `refresh()` `setContextMenu()` erneut aufruft, zeigt der einmalig registrierte Handler stets das frische Menü. Rebuild-sicher wie behauptet. ✔
3. **macOS-Verhalten / Gate-Rechtfertigung** — Auf macOS öffnet ein gesetztes ContextMenu nativ bei Linksklick; das win32-Gate lässt darwin byte-identisch. Selbst falls das Gate vergessen würde, gäbe es auf darwin kein Doppel-Öffnen-Risiko (click-Emission ist bei gesetztem Menü auf macOS unterdrückt — siehe Befund M1 zur Belegstärke). **Zusätzlich verifiziert, im Plan nicht erwähnt:** `popUpContextMenu` ist `@platform darwin,win32` (d.ts:15382) — auf Linux gar nicht verfügbar. Das Gate ist damit für Linux nicht nur konservativ, sondern zwingend. ✔
4. **Stolpersteine** — `bounds`-Argument des `click`-Events: irrelevant, Handler ignoriert Argumente. `double-click` feuert zusätzlich zu zwei `click`-Events → bei Doppelklick zwei `popUpContextMenu()`-Aufrufe: kosmetisch, vom Plan (§5) im analogen Fall „Menü offen + erneuter Klick" bereits abgedeckt. Electron 43.1.0 ist gepinnt (`package.json:27`); Tray-API seit vielen Major-Versionen stabil, Signaturen gegen die mitgelieferte `electron.d.ts` verifiziert. ✔
5. **Code-Fit** — `createTray()` läuft exakt einmal (`main.ts:279`, einziger Aufruf; einziges `new Tray` in `tray.ts:93`; kein zweiter Tray-Erzeugungspfad). Platzierung nach `tray.setToolTip(...)` (`tray.ts:94`) und vor dem ersten `rebuildMenu()` (`tray.ts:106`) ist korrekt; Closure captured nur `tray`, kein `Menu`-Objekt. Kein Handler-Stacking, da Registrierung außerhalb von `rebuildMenu()`. Zeilen-Referenzen des Plans (`tray.ts:82-85`, `94`, `96-104`; `main.ts:307`; `tray.test.ts:8-29`, `31-35`, `154-162`, `165`) stimmen alle. ✔
6. **Test-Mock-Struktur trägt die neuen Tests** — Die `vi.mock('electron')`-Factory (`tray.test.ts:8-29`) spreadet `...actual` und überschreibt `app`/`nativeImage`; das Hinzufügen von Fake-`Tray` + `Menu.buildFromTemplate` folgt exakt diesem Muster. Bestehende Suites (`formatPetLabel`, `buildMenuTemplate`, `loadTrayIcon`) rufen zur Laufzeit nie `Tray`/`Menu` auf → kein Bruch. `withPlatform`-Helper (`tray.test.ts:154-162`) muss auf Modulebene gehoben werden — der Plan sagt das explizit. ✔
7. **Scope/Constraints plausibel** — Keine neuen Dependencies nötig (Electron-Bordmittel), keine `main.ts`-Änderung nötig (Handler-Registrierung komplett innerhalb `createTray()`). ✔
8. **Test-Baseline stimmt** — `npm test` lokal ausgeführt: **42 Dateien, 389 passed, 6 skipped** — exakt die Zahl, die der Plan als Ausgangslage nennt. ✔

## Befunde

- **[minor] M1 — Belegstärke der macOS-click-Behauptung** (Plan §2.3, geplanter Kommentar in `tray.ts`): „Electron emittiert auf macOS das `click`-Event gar nicht, solange ein ContextMenu gesetzt ist" — in der gepinnten `electron.d.ts` (43.1.0) steht die Unterdrückungs-Notiz nur an den darwin-Events `mouse-up`/`mouse-down`, nicht am `click`-Event selbst. Die Verhaltensaussage entspricht der offiziellen Tray-Doku nach meinem Kenntnisstand, ist aber aus dem Repo allein nicht hart belegbar. Konsequenz: keine — das Gate macht macOS unberührt und das Verhalten damit irrelevant. Optional den Kommentar abschwächen („macOS opens the context menu on left-click natively") statt die Emissions-Behauptung als Fakt zu formulieren.
- **[minor] M2 — Linux-Begründung ergänzenswert** (Plan §2.3 / Code-Kommentar): `popUpContextMenu` ist `@platform darwin,win32` (d.ts:15382) — auf Linux würde ein ungegatter Handler auf nicht vorhandener API laufen. Das Gate ist also notwendig, nicht nur vorsichtig. Ein Halbsatz im Kommentar würde das dokumentieren.
- **[minor] M3 — Doppelklick öffnet Menü zweimal** (Windows): `double-click` feuert zusätzlich zu zwei `click`-Events. Kosmetisch; Plan §5 deckt den analogen Fall ab. Kein Code nötig (KISS), ggf. im Umsetzungs-Kommentar als bekanntes Verhalten festhalten.
- **[minor] M4 — Implementierungsdetail Test** (`tray.test.ts`): `TrayHandle.tray` bleibt als echter `Tray` typisiert; die neuen Tests sollten Listener-/Zähler-Zugriffe über `FakeTray.instances` (statisch) machen, nicht über `handle.tray` — sonst Casts nötig. Entspricht der Plan-Skizze (§3, `static instances`), nur als Erinnerung für die Umsetzung.

## Nichts vergessen?

- Pause/refresh-Interaktion: verifiziert — `refresh()` ruft nur `setContextMenu()`, der einmalig registrierte Handler bleibt gültig (Akzeptanzkriterium 4 des Plans erfüllbar).
- ToolTip, QA-Seam (`onMenuBuilt`, `--debug-tray-menu`), `--inject-xp`-Pfad: unberührt, keine Wechselwirkung.
- „Menü offen + erneuter Linksklick": vom Plan §5 adressiert (kosmetisch, kein Code).
- Manuelle Live-Verifikation auf Windows: im Plan §4 vorgesehen — sinnvoll, da die Unit-Tests nur das Wiring prüfen (Mock-Ehrlichkeit, Plan §5).

## Bewusste Nicht-Verifikation

Die macOS-Verhaltensdetails (M1) beruhen auf Electron-Kenntnis, nicht auf einer Live-Prüfung der 43.1.0-Doku — wie vom Auftrag gefordert explizit geflaggt. Auswirkung auf das Urteil: keine, da das win32-Gate beide Seiten absichert.
