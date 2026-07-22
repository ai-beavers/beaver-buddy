# Bereich 2 — Connect-UI-Parität (Tray + Settings)

Datum: 2026-07-17 · Branch: bl-item/windows-native/BL-WIN (Merge d7acaf0) · Analyse read-only

## 1. Urteil

**LÜCKE(N) GEFUNDEN** — 1 [lücke] (Mac-only-UI-Text), 1 [risiko] (Fensterhöhe → Reset-Sektion below the fold). Tray-Connect, Radio-Logik und Secrets-Backend sind verifiziert paritätisch.

Korrektur einer Briefing-Annahme: Upstream hat **kein** Connect-Submenü mehr im Tray. Commit 32335bb (Connect-Submenü) wurde durch da3e863/9fa8bf2 ersetzt — `git show upstream/main:src/main/tray.ts` zeigt dasselbe flache `Connect…`-Item wie unser Merge (`src/main/tray.ts:66`). Es gibt also keinen Konflikt zwischen „Upstream-Submenü" und unserem win32-Single-Click.

## 2. Befunde

### B2.1 [lücke] Connect-Hint sagt „on this Mac"

- **Fundstelle:** `src/main/mrr/settings.html:63`
- **Text:** „Opt in to read local Claude Code / Codex usage logs **on this Mac** — no API keys."
- Auf Windows sichtbar falsch. Vollständiger grep nach `Mac|macOS|Keychain|Windows|win32` über `settings.html` + `tray.ts`: dies ist der **einzige** sichtbare Mac-only-Text (alle tray.ts-Treffer sind Code-Kommentare, tray.ts:99-106). Kein „Keychain" in sichtbaren UI-Texten — die Fehlertexte der Handler sind bereits plattformneutral (`'secret write failed'`, settings-window.ts:126-128, 174-176).
- **Fix:** Wortlaut neutralisieren, z. B. „on this computer" (eine Zeile, keine Dependency). Der Text stammt von upstream — Fix zusätzlich als upstream-Beitrag sinnvoll.

### B2.2 [risiko] Fensterhöhe 680: Pet/Reset-Sektion + Statuszeile liegen below the fold

- **Fundstelle:** `src/main/mrr/settings-window.ts:250-255` (420×680, `resizable: false`)
- **Sektionen (5 Fieldsets + Status):** Connect (`settings.html:60-82`), Stripe (`84-93`), RevenueCat (`95-106`), Growth source (`108-112`), Pet (`114-123`), `#status` (`125`).
- **Kalibrierte Höhenschätzung:** Der BL-9-Screenshot (`docs/design-reviews/BL-9-settings.png`, 840×904 @2x ⇒ Viewport 420×452 bei damaliger Höhe 480) belegt das Maßmodell: macOS-Viewport = Fensterhöhe − 28 px Titelleiste, und Stripe+RevenueCat+Growth+Status ≈ 450 CSS-px — passt exakt. Dasselbe Modell mit den zwei neuen Sektionen (Connect ≈ 150–165 px, Pet ≈ 100–115 px) ergibt **Content ≈ 700 CSS-px** (bis ≈ 730, wenn beide Token-Zeilen gefüllt sind).
- **Viewport:** macOS ≈ 652 px; Windows ≈ 649 px (Titelleiste ~31 px, `useContentSize` nicht gesetzt). ⇒ **Überlauf ≈ 50–80 px**: vertikale Scrollbar, Pet/Reset (letzte Sektion) und `#status` sind beim Öffnen nicht vollständig sichtbar. Auf Windows ist die Scrollbar dauerhaft sichtbar (kein macOS-Overlay-Stil) und nimmt zusätzlich ~15 px Breite.
- Verschärft durch unsere Branch: der Pet-Hint ist eine Zeile länger als upstream (`settings.html:116-119`, +~15 px) ohne Höhenanpassung — upstream hat die Höhe historisch mit jeder Sektion erhöht (480→560→640→680, `git log -p upstream/main -- src/main/mrr/settings-window.ts`).
- Funktional nichts kaputt (Mausrad-Scrollen funktioniert im nicht-resizierbaren Fenster), aber die Discoverability der Reset-Danger-Zone leidet; auf Windows minimal schlechter als auf macOS.
- **Fix:** Erst messen, dann setzen — App mit `--open-growth-settings --remote-debugging-port=<port>` starten (Flag existiert, `main.ts:335`) und per CDP `Runtime.evaluate` die echte `document.body.scrollHeight` lesen; danach `height` auf ~750–760 erhöhen (oder `useContentSize: true` + passende Content-Höhe). Keine neuen Dependencies. Hinweis: `scripts/cdp-screenshot.mjs` wählt das erste page-Target (Overlay) — für den Screenshot des Settings-Fensters muss die Target-Auswahl auf Titel/URL erweitert werden.

