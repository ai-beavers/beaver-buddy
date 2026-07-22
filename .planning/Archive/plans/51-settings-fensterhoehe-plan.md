# Item #51 — Settings-Fensterhöhe: messen, dann setzen

Datum: 2026-07-17 · Branch: bl-item/windows-native/BL-WIN · Status: Umsetzung Runde 2
(2026-07-17) — Verifikations-Korrekturen B1–B5 aus
`51-settings-fensterhoehe-verification.md` (Urteil: PLAN OK MIT KORREKTUREN) eingearbeitet.

## 1. Ziel & Akzeptanzkriterien

Das Growth-Settings-Fenster (`src/main/mrr/settings-window.ts:250-255`, aktuell 420×680,
`resizable: false`, kein `useContentSize`) zeigt nach dem Merge 5 Fieldsets + Statuszeile.
Die Paritäts-Analyse (`.flightplan/Archive/plans/parity/bereich-2-connect-ui.md`, B2.2) schätzt
Content ≈ 700–730 CSS-px vs. Windows-Viewport ≈ 649 px → Pet/Reset-Sektion und `#status`
liegen ~50–80 px below the fold; unter Windows ist die Scrollbar dauerhaft sichtbar.

Akzeptanzkriterien:

1. **Gemessen, nicht geschätzt:** Die echte Content-Höhe ist per CDP `Runtime.evaluate`
   (`document.body.scrollHeight` / `document.documentElement.scrollHeight`) auf Windows
   ermittelt und im Commit/Verdict dokumentiert — inkl. Worst-Case (beide Token-Zeilen
   `#claudeTokens`/`#codexTokens` gefüllt, Status-Spans `#claudeStatus`/`#codexStatus`
   gefüllt, `#status` belegt).
2. Beim Öffnen sind **alle 5 Fieldsets inkl. kompletter Reset-Danger-Zone und die
   Statuszeile ohne Scrollen sichtbar** — auf Windows **und** macOS (gleiche `height`
   gilt plattformübergreifend; macOS-Viewport wird gegenüber heute nicht kleiner).
3. Post-fix CDP-Messung belegt: `scrollHeight ≤ innerHeight` (kein vertikaler Overflow)
   und kein horizontaler Overflow (`scrollWidth ≤ innerWidth`).
4. **Screenshot-Beweis (Windows):** `docs/design-reviews/BL-51-settings.png` zeigt das
   geöffnete Fenster mit allen Sektionen inkl. Reset-Button, ohne sichtbare Scrollbar.
5. `npm test` (434 Tests + neuer Größen-Pin-Test), `npm run lint`, `npm run typecheck` grün.

## 2. Mess-Ansatz: cdp-screenshot.mjs erweitern

Bestand (`scripts/cdp-screenshot.mjs`, 45 Zeilen, plain Node, built-in `fetch`/`WebSocket`):
wählt aktuell das **erste** `page`-Target → das ist das Pet-Overlay, nicht das Settings-Fenster.

### 2.1 Änderungen an `scripts/cdp-screenshot.mjs` (minimal, rückwärtskompatibel)

- **Arg-Parsing:** Positionale Args (`port`, `outfile`, `delayMs`) wie bisher; neue optionale
  Flags werden aus `process.argv` herausgefiltert (`--target=…`, `--measure`).
  `outfile` darf `-` sein → kein Screenshot (reiner Messlauf).
- **`--target=<substring>`** (case-insensitive Substring-Match auf `t.title` **oder** `t.url`):
  ```js
  const page = list.find((t) =>
    t.type === 'page' &&
    (!targetMatch ||
      (t.title || '').toLowerCase().includes(targetMatch) ||
      (t.url || '').toLowerCase().includes(targetMatch)));
  ```
  Ohne Flag: exakt das bisherige Verhalten (erstes page-Target). Match für das
  Settings-Fenster: `--target=settings.html` (URL ist `file://…/dist/main/mrr/settings.html`;
  Fenstertitel „Beaver Buddy — Settings" / HTML-`<title>` „Settings" → auch
  `--target=settings` matcht).
