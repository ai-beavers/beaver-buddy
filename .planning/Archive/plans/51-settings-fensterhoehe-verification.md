# Item #51 — Plan-Verifikation: Settings-Fensterhöhe

Datum: 2026-07-17 · Geprüft: `.flightplan/Archive/plans/51-settings-fensterhoehe-plan.md` gegen
`src/main/mrr/settings-window.ts`, `src/main/mrr/settings.html`, `scripts/cdp-screenshot.mjs`,
`src/main/mrr/settings-window.test.ts`, `package.json`, `eslint.config.js`, `vitest.config.ts`,
`scripts/build-assets.js`, `node_modules/electron/electron.d.ts` (Electron 43.1.1),
`.flightplan/Reference/windows-native-flight-plan.md`, `.flightplan/Archive/plans/parity/bereich-2-connect-ui.md`,
`docs/design-reviews/`.

## Urteil: PLAN OK MIT KORREKTUREN

Kernentscheidung (`useContentSize: true` + gemessene Content-Höhe + 8 px Puffer), Messmethodik
(CDP `Runtime.evaluate`, Worst-Case-Fill), CDP-Skript-Erweiterung und Test-Ansatz sind gegen
die Codebase verifiziert und tragfähig. Kein Blocker. Drei Minor-Befunde (workArea-Kappung,
Windows-Textskalierung, Flight-Plan-Update-Schritt) vor der Umsetzung ergänzen.

## Befunde

### [minor] B1 — Keine Kappung an nutzbare Bildschirmhöhe (workArea)

Plan §3 setzt `height ≈ 735–750` (Content, via `useContentSize`). Gesamt-Fensterhöhe inkl.
Titelleiste ≈ 766–781 px. Der Plan diskutiert DPI-Skalierung nur als Rundungsproblem (<1 px,
§6), nicht als **logische Verkleinerung der workArea**:

- 1366×768-Laptop @100 %: workArea ≈ 728 px → Fenster ragt ~40–50 px unten raus.
- 1920×1080 @150 % Skalierung: logische Höhe 720 px, workArea nach Taskbar ≈ 688 px →
  Content 740 > 688; ausgerechnet die unteren Sektionen (Pet/Reset + `#status`), die der Fix
  sichtbar machen soll, liegen wieder außerhalb.

