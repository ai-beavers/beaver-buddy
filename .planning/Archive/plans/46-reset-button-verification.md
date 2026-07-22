# Verifikation — Plan #46 „Fortschritt zurücksetzen“-Button

Datum: 2026-07-17 · Prüfer: Plan-Verifikations-Sub-Agent · Geprüfter Plan: `.flightplan/Archive/plans/46-reset-button-plan.md`

## 1. Urteil: **PLAN OK MIT KORREKTUREN**

Keine Blocker. Alle tragenden technischen Behauptungen (Dateien, Symbole, Wiring, State-Dateien, Renderer-Re-Hatch, IPC-Muster, Build-Pfad, Testanzahl) wurden gegen die Codebase verifiziert und sind korrekt. Drei Minor-Befunde: eine falsch beschriebene Edge-Case-Konsequenz (§6 des Plans), eine ungenaue Zeilenreferenz, ein fehlender expliziter Rebuild-Hinweis.

## 2. Befundliste

### Befund 1 — [minor] Edge „Reset während laufender Evolution“ ist im Plan falsch beschrieben
- **Plan:** §6 (Zeile 149): „ein laufendes `evolutionState` liefe theoretisch parallel weiter … im Zweifel spielt die Hatch einfach erneut.“
- **Codebase-Realität:** `src/renderer/renderer.ts:170` — der Direct-Sync-Zweig ist mit `!evolutionState` bewacht. Trifft das Reset-Pet-Update `{level:1, stage:'baby'}` ein, während eine Evolution (~2 s) aktiv ist, wird der Stage-Sync **verworfen**; bei Evolution-Ende setzt `renderer.ts:406-412` (`setStage(targetStage)`) den Renderer auf teen/adult — obwohl die Engine baby sagt. Der Renderer zeigt dann **dauerhaft die falsche Stage**, bis das nächste Pet-Update (nächster XP-Zufluss) oder ein App-Neustart ihn heilt. Kein „paralleles Weiterlaufen“, kein „Hatch spielt erneut“ — sondern ein persistenter Stage-Mismatch.
- **Was im Plan geändert werden muss:** §6 korrigieren: exakte Konsequenz benennen (Stage-Mismatch bis zum nächsten Pet-Update/Neustart, Eintrittsfenster ~2 s) und eine bewusste Entscheidung treffen: (a) akzeptieren wie gehabt, oder (b) Ein-Zeilen-Fix `evolutionState = null;` in `onHatchStart` (`renderer.ts:183-192`) — letzteres widerspricht der Plan-Behauptung „Keine Renderer-Änderung“ (§3 Schritt 4, §4 „Nicht anzufassen“) und müsste dort ebenfalls nachgezogen werden.

### Befund 2 — [minor] Zeilenreferenz secrets.ts ungenau
- **Plan:** §2 (Zeile 27): „`secrets/<service>/*.enc` (Windows DPAPI, `src/main/mrr/secrets.ts:14-18`)“.
- **Codebase-Realität:** `secrets.ts:14-18` ist nur der Pfad-Bauer (`SECRETS_SUBDIR`, `secretFilePath`). Die DPAPI-/`safeStorage`-Implementierung steht in `secrets.ts:25-35` (`setSecret`, win32-Zweig).
- **Was im Plan geändert werden muss:** Referenz auf `secrets.ts:14-18` (Pfad) bzw. `secrets.ts:25-35` (DPAPI) präzisieren. Kosmetisch.

### Befund 3 — [minor] Rebuild-Erfordernis nach HTML-Änderung nicht explizit
- **Plan:** §4 „Nicht anzufassen“ nennt `scripts/build-assets.js` korrekt als unverändert, sagt aber nirgends, dass nach der `settings.html`-Änderung ein Build nötig ist.
- **Codebase-Realität:** `settings.html` gelangt ausschließlich über `npm run build` (`package.json:13` → `scripts/build-assets.js:8`) nach `dist/main/mrr/settings.html`; `settings-window.ts:158` lädt nur die dist-Kopie. Vitest deckt dist nicht ab — ein veralteter dist-Stand fällt in Tests nicht auf, wohl aber beim manuellen Sichtcheck/Smoke (`npm start` baut zum Glück implizit).
- **Was im Plan geändert werden muss:** Im Testplan/Manuell-Abschnitt explizit „`npm run build` vor Sichtcheck/Smoke“ festhalten.

## 3. Verifizierte korrekte Annahmen (Auswahl, alle mit Beleg)

**Dateien/Symbole:** Alle genannten Dateien existieren: `src/main/mrr/settings-window.ts`, `settings.html`, `settings-preload.ts`, `settings-validate.ts`, `src/main/ipc-channels.ts`, `src/main/onboarding.ts`, `src/main/xp/store.ts`, `src/main/xp/engine.ts`, `src/main/main.ts`, `src/main/tray.ts`.

**Wiring main.ts:**
- `stateDir` aus `app.getPath('userData')`: `main.ts:191` ✓
- `--reset-hatch`-Pfad und persist-before-send-Disziplin: `main.ts:193-203` ✓ (Plan sagt „ca. Zeile 193“ / „197-203“ — korrekt)
- Onboarding wird genau einmal gelesen (`main.ts:195`; Grep bestätigt keinen weiteren Produktiv-Leser) → „kein Modul cached Onboarding-Status“ ✓
- `openGrowthSettings`-Deps (`stateDir`, `keychainService`, `getSettings`, `onSettingsChanged`): `main.ts:252-264` ✓
- `xpEngine.onUpdate`-Wiring mit `tray.refresh()` + `PET_CHANGED_CHANNEL` + `evolvingTo`-Quip: `main.ts:294-300` ✓
- Hatch-vor-Pet-Update-Reihenfolge: `main.ts:336-340` ✓
- `HATCH_START_CHANNEL` und `saveOnboardingState` bereits importiert (`main.ts:6`, `main.ts:11`) → Plan-Behauptung „keine weiteren Änderungen/Imports nötig“ ✓