- **`--measure`:** vor dem Screenshot ein `Runtime.evaluate` mit `returnByValue: true`,
  Ausgabe als eine `METRICS {…}`-Zeile auf stdout. Der Ausdruck misst den **Worst-Case**:
  Er füllt zuerst die Status-Spans (`#claudeStatus`, `#codexStatus`), die beiden
  Token-Zeilen (`#claudeTokens`, `#codexTokens`) und `#status` mit repräsentativem Text,
  liest synchron die Höhen (read erzwingt Layout) und stellt den DOM im selben Evaluate
  wieder her — so bleibt der danach aufgenommene Screenshot unverändert:
  ```js
  (() => {
    const fill = [['claudeStatus','enabled — logs not found'],
                  ['codexStatus','enabled — logs not found'],
                  ['claudeTokens','today: 12,345 · lifetime: 1,234,567'],
                  ['codexTokens','today: 12,345 · lifetime: 1,234,567'],
                  ['status','connected']];
    const saved = fill.map(([id, t]) => { const el = document.getElementById(id);
      if (!el) return null; const old = el.textContent; el.textContent = t; return [el, old]; });
    const m = {
      bodyScrollH: document.body.scrollHeight,
      docScrollH: document.documentElement.scrollHeight,
      innerH: window.innerHeight, innerW: window.innerWidth,
      docScrollW: document.documentElement.scrollWidth,
    };
    m.hasVScroll = m.docScrollH > m.innerH;
    m.hasHScroll = m.docScrollW > m.innerW;
    saved.forEach((s) => { if (s) s[0].textContent = s[1]; });
    return m;
  })()
  ```
  (Verifikations-Nit B5: `#claudeStatus`/`#codexStatus` sind jetzt im Fill enthalten, damit
  der Worst-Case formal maximal ist.)
- Keine neuen Dependencies; `Page.captureScreenshot`-Pfad bleibt unverändert.

### 2.2 Mess-Prozedur (Windows, BL-9-Isolationsmuster)

1. `npm run build` (App lädt `dist/main/mrr/settings.html`, Build ist Pflicht).
2. Isolierter Start wie BL-9/BL-10 (scratch-dirs, nie echte Logs/Config):
   ```bash
   scratch=$(mktemp -d)
   CLAUDE_CONFIG_DIR="$scratch/claude" CODEX_HOME="$scratch/codex" \
     npx electron . --user-data-dir="$scratch/ud" \
     --open-growth-settings --remote-debugging-port=9222 &
   ```
   (`--open-growth-settings` verifiziert: `src/main/main.ts:335` → `openGrowthSettings()`
   → exakt der Tray-Codepfad.)
3. Messen (Worst-Case dank Fill-Logik):
   ```bash
   node scripts/cdp-screenshot.mjs 9222 - 3000 --target=settings.html --measure
   ```
   Erwartet: `hasVScroll: true`, `docScrollH` ≈ 700–760 → das ist **H**.
4. Höhe setzen (s. §3), rebuild, relaunch, erneut messen → jetzt muss
   `hasVScroll: false`, `hasHScroll: false`, `innerH ≥ docScrollH` gelten.
5. Beweis-Screenshot:
   ```bash
   node scripts/cdp-screenshot.mjs 9222 docs/design-reviews/BL-51-settings.png 3000 --target=settings.html
   ```
   Danach PNG per Read-Tool prüfen: 5 Fieldsets, Reset-Button, Statuszeile, keine Scrollbar.

## 3. Entscheidung: `useContentSize: true` + gemessene Content-Höhe, gekappt an workArea

**Entscheidung: `useContentSize: true` setzen und `height` auf die gemessene Content-Höhe
plus kleinen Puffer, gekappt an die nutzbare Bildschirmhöhe.** Gemessener Zielwert:
H = 705 (Worst-Case, §7) ⇒ **`height` = 713** (finaler Wert =
`min(Math.ceil(H) + 8, screen.getPrimaryDisplay().workAreaSize.height - 40)`,
aus der Messung §2.2, Schritt 3).

Begründung:

- Der Bug ist genau ein Frame-Semantik-Problem: Content ≈ 700–730 vs. Viewport =
  Fensterhöhe − Titelleiste (macOS ~28 px, Windows ~31 px, per BL-9-Screenshot kalibriert).
  Nur die Zahl zu erhöhen (680 → 760) reproduziert dieselbe implizite Kopplung an
  Titelleisten-Arithmetik — die nächste Sektion oder ein Plattform-Unterschied bricht sie
  wieder still.
- Mit `useContentSize: true` bedeuten `width`/`height` die **Content-Größe** (dokumentiertes
  Electron-Verhalten auf win32/darwin). Die gemessene `scrollHeight` bildet sich damit 1:1
  auf den Optionswert ab — Messung → Setting ohne Titelleisten-Umrechnung pro Plattform.
  Für nicht-resizable Fenster ist das der übliche, dokumentierte Einsatzzweck.
