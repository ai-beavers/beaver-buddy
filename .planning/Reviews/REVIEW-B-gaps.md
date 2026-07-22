# Review B — Lücken & Vollständigkeit (Windows-native M1)

**Branch:** `bl-item/pixijs-puppet-studio/BL-14`
**Scope:** Milestone 1 Windows-native Items #1–#6 und Runde-2 Paritäts-Items #46–#62; aktueller Branch enthält zusätzlich Puppet Studio (BL-14 / PR #28, nicht Teil von M1).
**Reviewer:** Reviewer B (Lücken & Vollständigkeit)
**Date:** 2026-07-18

---

## Zusammenfassung

M1 ist **technisch durchimplementiert**: alle als `done` markierten Items haben Code-Belege und passende Tests. Es gibt jedoch **mehrere Doku-Lücken in `README.md`**, die den Windows-Stand aktiv falsch beschreiben, und zwei **Test-Lücken bei zentralen Sicherheits-/Lifecycle-Modulen**. Diese sollten vor dem nächsten Merge geschlossen werden.

---

## Lücken

### Major

#### 1. README.md behauptet fälschlich, MRR-Modus sei auf Windows nicht verfügbar
- **Schwere:** major
- **Beleg:** `README.md:40` — *"Optional MRR mode … Not available on Windows yet"*; `README.md:101` — *"MRR mode is not available on Windows yet"*
- **Was fehlt:** Der Code unterstützt MRR auf Windows vollständig: `src/main/mrr/secrets.ts` verwendet unter `win32` `electron.safeStorage` (DPAPI) für verschlüsselte Key-Dateien; `src/main/main.ts` startet `MrrEngine` und lässt den Modus-Wechsel über das Tray-Menü/Settings-Fenster zu; `src/main/tray.ts` blendet MRR erst ein, wenn mindestens eine Quelle verbunden ist; `src/main/mrr/settings-window.ts` speichert Stripe/RevenueCat-Keys.
- **Empfehlung:** README.md korrigieren: MRR ist auf Windows verfügbar, sobald ein Stripe- oder RevenueCat-Key hinterlegt ist; der Hinweis auf die noch ausstehende Administrator-Entscheidung ist überholt (durch #1 erledigt).

#### 2. README.md behauptet fälschlich, unter Windows würden nur Claude-Code-Logs verfolgt
- **Schwere:** major
- **Beleg:** `README.md:36` — *"On Windows only Claude Code logs are tracked for now"*
- **Was fehlt:** Flight-Plan-Item #49 ist umgesetzt: `src/main/usage/paths.ts` scannt unter Windows Union aller Codex-Kandidaten (`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`) und dedupliziert nach relativem Pfad. `paths.test.ts` deckt das ab.
- **Empfehlung:** Abschnitt "Windows usage tracking" neu schreiben: sowohl Claude Code (XDG + Legacy) als auch Codex (Union aller Kandidaten) werden auf Windows verfolgt.

#### 3. `src/main/hardening.ts` hat keine Unit-Tests trotz P1-Invarianten
- **Schwere:** major
- **Beleg:** `src/main/hardening.ts` (keine `hardening.test.ts`); `CLAUDE.md` fordert P1-Überprüfung in Review und "Every logic module ships with a vitest test".
- **Was fehlt:** Keine automatisierte Prüfung, dass `will-navigate`, `setWindowOpenHandler`, `setPermissionRequestHandler` und `will-download` tatsächlich blockieren/ablehnen.
- **Empfehlung:** `hardening.test.ts` anlegen, das `BrowserWindow`/`session` mockt und jeden Handler auf `preventDefault` / `action: deny` / `callback(false)` prüft.

#### 4. `src/main/main.ts` hat keine Unit-Tests für zentrale App-Lifecycle-Logik
- **Schwere:** major
- **Beleg:** `src/main/main.ts` (keine `main.test.ts`).
- **Was fehlt:** Single-instance lock, `second-instance` Restore/Focus, Flag-Parsing (`--quip`, `--inject-xp`, `--keychain-service`), `onProgressReset`-Resync-Fallback (#57) und die Interaktion zwischen `XpEngine`, `UsageTracker`, `MrrEngine` und Tray sind ungetestet.
- **Empfehlung:** Zumindest die pure Flag-Parser-Logik in eine separate Datei auslagern und testen; den Single-Instance- und Reset-Resync-Pfad mit spärlichen Electron-Mocks abdecken (Rest bleibt Integration/E2E).

### Minor

#### 5. README.md nennt Windows-Builds weiterhin "currently unsigned"
- **Schwere:** minor
- **Beleg:** `README.md:78` — *"currently unsigned, so Windows Defender SmartScreen may show a warning"*
- **Was fehlt:** Flight-Plan-Item #4a ist umgesetzt (`electron-builder.yml` `signtoolOptions`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, CI-Integration, `docs/code-signing.md`). Self-signed Signatur ist aktiv, auch wenn SmartScreen weiterhin warnt (#4b).
- **Empfehlung:** Formulierung auf "self-signed code signing is active in CI/dev builds; SmartScreen still warns until a publicly trusted certificate lands (#4b)" anpassen.

#### 6. `docs/design-reviews/phase-4-windows/verdict.md` widerspricht vorhandenen Screenshots
- **Schwere:** minor
- **Beleg:** `docs/design-reviews/phase-4-windows/verdict.md:86` — *"Screenshots: not captured in this CLI-only environment"*; tatsächlich existieren `idle.png`, `quip-bubble.png`, `hatch.png`, `evolution-flash.png` im selben Verzeichnis.
- **Was fehlt:** Verdict wurde nach dem Hinzufügen der Screenshots nicht aktualisiert.
- **Empfehlung:** Verdict mit den Screenshot-Dateien verknüpfen und den Satz "provisional until real Windows screenshots can be added" anpassen oder entfernen.

#### 7. Leere `NUL`-Datei liegt im Working Tree
- **Schwere:** minor
- **Beleg:** `git status` zeigt `?? NUL` (0 Byte, 2026-07-18).
- **Was fehlt:** Die Datei ist vermutlich ein Artefakt eines fehlgeschlagenen `> NUL`-Redirects auf Windows und hat keinen Inhalt.
- **Empfehlung:** `rm NUL` und ggf. `.gitignore` prüfen, ob `NUL` explizit ausgeschlossen werden sollte.

#### 8. Haupt-Overlay-Fenster verwendet auf Windows weiterhin das PNG-Icon statt der ICO-Datei
- **Schwere:** minor
- **Beleg:** `src/main/main.ts:120` — `icon: appIconPath()` -> `assets/beaver-buddy-icon.png`; `settings-window.ts` wurde dagegen in #59 auf `icon.ico` umgestellt.
- **Was fehlt:** `createWindow()` nutzt kein plattformspezifisches Icon. Da `skipTaskbar: true` gesetzt ist, ist der Effekt begrenzt, aber für Task-Manager/Alt-Tab wäre `assets/icon.ico` konventioneller.
- **Empfehlung:** Analog zu `settings-window.ts` unter `win32` `assets/icon.ico` verwenden; Test ergänzen, falls das Fenster-Icon je geprüft wird.

---

## Item-Coverage

| Item | Beschreibung | Status | Code-Beleg / Test-Beleg | Anmerkung |
|---|---|---|---|---|
| #1 | Windows Secret Store | done | `src/main/mrr/secrets.ts`, `secrets.test.ts` | DPAPI + `safeStorage` unter `win32` |
| #2 | Auto-Hide Taskbar Robustheit | done | `src/main/overlay-adapter.ts:36-50`, `overlay-adapter.test.ts` | 2-DIP-Inset bei `workArea === bounds` |
| #3 | Professioneller Icon-Pass | provisional | `assets/icon.ico`, `assets/tray-icon.png`, `scripts/gen-sprites/build-icons.ts` | Placeholder aus Sprite-Frame; finaler Design-Pass offen |
| #4a | Signing-Infrastruktur | done | `electron-builder.yml`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, `docs/code-signing.md` | Self-signed-CI-Pipeline |
| #4b | SmartScreen-freie Auslieferung | dokumentiert | `docs/code-signing.md` | Erfordert echtes Zertifikat/Azure Trusted Signing (#42) |
| #5 | Installer-Lokalisierung | done | `electron-builder.yml:21-22`, `installer-config.test.ts` | `en_US`, `de_DE` |
| #6 | Startmenü-/Desktop-Shortcut | done | `electron-builder.yml:15-19` | `createDesktopShortcut`, `createStartMenuShortcut` |
| #46 | Reset-Button im Einstellungsfenster | done | `src/main/mrr/settings-window.ts`, `settings.html`, `settings-window.test.ts` | Two-click arming |
| #47 | Tray-Einzelklick | done | `src/main/tray.ts:106-108`, `tray.test.ts` | `popUpContextMenu()` unter `win32` |
| #48 | Taskbar-Sprung-Animation | offen Idee | nur dokumentiert | keine Umsetzungsverpflichtung |
| #49 | Codex-Homes unter Windows vereinigen | done | `src/main/usage/paths.ts:162-191`, `paths.test.ts` | Union + Dedup |
| #50 | Connect-Hint plattformneutral | done | `src/main/mrr/settings.html:63` | "on this computer" |
| #51 | Settings-Fensterhöhe | done | `src/main/mrr/settings-window.ts:60-72`, `settings-window.test.ts` | 713 px, `useContentSize` |
| #52 | DPR-Drift-Guard im Renderer | done | `src/renderer/renderer.ts:230-238`, `renderer.test.ts` | rAF-Loop + resize-Handler |
| #53 | Claude-XDG-Union + CRLF-Test | done | `src/main/usage/paths.ts:54-60`, `paths.test.ts`, `read-lines.test.ts` | `win32` prüft XDG + Legacy |
| #54 | npm ci auf Lockfile-Stand | done | `package-lock.json` | lokal gemeldet |
| #55 | TS-7-ready tsconfig | done | `tsconfig.json:6` | `moduleResolution: nodenext` |
| #56 | @types/node an Node 24 | done | `package.json:32` | `^24.0.0` |
| #57 | Resync nach fehlgeschlagenem Reset | done | `src/main/main.ts:225-237` | Catch-Pfad sendet PET_CHANGED |
| #58 | Renderer-Tests für Mid-Session-Reset | done | `src/renderer/renderer.test.ts:141-202` | Hatch cancelt Evolution + Stage-Snap |
| #59 | Windows-Fenster-Icon auf ICO | done | `src/main/mrr/settings-window.ts:279`, `settings-window.test.ts` | `icon.ico` unter `win32` |
| #60 | Live-Gate Renderer-Visuals | done | `docs/design-reviews/phase-4-windows/*.png` | 4 Screenshots vorhanden |
| #61 | Windows-Verhaltens-Doku | done | `README.md:117-128` | Occlusion + Fractional-DPR |
| #62 | WSL-Usage-Logs Doku | done | `README.md:103-111` | Override-Workaround |
| #63 | Bubble-Outline fraktionelles DPR | optional | — | nicht umgesetzt, Owner-Entscheidung offen |
| #64 | Launch-Tier-Quip Replay | optional | — | nicht umgesetzt, upstream-Kandidat |

---

## Geprüfte Dateien

- `PRD.md` (Product Source of Truth)
- `CLAUDE.md` (Guardrails, Definition of Done)
- `.flightplan/Reference/windows-native-flight-plan.md` (M1-Item-Spezifikation)
- `.flightplan/ROADMAP.md` (Milestones)
- `src/main/main.ts`
- `src/main/overlay-adapter.ts` + `.test.ts`
- `src/main/tray.ts` + `.test.ts`
- `src/main/hardening.ts`
- `src/main/preload.ts` + `.test.ts`
- `src/main/mrr/secrets.ts` + `.test.ts`
- `src/main/mrr/mrr-engine.ts` + `.test.ts`
- `src/main/mrr/settings-window.ts` + `.test.ts`
- `src/main/mrr/settings.html`
- `src/main/usage/paths.ts` + `.test.ts`
- `src/main/usage/read-lines.ts` + `.test.ts`
- `src/renderer/renderer.ts` + `.test.ts`
- `src/renderer/canvas-dpr.ts` + `.test.ts`
- `electron-builder.yml`
- `package.json`
- `tsconfig.json`
- `README.md`
- `CONTRIBUTING.md`
- `docs/code-signing.md`
- `docs/design-reviews/phase-4-windows/verdict.md` + Screenshots
- `tools/puppet-studio/README.md` (Kurzcheck, nicht M1-Scope)

---

## Verdict

- **M1-done gerechtfertigt:** **Ja** — alle in M1 erfassten Items (#1–#6, #46–#62) sind entweder vollständig implementiert, bewusst als provisional markiert (#3, #7) oder dokumentiert offen (#4b, #48, #63, #64). Es gibt keine Hinweise auf unvollständige oder stubhafte Implementierungen bei als `done` markierten Items.
- **PR-ready:** **Nein** — die `README.md`-Lücken (#1, #2, #5) und die fehlenden Tests für `hardening.ts`/`main.ts` (#3, #4) sollten vor dem nächsten Merge geschlossen werden. Sie sind schnell zu beheben und verhindern, dass ein öffentlicher Branch mit falschen Nutzerversprechen oder ungetesteten P1-Invarianten landet.
- **Empfohlene nächste Schritte:**
  1. `README.md` Windows-Abschnitt korrigieren (MRR, Codex, Signing).
  2. `hardening.test.ts` und `main.test.ts` (zumindest Pure-Logic-Teile) ergänzen.
  3. `NUL` aus dem Working Tree entfernen.
  4. `docs/design-reviews/phase-4-windows/verdict.md` auf die vorhandenen Screenshots aktualisieren.