## 3. Verifiziert-OK

- **Tray-Menüstruktur 1:1 mit upstream:** `Connect…` als flacher Menüpunkt vor `Growth` (`src/main/tray.ts:66-67`), Labels/Radio/Checked-Logik identisch (`git diff upstream/main HEAD -- src/main/tray.ts` zeigt nur win32-Icon-Split, win32-Click-Handler und `void | Promise<void>`-Typbreitung). Getestet: `tray.test.ts:142-154` (Position/Click), `177-204` (MRR hidden/shown, Radio-Checked).
- **Verträglichkeit win32-Single-Click ↔ Menü:** `popUpContextMenu()` ohne Argumente (`tray.ts:106-108`) öffnet immer das zuletzt per `setContextMenu` gesetzte Menü; Handler einmalig außerhalb von `rebuildMenu()` registriert → refresh-sicher, kein Stacking (getestet: `tray.test.ts:270-295`, inkl. darwin/linux-Gates `297-313`).
- **Radio-Häkchen auf Windows korrekt:** Electron toggelt `checked` bei Radio-Items unter Windows/Linux nicht automatisch — hier durch `rebuild()` nach jedem Klick gelöst (`tray.ts:36-39, 47-50`); `growthSettings` wird synchron vor dem ersten `await` gesetzt (`main.ts:324`), d. h. `rebuild()` liest bereits den neuen Modus. MRR-Item ist hidden-not-disabled bis eine Quelle verbunden ist (`tray.ts:42-52`, `main.ts:321`).
- **Tray-Icon-Split:** win32/linux → `tray-icon.png` ohne Template-Flag, darwin → `tray-iconTemplate.png` + `setTemplateImage(true)` (`tray.ts:84-91`; Tests `tray.test.ts:221-249`).
- **Secrets-Backend für Settings-Save auf Windows vorhanden:** DPAPI via Electron `safeStorage`, verschlüsselte Dateien unter `<stateDir>/secrets/<service>/<account>.enc` (`src/main/mrr/secrets.ts:25-35, 45-56, 67-76`) — Stripe/RevenueCat Save/Disconnect funktioniert auf win32; Keychain-CLI nur darwin-gegated.
- **IPC-Rename RESET_PET→RESET_PROGRESS konsistent:** `ipc-channels.ts:21`, `settings-preload.ts:15`, `settings-window.ts:16,194-202`; Drift-Guard in `ipc-channels.test.ts`. Zwei-Klick-Arming statt `confirm()` (`settings.html:244-271`) plattformneutral.
- **Connect-Flow opt-in, kein Auto-Connect:** `connectUsage` setzt nur enabled-Flags + Status-Rückgabe (`settings-window.ts:204-226`; Tests `settings-window.test.ts:144-167`). Windows-Log-Pfade existieren (`usage/paths.ts:54-56, 141-148`) — Detailprüfung = Bereich 1.
- **Fenster-Infrastruktur plattformneutral:** Single-Instance + Fokus (`settings-window.ts:245-248`), Hardening (`applyWindowHardening`, settings-window.ts:266), CSP (`settings.html:8-11`), Sandbox/Preload (`settings-window.ts:258-263`), Sender-Frame-Check (`settings-window.ts:45-47`).
- **Keine weiteren Mac-only-Texte:** alle Buttons/Status/Placeholders in `settings.html` und alle Tray-Labels/Tooltips neutral. Kleinigkeit ohne Befund-Status: Font-Stack `-apple-system, sans-serif` (`settings.html:15`) fällt auf Windows auf Chromium-`sans-serif` (Arial) statt Segoe UI zurück — rein kosmetisch.
- **Hinweis (upstream-inhärent, keine Windows-Lücke):** `onOpenConnect` und `onOpenGrowthSettings` sind dieselbe Funktion (`main.ts:329-330`) — das Fenster scrollt/fokussiert nicht auf die Connect-Sektion, obwohl der Kommentar in `tray.ts:19-20` das suggeriert. Identisch zu upstream ⇒ Parität gegeben.

## 4. Vorgeschlagene Flight-Plan-Items

1. **Connect-Hint plattformneutral formulieren** — `settings.html:63` „on this Mac" → „on this computer" (1 Zeile, ggf. upstream einreichen).
2. **Settings-Fensterhöhe für 5 Sektionen vermessen und anpassen** — echte `scrollHeight` per CDP/`--open-growth-settings` messen, `height` 680 → ~750–760 (oder `useContentSize: true`), danach Windows-Screenshot-Beweis im BL-9-Stil nachziehen (Target-Auswahl in `cdp-screenshot.mjs` beachten).