- **workArea-Kappung (Verifikations-Befund B1):** Mit `useContentSize` bezieht sich `height`
  auf den Content; die Gesamt-Fensterhöhe ist Content + Titelleiste (~31 px Win). Auf
  kleinen/logisch verkleinerten Screens (1366×768-Laptop: workArea ≈ 728 px; 1920×1080 @
  150 % Skalierung: workArea ≈ 688 px) würde ein ungekappter Wert von ~740 px Content
  (Gesamt ~771 px) unten herausragen — ausgerechnet die unteren Sektionen (Pet/Reset +
  `#status`) lägen wieder außerhalb. Darum:
  `height = Math.min(SETTINGS_WINDOW_CONTENT_HEIGHT, screen.getPrimaryDisplay().workAreaSize.height - TITLE_BAR_ALLOWANCE)`
  mit `TITLE_BAR_ALLOWANCE = 40` (konservativ: Titelleiste ~31 px + Rundungs-/Rahmenpuffer).
  `workAreaSize` ist logisch (DIP), also direkt mit der Content-Höhe vergleichbar. `screen`
  ist im Main-Prozess verfügbar. Auf kleinen Screens bleibt das Fenster dann funktional
  scrollbar (kein Datenverlust), ragt aber nicht aus dem nutzbaren Bereich.
- macOS wird nicht schlechter: Content-Area ist dann exakt `height` (heute 680−28 = 652 px
  Viewport) → mit ~740 eindeutig größer; `width: 420` bleibt Content-Breite (macOS hatte
  faktisch schon 420 px Content, Windows minimal mehr Gesamtbreite — kein Reflow-Risiko,
  s. §6).
- Puffer +8 px deckt Rundung bei fraktionalem DPI-Scaling und Font-Metrik-Differenzen
  (Windows fällt auf Chromium-`sans-serif`/Arial statt `-apple-system` zurück); der
  Worst-Case-Fill in der Messung deckt den gefüllt-Zustand (Status-Spans + Token-Zeilen +
  Status) ab — so passt es auch nach dem Connect beider Quellen ohne Scrollbar.
- Alternative „feste 750–760 ohne useContentSize" verworfen: zwar 1-Zahl-Diff im
  Bestandsstil (upstream bumpte historisch 480→560→640→680), aber plattformabhängig
  (Win-Viewport = 750−31 = 719 vs. macOS = 722 — bei Content 730 wieder below the fold
  unter Windows) und erneut ratend statt messend.

Breite bleibt 420. `resizable: false` bleibt. Der Kommentar über `height`
(`settings-window.ts:252-253`) wird auf die Messung + useContentSize-Begründung +
Kappungslogik aktualisiert.

## 4. Änderungsliste pro Datei

1. **`src/main/mrr/settings-window.ts`** (~Zeilen 250-264): `useContentSize: true` in die
   `BrowserWindow`-Optionen; `height: 680` → `Math.min(SETTINGS_WINDOW_CONTENT_HEIGHT,
   screen.getPrimaryDisplay().workAreaSize.height - TITLE_BAR_ALLOWANCE)`;
   `SETTINGS_WINDOW_CONTENT_HEIGHT` = gemessener Worst-Case + 8 = **713** (war im Plan
   mit ~735–750 geschätzt; Messung §7) als
   Konstante mit kurzem Kommentar (Messwert + Datum + Kappungslogik);
   `TITLE_BAR_ALLOWANCE = 40` (Titelleiste ~31 px Win + Puffer, da `height` mit
   `useContentSize` nur den Content meint, `workAreaSize` aber die Gesamtfläche);
   `screen` zum Electron-Import hinzufügen. Keine sonstigen Änderungen (Hardening, Preload,
   Single-Instance bleiben unberührt).
2. **`scripts/cdp-screenshot.mjs`**: Flag-Parsing (`--target=`, `--measure`, `outfile === '-'`
   = kein Screenshot), Target-Auswahl nach Titel/URL, `Runtime.evaluate`-Messblock mit
   Worst-Case-Fill (inkl. `#claudeStatus`/`#codexStatus`, Nit B5). Bestandsaufrufe bleiben
   kompatibel.
