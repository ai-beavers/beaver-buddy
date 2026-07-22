# Beaver Buddy — Windows Native Flight Plan

**Version:** 0.1.0  
**Letzter Commit:** `344ab52` — `feat: add initial content for Beaver animations ideas`  
**Stand:** 2026-07-17 — Punkte 1, 2, 4a, 5, 6 ✅ abgeschlossen; Punkte 3, 7 🔶 provisorisch (Placeholder, Designer-Art offen); Punkt 4b 📄 dokumentiert (Zertifikat offen). Runde 2 (#46–#62) vollständig abgeschlossen. Nächste Runde: #26 MRR-Modus aktivieren, dann #8–#18 Animationen.  

Dieser Flight Plan listet alle Windows-native Aufgaben und Features, die sequenziell abgearbeitet werden sollen. Jeder Punkt hat eine klare Nummer, Beschreibung, Status und Akzeptanzkriterien.

---

## 🔧 1. Windows-Native Infrastruktur

### 1. Windows Secret Store für MRR-Modus
- **Beschreibung:** Sichere Speicherung von Stripe/RevenueCat API-Keys unter Windows (analog macOS Keychain).
- **Status:** ✅ Done.
- **Umsetzung:** Neues `src/main/mrr/secrets.ts` mit plattformspezifischem Dispatch: macOS weiterhin Keychain (`security` CLI), Windows über `electron.safeStorage` (DPAPI) als verschlüsselte `.enc`-Dateien unter `<stateDir>/secrets/<service>/<account>.enc`. Aufrufer in `mrr-engine.ts`, `settings-window.ts` und `main.ts` umgestellt. Tests in `secrets.test.ts`, `mrr-engine.test.ts`, `settings-window.test.ts` und `atomic-file.test.ts` ergänzt.
- **Validierung:** `npm run typecheck`, `npm run lint`, `npm run test` (354 passed / 6 skipped), `npm run build` und `npx electron-builder --win --publish never` erfolgreich.
- **Akzeptanz:** Keys werden verschlüsselt gespeichert, nie als Plaintext in `growth-settings.json`; MRR-Modus auf Windows verfügbar.

### 2. Auto-Hide Taskbar Robustheit
- **Beschreibung:** Native Erkennung der Taskbar mit `SHAppBarMessage`, damit der Biber bei ein-/ausgeblendeter Taskbar korrekt positioniert bleibt.
- **Status:** ✅ Erledigt (2-DIP-Inset bei `workArea === bounds` unter win32; Smoke-Test-Toleranz für Windows-Fenster-Offset ergänzt).
- **Planungsstand:**
  - `koffi`/PowerShell-Ansätze verworfen — keine neuen Dependencies, kein synchroner Prozess-Spawn im Main-Process.
  - Finaler Ansatz: 2-DIP-Inset bei `workArea === bounds` unter win32, zentral in `overlay-adapter.ts` (`effectiveWorkArea`). `createWindow()` und Smoke-Test werden auf sichere Bounds umgestellt.
- **Akzeptanz:** Das Overlay blockiert den Auto-Hide-Trigger nicht: Meldet Windows `workArea === bounds` (Auto-Hide aktiv), wird das Overlay-Fenster unter win32 auf allen vier Seiten um 2 DIP eingezogen, sodass die Taskbar bei Randberührung der Bildschirmkante weiterhin normal aufklappt. Eine kurzzeitige Verdeckung des Bibers durch die aufklappende Taskbar bleibt eine dokumentierte Einschränkung (Windows-Systemverhalten, siehe Kommentar in `src/main/overlay-adapter.ts`) und ist explizit nicht Gegenstand dieses Punkts.

### 3. Professioneller Icon-Pass
- **Beschreibung:** Endgültige `assets/icon.ico` und `assets/tray-icon.png`/`tray-iconTemplate.png` von einem Designer erstellen lassen.
- **Status:** Provisorisch.
- **Umsetzung (verbessertes Provisorium, 2026-07-16):** Icons werden jetzt programmatisch aus dem committed `beaver-teen`-Idle-Frame (Zeile 0, Frame 0) generiert — `npm run assets:icons` (`scripts/gen-sprites/build-icons.ts`): Crop auf Content-Bbox, Skalierung auf 16/24/32/48/64/128/256 (Downscale: Area-Average mit premultiplied Alpha; Upscale 256: Nearest-Neighbor), Verpackung als PNG-basiertes ICO via `scripts/gen-sprites/ico.ts`; `assets/tray-icon.png` als 32×32-RGBA-PNG aus demselben Stand. Byte-deterministisch, keine neuen Dependencies; `assets/tray-iconTemplate.png` unverändert. Tests: `ico.test.ts` (Header/LE/256→0-Regel/Offset-Walk), `build-icons.test.ts` (Determinismus, committed Assets matchen Generator). Designer-Vergabe für die finalen Icons bleibt offen.
- **Validierung:** `npm run assets:icons`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` und `npx electron-builder --win --publish never` erfolgreich.
- **Akzeptanz:** Icons sind auf hellen/dunklen Taskbars kontrastreich, skalieren sauber 16×16 bis 256×256, passen zur Sprite-Palette.

### 4. Windows Code Signing

#### 4a. Signing-Infrastruktur
- **Beschreibung:** Signing-Pipeline mit self-signed Zertifikaten: lokale Entwicklungs-Signatur, CI-Signatur mit Wegwerf-Zertifikat pro Run, Post-Build-Verifikation via `Get-AuthenticodeSignature`, Doku in `docs/code-signing.md`.
- **Status:** ✅ Erledigt (`signtoolOptions` in `electron-builder.yml`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, CI-Integration, `docs/code-signing.md`).
- **Kontext:** Self-signed Signatur entfernt die SmartScreen-Warnung **nicht** (keine öffentliche Vertrauenskette, keine SmartScreen-Reputation). 4a liefert daher nur die technische Infrastruktur (electron-builder-Konfiguration, CI-Schritte inkl. Fork-PR-Behandlung, Verifikations-Gate, Doku) — das ursprüngliche Akzeptanzkriterium von #4 wandert nach 4b.
- **Akzeptanz:** Windows-CI-Build produziert signierte Artefakte (Wegwerf-self-signed, oder echtes Zertifikat falls Secret konfiguriert); Verifikations-Schritt schlägt fehl, wenn ein Artefakt unsigniert ist; lokale Signatur-Anleitung dokumentiert; lokale Builds und Fork-PRs ohne Secrets laufen weiter grün (kein `forceCodeSigning` in der Repo-Konfig).

#### 4b. SmartScreen-freie Auslieferung
- **Beschreibung:** Öffentlich vertrauenswürdige Signatur der Release-Artefakte, sodass Windows Defender SmartScreen keine Warnung zeigt. Optionen (Doku in `docs/code-signing.md`): Azure Trusted/Artifact Signing (empfohlen, ~10 USD/Monat, Reputation über Microsoft-Kette) oder klassisches OV-/EV-Zertifikat (OV braucht Reputationsaufbau über Downloads, EV sofortige Reputation, beide kostenpflichtig, seit 2023 HSM/Cloud-Pflicht).
- **Status:** 📄 Dokumentiert, nicht umgesetzt.
- **Abhängigkeiten:** #4a (Infrastruktur: `signtoolOptions`, CI-Secret-Handling, Verifikations-Gate), #42 (Release-Pipeline — das echte Zertifikat greift erst beim Publish; `--publish never` bleibt bis #42 bestehen).
- **Akzeptanz:** Signierte Release-Artefakte ohne SmartScreen-Warnung (ursprüngliches Akzeptanzkriterium von #4).

### 5. Installer-Lokalisierung
- **Beschreibung:** NSIS-Installer auf Deutsch/Englisch (ggf. weitere Sprachen) lokalisieren.
- **Status:** ✅ Erledigt (`installerLanguages: [en_US, de_DE]` in `electron-builder.yml`; Installer-Build zeigt 2 language tables).

### 6. Windows-Startmenü / Desktop-Shortcut
- **Beschreibung:** Beim Installer optional Startmenü-Eintrag und Desktop-Shortcut anlegen.
- **Status:** ✅ Erledigt (`createDesktopShortcut: true`, `createStartMenuShortcut: true`, `shortcutName: Beaver Buddy` in `electron-builder.yml`).

---

## 🦫 2. Beaver-Stages & Animationen

### 7. Adult Stage Art
- **Beschreibung:** Vollständige Sprite-Sheets für `adult` (idle, walk left/right, ggf. weitere Animationen).
- **Status:** Provisorisch (2026-07-16) — Placeholder-Sheet aus dem teen-Sheet abgeleitet; finales Adult-Art bleibt offen (Designer/Owner-Aufgabe).
- **Umsetzung (Provisorium):** `scripts/gen-sprites/build-adult-placeholder.ts` (`npm run assets:adult-placeholder`) erzeugt `assets/sprites/beaver-adult.png/.json` mechanisch aus dem committed `beaver-teen`-Sheet: pro Tile Extraktion (`extractTile`), Crop auf Content-Bbox, Nearest-Neighbor-Upscale auf volle 96px Kachelhöhe, bottom-aligned zentriert (`placeOnTile`) — der Adult liest sich als größerer Teen. Meta (tile/fps/rows) vom Teen-Sheet geerbt, sheetWidth/sheetHeight neu berechnet. Byte-deterministisch, keine neuen Dependencies. Teen-Fallback in `src/renderer/sprites.ts#loadSheet` entfernt; `npm run build` kopiert das Sheet wie gehabt via `scripts/build-assets.js`. Tests: `build-adult-placeholder.test.ts` (Determinismus, committed Assets matchen Generator, Struktur-/Content-Invarianten inkl. voller Kachelhöhe pro Frame, Placeholder-Guard adult ≠ teen).
- **Validierung:** `npm run assets:adult-placeholder`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` und `npx electron-builder --win --publish never` erfolgreich.
- **Akzeptanz:** Eigenständiges `assets/sprites/beaver-adult.png/.json`, 96×96 Tiles, konsistent zur `STYLE.md`. (Form erfüllt; eigenständiges finales Adult-Art ersetzt das Provisorium.)

### 8. Coding-Animation
- **Beschreibung:** Biber sitzt am Laptop und tippt/codet.
- **Herkunft:** Animations-Ideen-Rohtext.
- **Abhängigkeiten:** Adult Stage (#7), ggf. neue State-Machine-Zustände.

### 9. Drink-Animationen
- **Beschreibung:** Biber trinkt Kaffee, Matcha, Bubble Tea.
- **Herkunft:** Animations-Ideen-Rohtext.

### 10. Schlaf-Animation
- **Beschreibung:** Biber legt sich schlafen, inkl. Schlafposition und Bewegung im Schlaf.
- **Herkunft:** Animations-Ideen-Rohtext.

### 11. Aufwach-/Stretch-Animation
- **Beschreibung:** Biber wacht auf und macht eine Yoga/Stretch-Bewegung.
- **Herkunft:** Animations-Ideen-Rohtext.

### 12. Sprechen mit Mundbewegungen
- **Beschreibung:** Mundbewegungen synchron zur Quip-Bubble (programmatisch animiert).
- **Herkunft:** Animations-Ideen-Rohtext.
- **Hinweis:** Bubble existiert bereits, Mundanimation fehlt.

### 13. Sport-Animationen
- **Beschreibung:** Biber macht Kniebeugen, Hanteltraining oder trainiert an Geräten.
- **Herkunft:** Animations-Ideen-Rohtext.

### 14. Stock werfen / Stöcke sammeln
- **Beschreibung:** Biber wirft einen Stock oder sammelt Stöcke.
- **Herkunft:** Animations-Ideen-Rohtext.

### 15. Baum pflanzen & gießen
- **Beschreibung:** Kleine Pflanze wächst nach und nach, Biber gießt sie.
- **Herkunft:** Animations-Ideen-Rohtext.
- **Hinweis:** Benötigt externes Objekt (Pflanze/Baum) im Overlay.

### 16. Toiletten-Welle
- **Beschreibung:** Biber geht auf Toilette, danach kommt eine Welle und spült ihn weg.
- **Herkunft:** Animations-Ideen-Rohtext.

### 17. Handy / Brain-Rot-Animation
- **Beschreibung:** Biber liegt am Handy und scrollt.
- **Herkunft:** Animations-Ideen-Rohtext.

### 18. Meeting-/Rede-Animation
- **Beschreibung:** Biber redet lange (wie in einem Meeting).
- **Herkunft:** Animations-Ideen-Rohtext.

---

## 🎮 3. Verhalten & State Machine

### 19. Erweiterte Roaming-Zustände
- **Beschreibung:** Mehr Zustände als nur `idle`/`walk`/`climb` (z.B. `coding`, `sleeping`, `drinking`, `exercising`).
- **Abhängigkeiten:** Animationen #8–#18.

### 20. Zustandsübergänge mit Gewohnheiten
- **Beschreibung:** Biber wechselt abhängig von Tageszeit, Idle-Zeit, Token-Burn-Intensität in andere Zustände.
- **Beispiel:** Nach 20 Minuten Coding → Drink; nach 30 Minuten Idle → Sleep.

### 21. Interaktionen mit Objekten im Overlay
- **Beschreibung:** Externe Objekte (Laptop, Tasse, Hantel, Pflanze, Handy) spawnen und interagieren mit dem Biber.
- **Abhängigkeiten:** Animationen #8–#18.

### 22. Mehr Quip-Trigger
- **Beschreibung:** Neue Quip-Trigger für Drink, Sleep, Sport, Coding, etc.
- **Status:** Basis-Trigger existieren, erweiterte fehlen.

### 23. Quip-Ton / Stimmungsabhängigkeit
- **Beschreibung:** Quips passen sich der aktuellen Animation/State an.

---

## 📊 4. Wachstum & Tracking

### 24. Windows Codex Usage Paths erweitern
- **Beschreibung:** Weitere Pfadvarianten für Codex-Logs unter Windows robust abdecken.
- **Status:** Basis implementiert, ggf. Edge Cases.

### 25. Token-Burn-Spike Erkennung verbessern
- **Beschreibung:** Genauere Erkennung von Spikes und längeren Coding-Sessions.
- **Status:** Basis existiert.

### 26. MRR-Modus auf Windows aktivieren
- **Beschreibung:** Sobald #1 (Windows Secret Store) implementiert ist, MRR-Modus freischalten.
- **Abhängigkeiten:** #1.

### 27. Mehr MRR-Quellen
- **Beschreibung:** Zusätzliche Anbieter neben Stripe/RevenueCat (z.B. Paddle, Lemon Squeezy).

---

## 🪟 5. Overlay & Fensterverhalten

### 28. Multi-Display-Support
- **Beschreibung:** Biber kann auf sekundäre Monitore wandern, Overlay folgt dem aktiven Display.
- **Status:** Aktuell nur primärer Monitor.

### 29. Overlay auf bestimmten Displays fixieren
- **Beschreibung:** Nutzer kann im Tray-Menü wählen, auf welchem Display der Biber lebt.

### 30. Virtuelle Desktop-Unterstützung
- **Beschreibung:** Biber bleibt beim Wechsel zwischen Windows-Desktops sichtbar oder folgt dem Nutzer.

### 31. Fenster-Snap ignorieren
- **Beschreibung:** Verhindern, dass Windows Snap den Overlay einrastet.

### 32. Fokus-/Aktivierungsverhalten verfeinern
- **Beschreibung:** Sicherstellen, dass der Overlay niemals Fokus oder Tastatureingaben stiehlt.

---

## ⚙️ 6. Einstellungen & Tray

### 33. Einstellungen-Fenster für Windows anpassen
- **Beschreibung:** UI/UX des Settings-Windows auf Windows-Native-Look & Feel prüfen und anpassen.

### 34. Tray-Menü erweitern
- **Beschreibung:** Zusätzliche Einträge: Animation wählen, Display wählen, Speed, Lautstärke, etc.

### 35. Persistente Nutzereinstellungen
- **Beschreibung:** Biber-Verhalten, Animation-Häufigkeit, Quip-Häufigkeit etc. speichern.

### 36. Autostart-Option
- **Beschreibung:** Option im Tray-Menü: "Mit Windows starten".

---

## 🧪 7. QA & Design-Gates

### 37. Reale Windows-HiDPI-Screenshots
- **Beschreibung:** Screenshots bei 100 %/125 %/150 %/200 % Scaling + heller/dunkler Taskbar.
- **Status:** Provisorisch.
- **Abhängigkeiten:** #3 (Icons).

### 38. Design-Gate für jede neue Animation
- **Beschreibung:** Jede Animation aus #8–#18 durchläuft R10 Design-Gate.
- **Abhängigkeiten:** Jeweilige Animation.

### 39. Performance-Profiling auf Windows
- **Beschreibung:** CPU-Usage im Idle < 5 % garantieren, besonders mit vielen Animationen.

### 40. E2E-Tests für Windows
- **Beschreibung:** Integrationstests für Hauptprozess/Overlay/Tray (z.B. mit Playwright oder Spectron-Nachfolger).

### 41. Manuelle Akzeptanztests auf Windows
- **Beschreibung:** Checkliste für Windows: Installieren, Starten, Pause, Quit, Hatch, Evolution, MMR.

---

## 🚀 8. Release & Distribution

### 42. Automatisierte Windows-Release-Pipeline
- **Beschreibung:** GitHub Actions baut und veröffentlicht Windows-Installer/Portable bei jedem Tag.
- **Status:** CI baut, aber Veröffentlichung ist `publish never`.

### 43. Versions-Update auf 0.2.0
- **Beschreibung:** Sobald Windows-Native-Features umgesetzt sind, Version in `package.json` erhöhen.

### 44. Changelog & Release Notes
- **Beschreibung:** Offizieller Changelog für 0.2.0 mit allen Windows-Features.

### 45. Update-Mechanismus
- **Beschreibung:** Optional: Auto-Update für Windows via electron-updater.
- **Hinweis:** PRD sagt "no auto-update" im MVP, aber später denkbar.

---

## 🔄 9. Runde 2: Parität & Feinschliff (2026-07-17)

### 46. Reset-Button im Einstellungsfenster
- **Beschreibung:** Sichtbarer Zurücksetz-Button im Einstellungsfenster (Growth Settings), der den Biber auf den Start zurücksetzt (Fortschritt/XP zurück auf Anfang, Hatch-Animation erneut). Aktuell existiert Reset nur als versteckter QA-Flag `--reset-hatch` (main.ts) bzw. Factory-Reset via Löschen des State-Dirs.
- **Status:** ✅ Erledigt & verifiziert (Runde 2, 2026-07-17) — Plan/Verifikationsberichte unter `.flightplan/Archive/plans/46-*.md`; 389 Tests grün. Manueller Sichtcheck (Fenster 420×540) steht noch aus (Design-Gate #37/#41).
- **Umsetzung:** `src/main/ipc-channels.ts` (neuer Channel `settings:reset-progress`), `src/main/mrr/settings-window.ts` (Handler `resetProgress`, Dep `onProgressReset`, Fensterhöhe 480→540), `src/main/mrr/settings-preload.ts` (Exposure), `src/main/mrr/settings.html` (Danger-zone mit Zwei-Klick-Arming), `src/main/xp/engine.ts` (`resetProgress()`, Cursor-erhaltend, ohne `evolvingTo`), `src/main/main.ts` (Verdrahtung: Onboarding persistieren → HATCH_START → Engine-Reset), `src/renderer/renderer.ts` (`evolutionState = null` bei HATCH_START), Tests: `src/main/xp/engine.test.ts`, `src/main/mrr/settings-window.test.ts`, `src/main/ipc-channels.test.ts`.
- **Validierung:** Plan-Verifikation (3 Minor-Befunde, eingearbeitet), Code-Verifikation FREIGABE (0 Blocker), `npx vitest run` 389 passed / 6 skipped, typecheck + lint + build grün.
- **Akzeptanz:** Button in `settings.html` sichtbar; Klick setzt XP-/Onboarding-State zurück und startet die Hatch-Animation neu; MRR-Zugänge/Secrets bleiben erhalten; IPC mit Sender-Frame-Validierung und Payload-Validation analog bestehender Settings-Channels; Tests nach Muster `settings-window.test.ts`.

### 47. Tray: Einzelklick (Linksklick) öffnet Menü
- **Beschreibung:** Unter Windows öffnet das Tray-Menü aktuell nur per Rechtsklick (auf Touchpads: Zwei-Finger-Tipp). Ein einzelner Linksklick auf das Tray-Icon soll dasselbe Kontextmenü öffnen (`tray.popUpContextMenu()`), damit alle Aktionen (Einstellungen, Reset, Pause, Quit) mit einem Klick erreichbar sind.
- **Status:** ✅ Erledigt & verifiziert (Runde 2, 2026-07-17) — Plan/Berichte unter `.flightplan/Archive/plans/47-*.md`; 393 Tests grün. Manuelle Live-Verifikation (Linksklick auf echter Windows-Taskleiste) steht noch aus (#41).
- **Validierung:** Plan-Verifikation PLAN OK (4 Minor-Klarstellungen, eingearbeitet), Code-Verifikation FREIGABE (0 Befunde), `npx vitest run` 393 passed / 6 skipped, eslint sauber.
- **Umsetzung:** `src/main/tray.ts` (einmaliger `tray.on('click', …)` → `popUpContextMenu()` hinter `process.platform === 'win32'`-Gate in `createTray()`, nach `setToolTip`, außerhalb `rebuildMenu()` → kein Handler-Stacking, frisches Menü nach `refresh()`), `src/main/tray.test.ts` (Electron-Mock um Fake-`Tray` + `Menu.buildFromTemplate` erweitert; 4 neue Tests: win32-Registrierung ohne gecapturetes Menü, kein Stacking über `refresh()`, kein Handler auf darwin/linux).
- **Akzeptanz:** Linksklick öffnet das Kontextmenü; Rechtsklick funktioniert weiterhin; macOS-Verhalten unverändert; Wiring durch `tray.test.ts` abgedeckt.

### 48. 💡 Offene Idee: Taskbar-Sprung-Animation
- **Beschreibung:** Wenn der Biber von der (Auto-Hide-)Taskbar verdeckt wird, soll er von hinter der Taskbar hochspringen und anschließend auf der Taskbar balancieren können.
- **Status:** Offene Idee — nur dokumentiert, kein Umsetzungsauftrag (vom Owner notiert 2026-07-17).
- **Abhängigkeiten:** #2 (Taskbar-Erkennung), neue Animationen aus der #8–#18-Familie, ggf. #19 (State Machine).
- **Hinweis:** Priorisierung/Umsetzung entscheidet der Owner später.

### 49. Codex-Homes unter Windows vereinigen statt First-wins (schärft #24)
- **Beschreibung:** `usage/paths.ts:154-156` — existiert `%APPDATA%\Codex` (Electron-userData der Codex Desktop App, ohne `sessions/`), wird der echte CLI-Pfad `%USERPROFILE%\.codex` nie geprüft → Codex-Connect für diese Nutzer funktionslos. Fix: Union aller existierenden Kandidaten + relative-Pfad-Dedup; Regressionstest. Bericht: `parity/bereich-1`.
- **Status:** ⏸️ Planung ✅ + Plan-Verifikation ✅ (PLAN OK, `.flightplan/Archive/plans/49-codex-pfad-union-{plan,verification}.md`) — **Umsetzung pausiert** (2026-07-17): Umsetzungs-Agent startete, Produktionsseite von `paths.ts` war fertig (Tests noch nicht umgedreht), dann Verbindungsabbruch. Partieller Diff wurde als `.flightplan/Archive/plans/49-partial-implementation.patch` gesichert und der Working Tree danach zurückgesetzt → Suite grün (435/6). **Nächster Schritt:** Umsetzungs-Agent neu starten — Patch prüfen/anwenden ODER sauber aus dem Plan neu implementieren (Plan ist führend), dann Tests umdrehen/ergänzen, dann Code-Verifikation.
- **Akzeptanz:** Codex-Sessions werden auch bei installierter Codex Desktop App gefunden; Test „leeres %APPDATA%\Codex verdeckt ~/.codex nicht" grün.

### 50. Connect-Hint plattformneutral formulieren
- **Beschreibung:** `settings.html:63` sagt „usage logs on this Mac" — auf Windows sichtbar falsch. Fix: „on this computer" (1 Zeile; ggf. upstream einreichen). Bericht: `parity/bereich-2`.
- **Status:** ✅ Erledigt & verifiziert (Runde 2, 2026-07-17) — Bericht `.flightplan/Archive/plans/50-code-verification.md` (FREIGABE); 434 Tests grün.
- **Umsetzung:** `src/main/mrr/settings.html:63` — „on this Mac" → „on this computer" (einziger Treffer in `src/`; keine Duplikate in Tests). Plan: `.flightplan/Archive/plans/50-connect-hint-text-plan.md`. build/test/typecheck/lint grün (434 passed / 6 skipped).

### 51. Settings-Fensterhöhe für 5 Sektionen vermessen und anpassen
- **Beschreibung:** Fenster 420×680 (`settings-window.ts:250-255`) — Content ≈ 700–730 CSS-px vs. Viewport ≈ 649 px (Win) → Pet/Reset-Sektion + Statuszeile ~50–80 px below the fold, dauerhafte Scrollbar. Betrifft direkt die Sichtbarkeit des Reset-Buttons (#46). Fix: echte `scrollHeight` per CDP messen (`--open-growth-settings`, Flag existiert), dann Höhe ~750–760 oder `useContentSize: true`; Target-Auswahl in `cdp-screenshot.mjs` für Nicht-Overlay-Fenster erweitern. Bericht: `parity/bereich-2`.
- **Status:** ✅ Erledigt & verifiziert (Runde 2, 2026-07-17) — Berichte `.flightplan/Archive/plans/51-*.md`; gemessen 705 px → gesetzt 713 px (`useContentSize` + workArea-Kappung); Screenshot `docs/design-reviews/BL-51-settings.png` ohne Scrollbar, Reset-Button voll sichtbar; 435 Tests grün.
- **Akzeptanz:** Alle 5 Fieldsets + Statuszeile beim Öffnen ohne Scrollen sichtbar; Screenshot-Beweis.
- **Umsetzung:** `src/main/mrr/settings-window.ts` (`useContentSize: true`, `height = min(713, workAreaSize.height − 40)`; 713 = CDP-gemessener Worst-Case 705 px + 8 px Puffer, gemessen 2026-07-17), Pin-Test in `settings-window.test.ts`, `scripts/cdp-screenshot.mjs` um `--target`/`--measure` erweitert, Screenshot `docs/design-reviews/BL-51-settings.png` (alle 5 Fieldsets + Reset-Button, keine Scrollbar; Post-fix `hasVScroll`/`hasHScroll` = false). Tests 435 grün, typecheck/lint/build grün. Plan + Messwerte: `plans/51-settings-fensterhoehe-plan.md` §7.

### 52. DPR-Drift-Guard im Renderer
- **Beschreibung:** DPI-Wechsel ohne DIP-WorkArea-Änderung (z.B. Primärmonitorwechsel 1920×1080@100 % ↔ 3840×2160@200 %) wird vom Guard in `main.ts:227-234` verschluckt → `currentDpr` stale → Canvas/Bubble dauerhaft unscharf bis Neustart. Fix: DPR-Drift-Check im rAF-Loop + `currentDpr`-Neulesen in `onBoundsChanged`; optional `scaleFactor` in main-seitigen Change-Vergleich. Bericht: `parity/bereich-4`.
- **Status:** Offen (Paritäts-Lücke, Schwarm 2026-07-17).

### 53. Claude-XDG-Kandidat auch unter Windows prüfen (+ CRLF-Test)
- **Beschreibung:** win32-Zweig von `claudeConfigDirs` (`paths.ts:54-56`) ignoriert `~/.config/claude`, Unix nutzt Union — asymmetrisch. Fix: win32 als Union (eine Zeile), Test `paths.test.ts:76-81` bewusst umdrehen. Mitnehmen: CRLF-Fall für `read-lines.test.ts` nachrüsten (kein Befund, Lücke in Testabdeckung). Bericht: `parity/bereich-1`.
- **Status:** Offen (Paritäts-Risiko, Schwarm 2026-07-17).

### 54. Post-Merge-Hygiene: npm ci
- **Beschreibung:** Lokale node_modules stale (electron 43.1.0 installiert vs. 43.1.1 gelockt) — `npm ci` auf gelockten Stand heben. Keine Dependency-Änderung. Bericht: `parity/bereich-8`.
- **Status:** Offen (Hygiene, Orchestrierer direkt).

### 55. TS-7-ready tsconfig (node10 → nodenext)
- **Beschreibung:** `tsconfig.json:6` nutzt `moduleResolution: node10`, das in TypeScript 7 nicht mehr funktioniert — Dependabot-Branch `typescript-7.0.2` würde typecheck/build brechen. Fix: Migration auf `nodenext` vor dem Dependabot-Merge. Bericht: `parity/bereich-8`.
- **Status:** Offen (Paritäts-Risiko, Schwarm 2026-07-17).

### 56. @types/node an Node-24-Runtime koppeln
- **Beschreibung:** `@types/node ^26.1.1` (von Upstream geerbt) vs. überall Node-24-Runtime (engines, CI, Electron 43 bundled) — aktuell latent. Fix: auf `^24` pinnen + Dependabot-Ignore für `@types/node`-Major. Bericht: `parity/bereich-8`.
- **Status:** Offen (Paritäts-Risiko, Schwarm 2026-07-17).

### 57. Resync nach fehlgeschlagenem Pet-Reset
- **Beschreibung:** `main.ts:291` sendet HATCH_START vor dem XP-Persist — bei Persist-Fehler (Windows: Rename-Lock durch AV/Indexer) läuft der Hatch kosmetisch, obwohl der Reset fehlschlug. Fix: Catch-Pfad sendet `PET_CHANGED` mit `getLastUpdate()` (selbstheilend) — oder als akzeptiert dokumentieren. Bericht: `parity/bereich-5`.
- **Status:** Offen (Paritäts-Risiko, Schwarm 2026-07-17).

### 58. Renderer-Tests für Mid-Session-Reset
- **Beschreibung:** Hatch-cancelt-Evolution + Stage-Snap-ohne-`evolvingTo` mit bestehender Listener-Stub-Infra in `renderer.test.ts` abdecken; optional CDP-Akzeptanz des Arming-Doppelklicks. Bericht: `parity/bereich-5`.
- **Status:** Offen (Test-Lücke, Schwarm 2026-07-17).

### 59. Windows-Fenster-Icon auf ICO umstellen
- **Beschreibung:** Upstream d1b4ebe setzt BrowserWindow-Icons als 1024²-PNG (`settings-window.ts:257`) — funktional auf Windows, aber ICO wäre schärfer/konventionell. Fix: Plattform-Gate auf `assets/icon.ico` nach `loadTrayIcon`-Muster + Mini-Test. Bericht: `parity/bereich-6`.
- **Status:** Offen (Paritäts-Risiko/kosmetisch, Schwarm 2026-07-17).

### 60. Windows Live-Gate Renderer-Visuals (Hatch/Evolution/Quip-Bubble)
- **Beschreibung:** Echte Windows-Screenshots der Post-Merge-Visuals (12-px-Bold-Bubble, Hatch, Evolution-Flash) bei 100/125/150/200 % Skalierung via `--quip`/`--inject-xp`/`--reset-hatch` + `cdp-screenshot.mjs`; Ablage `docs/design-reviews/phase-4-windows/` (löst offenes Provisional-Gate ein, verknüpft mit #37). Bericht: `parity/bereich-7`.
- **Status:** Offen (Verifikations-Rückstand, Schwarm 2026-07-17).

### 61. Windows-Verhaltens-Doku: Occlusion + fraktionales DPR
- **Beschreibung:** Ein Satz Doku: bei voll verdecktem Overlay pausiert die Animation by design (Chromium-Occlusion, Windows-only). Ebenso dokumentieren: Pixel-Art-Shimmern bei fraktionellem DPR (125/150/175 %) ist inhärent (Wontfix). Bericht: `parity/bereich-7` + `parity/bereich-4`.
- **Status:** Offen (Doku, Schwarm 2026-07-17).

### 62. WSL-Usage-Logs evaluieren/dokumentieren
- **Beschreibung:** WSL-basierte Claude-/Codex-Installationen sind für den nativen Prozess unsichtbar (Logs unter `\\wsl$\<distro>\...`). Vorerst dokumentieren + Override-Workaround (`CLAUDE_CONFIG_DIR`/`CODEX_HOME` auf den WSL-Pfad; beide Overrides existieren). Kein vorschneller Bau (Registry-Enumeration ohne neue Deps nicht sauber). Bericht: `parity/bereich-1`.
- **Status:** Offen (Doku/Evaluierung, Schwarm 2026-07-17).

### 63. (Optional) Bubble-Outline: physikalisches Pixel-Snapping bei fraktionellem DPR
- **Beschreibung:** +0.5-Crisp-Line-Trick (`bubble.ts:103-114`) wirkt nur bei dpr 1/2; bei 1.25/1.5/1.75 ist die 1-px-Kontur leicht weich (Text bleibt scharf). Fix: Stroke-Breite `1/dpr` + Positionen via `ctx.getTransform().a` runden — oder als akzeptables Fractional-Scaling-Verhalten dokumentieren. Bericht: `parity/bereich-4`.
- **Status:** Offen (optional/kosmetisch, Schwarm 2026-07-17).

### 64. (Optional, upstream-Kandidat) Launch-Tier-Quip wird verschluckt
- **Beschreibung:** Erster Spend-Tier-Event nach `did-finish-load` wird auf beiden Plattformen verschluckt (onTick feuert vor `rendererReadyForQuips`, `main.ts:358` vs. `:400`). Fix: Replay analog Evolution-Replay. Paritäts-neutral — besser upstream einbringen. Bericht: `parity/bereich-3`.
- **Status:** Offen (optional, beide Plattformen, Schwarm 2026-07-17).

---

## 📋 Abarbeitungsstand & nächste Reihenfolge

**Erledigt (Runde 1, 2026-07-16/17):** #1, #2, #4a, #5, #6 — jeweils vollständiger Sub-Agenten-Loop (Planung → Plan-Verifikation → Umsetzung → Verifikation).
**Provisorisch:** #3 (Icons aus Sprite generiert, Designer offen), #7 (Adult-Placeholder aus Teen-Sheet, Designer offen).
**Dokumentiert, nicht umgesetzt:** #4b (SmartScreen-freie Signatur — kostenpflichtiges Zertifikat/Azure Trusted Signing).

**Runde 2 (2026-07-17, vom Owner nachgetragen):** #46 Reset-Button im Einstellungsfenster ✅, #47 Tray-Einzelklick ✅, #48 offene Idee Taskbar-Sprung (nur Doku), #49+ Upstream-Parität mit `ai-beavers/beaver-buddy`.

**Runde-2-Fortschritt (2026-07-17, final):**
- Commits: `e553c06` (Secret Store), `94ace5c` (Icons/Sprites), `cd4ef80` (CI/Signing/Installer), `4667082` (Taskbar-Inset, Tray-Klick, Reset), `e519105` (#50 Text), `5b19835` (#51 Fensterhöhe).
- **Merge `d7acaf0`:** `upstream/main` semantisch gemergt.
- **Paritäts-Analyse abgeschlossen (Schwarm, 8 Bereiche):** Berichte unter `.flightplan/Archive/plans/parity/`.
- **Paritäts-Items #49–#62 alle ✅ (2026-07-17, 2. Session):**
  - #49 Codex-Pfad-Union: `paths.ts` Union + 3 neue Tests
  - #50 „on this Mac"-Text: ✅ (vorheriger Commit `e519105`)
  - #51 Fensterhöhe: ✅ (vorheriger Commit `5b19835`)
  - #52 DPR-Drift-Guard: rAF-Loop + `onBoundsChanged` lesen `devicePixelRatio` neu
  - #53 Claude-XDG-Union + CRLF-Test: win32 nutzt jetzt XDG + Legacy, CRLF-Test in `read-lines`
  - #54 npm ci: node_modules auf Lockfile-Stand
  - #55 TS-7-ready tsconfig: `moduleResolution: node10` → `nodenext`, `ignoreDeprecations` entfernt
  - #56 @types/node: `^26.1.1` → `^24.0.0` + Dependabot-Ignore
  - #57 Resync nach fehlgeschlagenem Pet-Reset: Catch-Pfad sendet `PET_CHANGED`
  - #58 Renderer-Tests für Mid-Session-Reset: 2 neue Tests
  - #59 Windows-Fenster-Icon: `settings-window.ts` Plattform-Gate auf `icon.ico`
  - #60 Live-Gate Renderer-Visuals: 4 CDP-Screenshots in `docs/design-reviews/phase-4-windows/`
  - #61 Windows-Verhaltens-Doku: Occlusion + Fractional-DPR-Wontfix in README
  - #62 WSL-Usage-Logs-Doku: README um WSL-Hinweis + Override-Workaround ergänzt
- **#63/#64 (optional):** Nicht umgesetzt — Owner-Entscheidung ausstehend.

Danach wie bisher vorgeschlagen:

1. **#26** MRR-Modus auf Windows aktivieren (Abhängigkeit #1 ist erfüllt)
2. **#8–#18** Animationen (parallel nach Assets)
3. **#19–#23** State Machine & Verhalten
4. **#28–#32** Overlay-Verbesserungen
5. **#33–#36** Einstellungen & Tray
6. **#37–#41** QA & Design-Gates
7. **#42–#45** Release & Distribution

---

## ✅ Build-Status (Stand 2026-07-17, nach Abschluss Runde 2)

- `npm run build`: ✅ erfolgreich
- `npm run typecheck`: ✅ erfolgreich
- `npm run lint`: ✅ erfolgreich
- `npm run test`: ✅ **441 passed, 6 skipped (43 Dateien)**
- `npm ci`: ✅ node_modules auf Lockfile-Stand
- `tsconfig.json`: `module: nodenext`, `moduleResolution: nodenext` (TS-7-ready)
- `@types/node`: `^24.0.0` (an `engines.node: 24.x` gekoppelt, Dependabot-Ignore für Major-Bumps)
- CDP-Screenshots: `docs/design-reviews/phase-4-windows/{idle,quip-bubble,hatch,evolution-flash}.png`
- Git: Working Tree sauber; `.flightplan/Archive/` gitignored (lokale Doku)

---

## ▶️ Wiederaufnahme-Anleitung (nächste Session)

**Aktueller Punkt:** Runde 2 vollständig ✅. **Nächster Punkt: #26** — MRR-Modus auf Windows aktivieren (Secret Store ist seit #1 implementiert, Abhängigkeit erfüllt).

### Sofort-Aktion (nächste Session, Schritt 1)
- #26: MRR-Modus auf Windows aktivieren — `mrr-engine.ts` + `settings-window.ts` auf Windows freischalten, Tests ergänzen.
- Danach der Reihe nach: #8–#18 (Animationen), #19–#23 (State Machine), #28–#32 (Overlay), #33–#36 (Einstellungen & Tray), #37–#41 (QA & Design-Gates), #42–#45 (Release & Distribution).
- Optional: #63 (Bubble-Outline-Snapping) und #64 (Launch-Tier-Quip-Replay) — Owner fragen.

### Strikte Constraints (Owner-Vorgaben)
- **KEINE neuen npm-Dependencies** — package.json/package-lock.json unverändert.
- Keine git-Mutationen (commit/push/merge/rebase) ohne explizite Owner-Anweisung.
- `.flightplan/Archive/` ist gitignored → alle Pläne/Berichte sind lokal; committed Doku (README, docs/) bleibt Englisch.
- Pro Punkt nur die nötigen Dateien anfassen; Kommentare/Tests auf Englisch (Projektkonvention), Flight-Plan auf Deutsch.

### Maschinen-/Tooling-Wissen (nicht erneut erarbeiten)
- `powershell.exe` hat ein kaputtes Security-Modul → **immer `pwsh`** für Signatur-Checks verwenden.
- Node 24 führt `.ts` direkt aus (Scripts unter `scripts/gen-sprites/*.ts` laufen via `node …`).
- CDP-Verifikation: `scripts/cdp-screenshot.mjs <port> <outfile|-> [delayMs] [--target=<substr>] [--measure]`; App-Start isoliert via `npx electron . --user-data-dir=/tmp/<dir> --remote-debugging-port=9223 [--open-growth-settings] [--inject-xp=3100] [--reset-hatch] [--quip <trigger>]`; Prozesse danach sauber beenden.
- QA-Flags: `--smoke`, `--reset-hatch`, `--quip`, `--inject-xp` (3100 = Adult-Schwelle), `--open-growth-settings`.
- System-Locale en-US; 7-Zip unter `/c/Users/rodgi/scoop/shims/7z`.
- Bei Sub-Agent-Startfehlern (429/OAuth/Connection): kurz warten, Agent mit `resume` fortsetzen (behält Kontext).
- Test-Baseline an diesem Punkt: **441 passed / 6 skipped (43 Dateien)**.
- `npm ci` ist durchgeführt; `tsconfig.json` auf `nodenext`; `@types/node` auf `^24`.