Funktional bleibt Scrollen möglich (kein Datenverlust), aber Akzeptanzkriterium 1/2
(„ohne Scrollen sichtbar") ist auf solchen Screens unerfüllbar. Empfehlung (1–2 Zeilen):
`height: Math.min(gemessen + 8, screen.getPrimaryDisplay().workAreaSize.height - 40)` —
`screen` ist im Main-Prozess verfügbar, `workAreaSize` ist logisch (DIP), also direkt
vergleichbar. Alternativ explizit als akzeptiertes Restrisiko im Verdict dokumentieren.
Fundstelle: Plan §3 (Zeile 100-131), `settings-window.ts:250-255`.

### [minor] B2 — Windows-Textskalierung (>100 %, Accessibility) nicht adressiert

„Text größer machen" skaliert die Renderer-Fonts und erhöht die Content-Höhe unabhängig von
DPI; der +8-px-Puffer deckt das nicht. Der Plan erwähnt es nicht. Da jede feste Höhe dagegen
nicht robust sein kann (es sei denn, man misst zur Laufzeit), als akzeptables Restrisiko im
Verdict vermerken — mehr ist im Rahmen dieses Items nicht sinnvoll. Fundstelle: Plan §6.

### [minor] B3 — Flight-Plan-Statusupdate fehlt als Schritt

`windows-native-flight-plan.md:267-271` hält Item #51 auf „Status: Offen"; Item #50 zeigt die
Konvention (✅ + Verweis auf Verifikationsbericht + Testzahlen, Zeile 265). Der Plan §4 listet
nur Code/Artefakte — der Flight-Plan-Eintrag (Status + Verweis auf diesen Bericht bzw. den
Umsetzungs-Verdict) sollte als expliziter Abschlussschritt ergänzt werden.

### [nit] B4 — Pin-Test: `BrowserWindow: vi.fn()` allein reicht nicht

Plan §4.3 skizziert `BrowserWindow: vi.fn()` — als Konstruktor aufgerufen liefert das ein
leeres Objekt, und `win.loadFile(...)` (`settings-window.ts:268`) würde werfen. Umsetzung muss
`BrowserWindow: vi.fn().mockImplementation(() => fakeWin)` (oder `mockReturnValue`) mit dem
skizzierten Fake-Win verwenden. Der Plan nennt das Fake-Win mit allen nötigen Membern
(`loadFile` resolving, `on`, `focus`, `isDestroyed`, `webContents`) — machbar, nur die Skizze
ist an dieser Stelle verkürzt. Zusätzlich: Modul-State (`settingsWindow`, `handlersRegistered`,
`settings-window.ts:42-43`) ist global — für genau einen neuen Test unkritisch, bei mehreren
Tests `vi.resetModules()`/Import-Isolation nötig.

### [nit] B5 — Worst-Case-Fill lässt Status-Spans aus

Der Fill deckt `#claudeTokens`/`#codexTokens`/`#status` ab (IDs verifiziert:
`settings.html:72,80,125`), nicht aber `#claudeStatus`/`#codexStatus` („enabled — logs not
found", `settings.html:159`). Wrap-Risiko gering (Button ≈ 160 px + Span ≈ 120 px + Gap <
Content-Breite 388 px), aber der „Worst-Case" ist formal nicht maximal. Kein Handlungsbedarf
über einen Halbsatz im Verdict hinaus.

## Verifizierte Annahmen (Stichprobe gegen Codebase)

1. **useContentSize-Semantik (Electron 43.1.1):** `electron.d.ts:4017-4021` — „The `width` and
   `height` would be used as web page's size, which means the actual window's size will include
   window frame's size and be slightly larger." Gilt für win32/darwin; bekannte Ungenauigkeiten
   betreffen exotische Linux-WMs (hier kein Target) und die min/max-Interaktion
   (`minWidth`/`minHeight` werden frame-basiert interpretiert) — beides irrelevant, da weder
   min/max gesetzt noch Linux unterstützt. DPI-Rundung ±1 px durch +8-Puffer gedeckt.
   **Plan-Behauptung §3 korrekt.**
2. **Fenster-Status quo:** `settings-window.ts:250-255` — `width: 420` (Zeile 251),
   `height: 680` (Zeile 254), `resizable: false` (255), kein `useContentSize`. **Exakt wie
   behauptet**, inkl. Kommentar Zeile 252-253.
3. **Item #50 ist gelandet:** `settings.html:63` — „usage logs on this computer". Messung kann
   gegen den finalen Textstand erfolgen.
4. **Launch-Flag:** `main.ts:335` — `process.argv.includes('--open-growth-settings')` →
   `openGrowthSettings()` (`main.ts:272-273` → `openSettingsWindow`). Tray-Codepfad identisch
   (`main.ts:329-330`). **Verifiziert.**
5. **CDP-Skript:** `cdp-screenshot.mjs:6` wählt erstes `page`-Target (= Overlay). Plain Node,
   built-in `fetch` (Zeile 5) und `WebSocket` (Zeile 12, global ab Node 22; `engines: node 24.x`
   in `package.json:8-10`). Die `--target`-Erweiterung (Substring-Match auf `t.title`/`t.url`)
   passt zur Datenstruktur von `/json`; `Page.enable` (Zeile 37) existiert bereits;
   `Runtime.evaluate` benötigt kein `Runtime.enable`. `returnByValue: true` ist korrekt für das
   Metrik-Objekt. **Keine neuen Dependencies — verifiziert.**
6. **Messmetrik body vs. documentElement:** `settings.html:16` setzt `body { margin: 16px }`;
   `document.documentElement.scrollHeight` enthält die durchgeschobenen body-Margins,
   `body.scrollHeight` kann hier bis ~32 px niedriger liegen. Der Plan misst beide und nimmt
   `docScrollH` als H (§2.2.3) — **die richtige Wahl**. `innerH`/`innerW` werden mitgemeldet
   (Plan Zeile 64) → Overflow direkt sichtbar (`hasVScroll`/`hasHScroll`).
7. **Test-Realismus:** `settings-window.test.ts` hat keinerlei Größen-Assertions (gegreppt) und
   ruft aktuell nur Electron-freie Handler. `vi.mock('electron', …)` ist etabliertes Repo-Muster
   (`src/main/tray.test.ts:46`, `overlay-adapter.test.ts:17`, `preload.test.ts:13`,
   `mrr/secrets.test.ts:8`). `hardening.ts:8` importiert `session` aus `electron` auf Top-Level —
   das geplante `vi.mock('../hardening')` verhindert dessen Laden, also sicher. `app.getAppPath()`
   wird in `settings-window.ts:257,268` verwendet → Mock muss es liefern (Plan tut das).
   **Machbar wie geplant** (mit B4-Präzisierung).
8. **Testzahl:** `npx vitest run` am 2026-07-17: **434 passed, 6 skipped, 43 Files** — exakt
   die Plan-Behauptung (§1 AK 5).
9. **dist-Rebuild:** `scripts/build-assets.js:8` kopiert `src/main/mrr/settings.html` →
   `dist/main/mrr/settings.html`; `npm run build` reicht also (Plan §2.2.1). dist-Stand aktuell
   vorhanden und enthält `settings.html`.
10. **eslint-Scope:** `eslint.config.js` hat keine `files`-Gruppe für `scripts/*.mjs` → auf
    `cdp-screenshot.mjs` greifen keine Regeln (nur Default-Parse). Plan-Hinweis §5 korrekt
    („falls im eslint-Scope" — ist er faktisch nicht).
11. **Namenskonvention:** `docs/design-reviews/BL-9-settings.png` + `BL-9-verdict.md` existieren
    → `BL-51-settings.png` / optionales `BL-51-verdict.md` passen. Screenshot liefert nur den
    Viewport (`Page.captureScreenshot`) — für den Overflow-Beweis korrekt (Plan §6 letzter Punkt).
12. **Horizontal-Overflow-Analyse:** `settings.html:27-32` (`width:100%` + `border-box`),
    `.row` mit `flex-wrap: wrap` (33-38), keine Fixbreiten — **Plan §6 korrekt**, keine
    CSS-Änderung nötig.
13. **Paritäts-Quelle:** `.flightplan/Archive/plans/parity/bereich-2-connect-ui.md` B2.2 (Zeilen
    20-28) existiert und trägt die zitierte Schätzung (Content ≈ 700–730 px, Viewport Win ≈ 649
    px) sowie denselben Fix-Vorschlag (messen via CDP, Target-Auswahl erweitern).
14. **Constraints:** keine neuen Dependencies (Skript bleibt builtin-only), Änderung minimal
    (3 Dateien + 1 Artefakt), macOS nicht schlechter (Content-Area 652 → ~740 px, Breite
    unverändert; argumentativ, von hier nicht live prüfbar — korrekt im Plan so markiert).

## Empfohlene Plan-Änderungen vor Umsetzung

1. B1: workArea-Kappung (`screen.getPrimaryDisplay().workAreaSize.height`) in §3/§4.1 ergänzen
   oder als Restrisiko deklarieren.
2. B2: Textskalierung als akzeptiertes Restrisiko in §6 aufnehmen.
3. B3: Abschlussschritt „Flight-Plan Item #51 auf ✅ setzen + Bericht verlinken" in §4/§5.
4. B4/B5: Test-Skizze um `mockImplementation` präzisieren; Halbsatz zu Status-Spans.