3. **`src/main/mrr/settings-window.test.ts`**: bisher **keine** Größen-Assertions (gegreppt:
   keine Treffer für `height`/`width`/`680`; die Datei testet nur Electron-freie Handler).
   Neu: Regression-Pin auf die Fensteroptionen:
   - `vi.mock('electron', …)` mit `app.getAppPath: () => '/app'`, `ipcMain.handle: vi.fn()`,
     `screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 4000, height: 4000 } }) }`
     (große workArea → der Pin assertiert die ungeknappte Konstante),
     **`BrowserWindow: vi.fn().mockImplementation(() => fakeWin)`** (Verifikations-Nit B4:
     `vi.fn()` allein liefert als Konstruktor ein leeres Objekt, `win.loadFile(...)` würde
     werfen — daher `mockImplementation` mit Fake-Win); `vi.mock('../hardening', …)` no-op.
     Sicher für Bestandstests — sie rufen keine Electron-APIs (Kommentar Zeile 1-4 der Datei).
     Modul-State (`settingsWindow`, `handlersRegistered`, `settings-window.ts:42-43`) ist
     global — für genau einen neuen Test unkritisch (kein `vi.resetModules()` nötig).
   - Ein Test: `openSettingsWindow(deps())` mit Fake-Win
     (`loadFile: vi.fn().mockResolvedValue(undefined)`, `on`, `focus`,
     `isDestroyed: () => false`, `webContents: {}`) aufrufen und
     `expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
     width: 420, height: 713, useContentSize: true, resizable: false }))`.
4. **`docs/design-reviews/BL-51-settings.png`** (generiertes Artefakt, Namensmuster wie
   `BL-9-settings.png`). Empfohlen, aber optional: kurzes `BL-51-verdict.md` mit den
   gemessenen Zahlen (Vorher/Nachher `METRICS`-Zeilen) — jedes BL-* dort hat eines.
5. **Flight-Plan (Abschlussschritt, Verifikations-Befund B3):**
   `.flightplan/Reference/windows-native-flight-plan.md` Item `### 51`: Status auf
   „Umgesetzt (Runde 2, 2026-07-17) — Verifikation ausstehend" + `Umsetzung:`-Zeile
   (geänderte Dateien, gemessene Höhe, finale Höhe). Erst nach erfolgreichem Screenshot.

## 5. Testplan

- **Unit:** neuer Pin-Test (§4.3) + voller Lauf `npm test` (434 Bestandstests müssen grün
  bleiben; `openSettingsWindow` wird sonst nirgends in Tests gerufen, `main.ts` unberührt).
- **Statisch:** `npm run lint`, `npm run typecheck` (cdp-screenshot.mjs ist plain JS und
  faktisch außerhalb des eslint-Scope — verifiziert an `eslint.config.js`).
- **Live (Windows, manuell im Umsetzungs-Schritt):**
  1. Vorher-Messung dokumentiert Overflow (`hasVScroll: true`) → Baseline.
  2. Nachher-Messung: `hasVScroll: false`, `hasHScroll: false`, `innerH ≥ docScrollH`.
  3. Screenshot `BL-51-settings.png` visuell geprüft: Reset-Button + Status sichtbar,
     keine Scrollbar am rechten Rand.
- **macOS-Nichtregression:** nicht live prüfbar von hier aus — argumentativ abgesichert
  (Content-Area wächst 652 → ~740 px, Breite unverändert); im Verdict vermerken.
- **Abschluss:** Flight-Plan-Statusupdate (§4.5) als letzter Schritt.

## 6. Risiken / Offenes

- **Reihenfolge zu Item #50** (ändert `settings.html:63` „on this Mac" → neutral, +5 Zeichen
  im umbrechenden Hint ⇒ ±1 Zeile ≈ ±15 px): **#50 ist bereits gelandet** (verifiziert:
  `settings.html:63` „usage logs on this computer") — die Messung sieht den finalen
  Textstand. Ursprüngliche Empfehlung damit erledigt.
- **Horizontale Scrollbar bei 420 px + 15-px-Scrollbar:** geprüft an `settings.html` —
  Inputs sind `width:100%` mit `box-sizing: border-box` (Zeile 27-32), `.row` hat
  `flex-wrap: wrap` (33-38), keine Fixbreiten ⇒ kein Horizontal-Overflow möglich; nach dem
  Höhen-Fix gibt es ohnehin keine vertikale Scrollbar mehr. Post-fix-Messung assertiert
  zusätzlich `hasHScroll === false`. Keine CSS-Änderung nötig.
- **`useContentSize`-Semantikänderung:** betrifft nur dieses eine Fenster; Overlay-Fenster
  unberührt. Bekannte Electron-Ungenauigkeiten betreffen v. a. exotische Linux-WMs — für
  die Zielplattformen win32/darwin kein Thema; Restrisiko im Verdict notieren.
