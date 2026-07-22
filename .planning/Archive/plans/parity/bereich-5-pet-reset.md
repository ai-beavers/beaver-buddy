# Bereich 5 — Pet-Reset End-to-End (funktionaler Pfad)

Analysierte Kette: `settings.html` (Danger-Zone Arming) → `settings-preload.ts` → `settings-window.ts` (`resetProgress`-Handler) → `main.ts` (`onProgressReset`) → `xp/engine.ts` (`resetProgress`/`applyState`) → `renderer.ts` (Re-Hatch). Geprüft gegen Merge-Stand `d7acaf0` (Branch `bl-item/windows-native/BL-WIN`).

## 1. Urteil

**PARITÄT OK** — keine Windows-Lücke gefunden. 2 Risiken (kein funktionaler Bruch).

Der komplette Reset-Pfad ist plattformneutral implementiert: keine hartkodierten Pfade, keine macOS-only APIs, alle Dateizugriffe laufen über `app.getPath('userData')` + `path.join` + den Windows-gehärteten `atomicWriteFile` (EPERM/EBUSY-Retry). Die Feature-Historie ist sauber gemergt: Upstream brachte den Reset (`9c8bd00`), unser Branch erweiterte ihn um Tray-Refresh/Arming (`4667082`), der Merge `d7acaf0` enthält beide Seiten vollständig (verifiziert am aktuellen Code, nicht an der Commit-Message).

## 2. Befunde

### R1 [risiko] Fehlerpfad-Desync: Hatch läuft, obwohl Reset fehlschlug
- **Datei:Zeile:** `src/main/main.ts:291-294` (HATCH_START vor `await xpEngine.resetProgress()`), `src/main/atomic-file.ts:12,29-42` (Retry-Budget)
- **Beschreibung:** `onProgressReset` sendet `HATCH_START` **bevor** der XP-State persistiert ist. Schlägt `saveState` fehl (auf Windows realistischer als auf macOS: Virenscanner/Indexer kann die Rename-Locks länger halten als das 4-Versuche/~160 ms-Budget von `atomicWriteFile`), meldet der Handler korrekt `{ ok: false, error: 'reset failed' }` (`settings-window.ts:199-201`) — aber der Hatch wurde bereits gesendet und läuft ~6 s im Overlay, während XP/Stage/Tray-Label unverändert bleiben. Der Renderer zeigt dabei in der `baby-appear`-Phase sogar das alte Stage-Sprite (`renderer.ts:243-259` nutzt das unveränderte `sheet`). Rein kosmetisch, heilt beim nächsten Pet-Update von selbst; die Hatch-first-Reihenfolge ist für den Erfolgspfad bewusst so gewählt (Invariante aus `renderer.ts:167-171` bzw. `main.ts:289-290`).
- **Fix-Vorschlag (ohne neue Dependencies):** Im Catch-Pfad des Handlers bzw. nach einem fehlgeschlagenen `resetProgress` ein Resync-`PET_CHANGED` mit `xpEngine.getLastUpdate()` senden (derselbe Resend-Mechanismus wie `main.ts:394-395`), damit der Renderer sofort auf den wahren Stage zurücksnapt. Alternativ bewusst als akzeptiertes Verhalten dokumentieren — der Schaden ist eine einmalige kosmetische Hatch-Animation.

### R2 [risiko] Renderer-Reset-Interaktion ungetestet (auf Windows ohne QA-Backstop)
- **Datei:Zeile:** `src/renderer/renderer.test.ts:6` (nur HiDPI/Bounds getestet); ungetestete Pfade: `renderer.ts:185-199` (`onHatchStart` cancelt In-Flight-Evolution), `renderer.ts:163-176` (Stage-Snap während Hatch)
- **Beschreibung:** Die zwei für den Mid-Session-Reset kritischen Renderer-Zweige — (a) `evolutionState = null` bei Hatch während laufender Evolution, (b) direkter `setStage(pet.stage)`-Snap, weil das Reset-Update absichtlich kein `evolvingTo` trägt (`engine.ts:146-148`) — haben keinen Unit-Test. Engine- und Handler-Ebene sind stark getestet (`engine.test.ts:239-310`, `settings-window.test.ts:239-262`), die Renderer-Kette nicht. Auf macOS fällt das weniger auf, weil dort die manuelle QA läuft; auf Windows existiert kein skriptgestützter Akzeptanzpfad für den Reset (die Two-Click-Arming-UI ist per CDP klickbar, aber kein Skript verdrahtet das — anders als `--quip`/`--inject-xp`/`--open-growth-settings`).
- **Fix-Vorschlag (ohne neue Dependencies):** Test in `renderer.test.ts` mit der vorhandenen Listener-Stub-Infrastruktur: Hatch-Callback feuern → Pet-Update `{level:1, stage:'baby'}` ohne `evolvingTo` feuern → assert `__debugPet.stage === 'baby'` und kein `evolving`-Zustand; plus Fall „Evolution in flight → Hatch cancelt". Optional: CDP-Skript nach Vorbild `scripts/cdp-screenshot.mjs`, das `--open-growth-settings` nutzt und den Arming-Doppelklick fährt.