**State-Dateien:**
- `xp-state.json` mit `xp`, `lastSeenLifetimeTokens`, `lastMrrAwardDate`: `xp/store.ts:9-18` ✓
- Forward-only-Cursor (Re-Award-Schutz): `xp/engine.ts:89-100` ✓ — Cursor-Erhalt im Reset ist zwingend richtig
- `onboarding-state.json` mit `hatched`: `onboarding.ts:11-15` ✓; kein `hatch:done`-Rückkanal existiert (`ipc-channels.ts` komplett gelesen) ✓
- `growth-settings.json` mit `mode`/`stripeConnected`/`revenuecatConnected`: `settings-store.ts:19` ✓
- Secrets unter `secrets/<service>/<account>.enc`: `secrets.ts:14-18` ✓

**XpEngine-Struktur:** `stateDir`/`state`/`lastUpdate`/`listeners` privat und im Klassenrumpf zugänglich (`engine.ts:37-47`); `applyState` (`engine.ts:122-131`) setzt `evolvingTo` **symmetrisch** bei jedem Stage-Wechsel — ein Reset über `applyState` würde fälschlich `evolvingTo: 'baby'` emittieren (Evolution-Quip via `main.ts:297-299` + Evolution-Sequenz via `renderer.ts:148-160`). Die Plan-Entscheidung, `resetProgress()` **ohne** `applyState` zu emittieren, ist korrekt und notwendig. `getState()` liefert für xp=0 korrekt Level 1 / Stage baby (`curve.ts:17`, `curve.ts:28-42`).

**Re-Hatch zur Laufzeit ohne Renderer-Änderung (Normalpfad):** `onHatchStart` setzt `hatchState` unbedingt neu (`renderer.ts:183-192`) — ein zweites `HATCH_START` bei erwachsenem Biber startet die Sequenz sauber neu; `draw()` rendert während `hatchState` ausschließlich die Hatch (`renderer.ts:300-303`); das nachfolgende Pet-Update ohne `evolvingTo` synct die Stage direkt (`renderer.ts:170-174`), sodass die `baby-appear`-Phase das Baby-Sheet zeigt. Lodge-Sheet wird erneut geladen (idempotent). Quip-/Pause-State unberührt und konsistent (Quips während Hatch laufen wie beim Launch-Pfad nur still ab — bestehendes Verhalten).

**IPC-Muster:** Sender-Frame-Check `isFromSettingsWindow` (`settings-window.ts:28-30`), Electron-freie Handler via `createSettingsHandlers` (`settings-window.ts:53-123`), Einmal-Registrierung in `registerHandlers` (`settings-window.ts:125-133` — die Deps des ersten Aufrufs bleiben gebunden; unkritisch, da die geplanten Dep-Closures nur stabile Modul-Referenzen nutzen), Fenster 420×480 `resizable:false` (`settings-window.ts:143-146`). Preload: hand-gesyncte Literale + Top-Kommentar „exposes exactly the three settings calls“ (`settings-preload.ts:4`, `:12-14`) — Plan-Änderungen (4. Literal, 4. Exposure, Kommentar-Update) passen exakt. `settings-validate.ts` unberührt zu lassen ist korrekt (kein Payload). Drift-Guard-Muster in `ipc-channels.test.ts:43-58` exakt wie im Plan beschrieben.

**Build:** `package.json:13` (`build`: `tsc && tsc -p src/renderer && node scripts/build-assets.js`); `build-assets.js:8` kopiert `src/main/mrr/settings.html` → `dist/main/mrr/settings.html` ✓.

**UI-Platz:** `settings.html` komplett gelesen: 3 Fieldsets (Stripe ~95 px, RevenueCat ~135 px, Growth source ~75 px) + `#status` in 480 px Fensterhöhe; ein 4. Fieldset (~70 px) → 540 px ist plausible Schätzung; CSP erlaubt Inline-Script (`settings.html:8-11`) → Zwei-Klick-Arming-JS lauffähig. Plan flaggt die Höhe selbst als zu vermessende Schätzung ✓.

**Tray-Label:** `formatPetLabel({level:1, stage:'baby', xp:0})` → `xpForLevel(2) = 100` → exakt `Lv 1 — baby (0/100)` (`tray.ts:21-24`, `curve.ts:32-34`) ✓.

**Constraints/Tests:** Keine neuen Dependencies nötig (alles aus vorhandenen Modulen komponierbar) ✓. Testmuster verifiziert: `settings-window.test.ts:62-72` (`deps()`-Helper), `:86-92` (Unauthorized-Test „all three handlers“ — Wortlaut „unauthorized sender is rejected on all three handlers, with no state change“), `engine.test.ts` Tmpdir-/Fake-Tracker-Muster, `loadState` aus `store.ts` importierbar ✓. Testanzahl: `npx vitest run` ausgeführt — **383 passed, 6 skipped (42 Dateien)** — Plan-Angabe „383 bestehende Tests“ exakt ✓.

**Reset-Semantik:** MRR-Re-Award-Theorie (`lastMrrAwardDate = null`) korrekt hergeleitet (`engine.ts:114-116`); Tracker-Tick nach Reset: Cursor unverändert → `delta = 0` → kein Re-Award (`engine.ts:89-91`) ✓; Fehler-UI bei fehlschlagendem Reset über `{ ok: false, error: 'reset failed' }` → `#status` ist im Plan enthalten ✓; `mainWindow?.webContents.send`-Null-Sicherheit entspricht bestehendem Stil ✓.