- **DPI-Rundung:** bei 125/150 %-Scaling kann die Content-Höhe um <1 px gerundet werden;
  der +8-Puffer absorbiert das. Wer will, misst zusätzlich bei 150 % Scaling nach (optional).
- **Kleine Screens / hohe DPI-Skalierung (B1):** auf Screens mit workArea < Content + 40 px
  (z. B. 768-px-Laptops, 1080p @ 150 %) greift die Kappung aus §3 — das Fenster bleibt dann
  innerhalb der workArea, der Inhalt ist funktional scrollbar. „Alles ohne Scrollen
  sichtbar" ist auf solchen Screens physikalisch unerfüllbar; akzeptiertes Restrisiko.
- **Windows-Textskalierung >100 % (B2, akzeptiertes Restrisiko):** „Text größer machen"
  (Accessibility) skaliert die Renderer-Fonts und erhöht die Content-Höhe unabhängig von
  DPI; der +8-px-Puffer deckt das nicht, und jede feste Höhe kann dagegen nicht robust sein
  (nur Laufzeit-Messung). Folge: bei aktiver Textskalierung kann wieder eine Scrollbar
  erscheinen — funktional ohne Datenverlust. Im Rahmen dieses Items akzeptiert.
- **Screenshot-Ziel:** `Page.captureScreenshot` liefert nur den Viewport des Fensters
  (kein OS-Chrome) — für den „kein Overflow"-Beweis genau richtig; ein Fenster-mit-
  Titelleiste-Beweis wäre ein OS-Screenshot und ist nicht Teil dieses Plans.

## 7. Umsetzungs-Ergebnis (Runde 2, 2026-07-17, Windows)

**Vorher-Messung** (Bestand 420×680, kein `useContentSize`), Worst-Case-Fill aktiv:
`METRICS {"bodyScrollH":673,"docScrollH":705,"innerH":619,"innerW":407,"docScrollW":392,"hasVScroll":true,"hasHScroll":false}`
→ Overflow bestätigt (Content 705 > Viewport 619). **H = 705** (`docScrollH`).

**Gesetzte Höhe:** `SETTINGS_WINDOW_CONTENT_HEIGHT = 713` (= ⌈705⌉ + 8), mit
`useContentSize: true` und Kappung `min(713, screen.getPrimaryDisplay().workAreaSize.height - 40)`
(`TITLE_BAR_ALLOWANCE = 40`, da `height` mit `useContentSize` nur den Content meint,
`workAreaSize` aber die Gesamtfläche inkl. Titelleiste ~31 px).

**Nachher-Messung** (gleiche Maschine, gleicher Worst-Case-Fill):
`METRICS {"bodyScrollH":673,"docScrollH":740,"innerH":740,"innerW":426,"docScrollW":426,"hasVScroll":false,"hasHScroll":false}`
→ `hasVScroll: false`, `hasHScroll: false` — Akzeptanzkriterium 3 erfüllt. Hinweise zur
Interpretation: `docScrollH == innerH`, weil `documentElement.scrollHeight` bei passendem
Content auf die Viewport-Höhe geklemmt wird; der reale Content ist unverändert 705
(`bodyScrollH` 673 + 2×16 px body-Margin). Beobachtete Electron/win32-Ungenauigkeit:
Viewport wurde 740×426 statt exakt 713×420 (≈ +27 px Höhe, +6 px Breite — DWM-/Frame-
Rundung unter Windows 11) — gutartig (Fenster minimal größer statt kleiner), macOS-
Aussage unverändert (Content-Area ≥ 713 > 652 heute).

**Screenshot:** `docs/design-reviews/BL-51-settings.png` — alle 5 Fieldsets (Connect,
Stripe, RevenueCat, Growth source, Pet inkl. Reset-Button) plus Statuszeilen-Bereich
sichtbar, keine Scrollbar. Visuell geprüft 2026-07-17.

**Tests:** 435 passed, 6 skipped (434 Baseline + 1 Pin-Test); typecheck, lint, build grün.

**Restrisiken (akzeptiert):** Windows-Textskalierung >100 % (B2) und workArea-Kappung auf
sehr kleinen Screens (B1, Fenster bleibt dort scrollbar, kein Datenverlust); `useContentSize`-
Ungenauigkeiten auf exotischen Linux-WMs (kein Target).