## 3. Verifiziert-OK-Liste

- **Arming-Script plattformneutral:** reines DOM-JS, Two-Click-Arming statt `confirm()` (sandbox-sicher), `await api.resetProgress()` mit Erfolg/Fehler-Mapping — `settings.html:244-271`. Kein Pfad-/Plattform-Bezug.
- **Channel-Parität Preload↔Main:** `settings-preload.ts:15` Literal `settings:reset-progress` = `ipc-channels.ts:21`; Drift-Guard `ipc-channels.test.ts:62-65` deckt das settings-preload ab.
- **Handler:** Sender-Frame-Guard + `await deps.onProgressReset()` + Fehler-Mapping — `settings-window.ts:194-202`; Tests inkl. Unauthorized- und Failure-Case: `settings-window.test.ts:127,239-262`; „settings/usage opt-ins unberührt" explizit getestet: `settings-window.test.ts:246-255`.
- **Orchestrierung:** Onboarding **awaited vor** Send (exactly-once-Disziplin), HATCH vor Pet-Update (Ordering-Invariante), Engine-Reset **awaited** — `main.ts:284-295`. Kein Async-/Await-Bruch in der gesamten Kette (HTML → Preload → Handler → main → Engine).
- **Tray-Label nach Reset aktualisiert:** Engine-Update feuert synchron alle Listener (`engine.ts:150`) → `main.ts:339-341` ruft `tray.refresh()` → `rebuildMenu` baut Label aus `formatPetLabel(xpEngine.getState())` (`main.ts:319`, `tray.ts:56,110-121`) → „Lv 1 — baby (0/…)". Windows-Single-Click-Menü (`tray.ts:106-108`) nutzt `popUpContextMenu()` ohne Args = immer das zuletzt gesetzte Menü, also kein Stale-Menu-Problem nach Refresh.
- **Engine-Semantik:** `resetProgress` via `applyState({xp:0, lastMrrAwardDate:null}, {allowStageSnap:true})` → Update ohne `evolvingTo` (kein Evolution-Quip, keine Evolution-Animation statt Hatch) — `engine.ts:129-131,146-148`. Cursor `lastSeenLifetimeTokens` bleibt → keine Re-Award der Token-Historie — `engine.ts:126-128` + Tests `engine.test.ts:253-264,290-309`. `lastMrrAwardDate`-Clear getestet: `engine.test.ts:280-288`.
- **Renderer Re-Hatch:** `onHatchStart` cancelt Evolution + startet Hatch — `renderer.ts:185-199`; Snap-Zweig für Update ohne `evolvingTo` während Hatch — `renderer.ts:172-176`. IPC-Reihenfolge HATCH→PET garantiert (FIFO pro webContents; HATCH synchron vor dem `await` gesendet, PET erst nach `saveState`).
- **MRR-Secrets unberührt:** Reset-Kette schreibt ausschließlich `onboarding-state.json` (`onboarding.ts:36-38`) und `xp-state.json` (`xp/store.ts:51-53`); `secrets.ts` wird nur von save/disconnect-Handlern und der MRR-Engine referenziert. Windows-DPAPI-.enc-Pfad ist plattform-gemockt getestet (`secrets.test.ts:52-99`).
- **Pfade Windows-sicher:** `stateDir = app.getPath('userData')` (`main.ts:206`); Secret-Dateien via `path.join` (`secrets.ts:16-18`); `atomicWriteFile` mit Windows-Retry gegen transiente Locks (`atomic-file.ts:6,16-19,29-42`).
- **Packaging:** `settings.html` wird per `build-assets.js:8` nach `dist/main/mrr/` kopiert (artefakt-verifiziert), `settings-preload.js` kompiliert vorhanden; `electron-builder.yml:5-8` packt `dist/**` + `assets/**` → Settings-Fenster funktioniert auch im NSIS-Build. Fenster-Pfade `path.join(app.getAppPath(), ...)` asar-tauglich (`settings-window.ts:257,262,268`).
- **Merge-Vollständigkeit:** `git show 9c8bd00` (Upstream-Reset) + `git show 4667082` (Branch: Arming/Tray/Engine-Reset) — beide im aktuellen Code verifiziert; kein Merge-Verlust.

## 4. Vorgeschlagene Flight-Plan-Items

- **BL-WIN-R1: Resync nach fehlgeschlagenem Pet-Reset** — Catch-Pfad sendet `PET_CHANGED` mit `getLastUpdate()`, damit ein irrtümlich gestarteter Hatch visuell auf den wahren Stage zurückfällt (oder als akzeptiert dokumentieren).
- **BL-WIN-R2: Renderer-Tests für Mid-Session-Reset** — Hatch-cancelt-Evolution + Stage-Snap-ohne-`evolvingTo` mit der bestehenden Listener-Stub-Infra in `renderer.test.ts` abdecken; optional CDP-Skript für Windows-Akzeptanz des Arming-Doppelklicks.
