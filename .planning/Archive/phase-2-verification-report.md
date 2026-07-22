# Phase 2 Verification Report — Core Windows Experience

**Datum:** 2026-07-15
**Geprüfte Build-Items:** BL-WIN-3 (Overlay-Adapter für Windows), BL-WIN-4 (Tray-Adapter für Windows)
**Verifier:** Verifikations-Agent

---

## 1. Zusammenfassung der geprüften Umsetzung

Die Implementierung von Phase 2 wurde anhand des Plans (`.flightplan/Archive/phase-2-plan.md`), des kritischen Reviews (`.flightplan/Archive/phase-2-plan-review.md`) und des Implementationslogs (`.flightplan/Archive/phase-2-implementation-log.md`) geprüft. Die zentralen Architekturentscheidungen wurden wie vom Review empfohlen umgesetzt:

- `fitWindowToWorkArea` verwendet `setBounds(..., false)` (keine Animation).
- Der Renderer verwendet explizite Bounds aus dem IPC-Kanal `state:bounds` statt `window.innerWidth/Height`.
- WorkArea-Änderungen werden in `main.ts` dedupliziert.
- `clampRoamStateToBounds` lebt in `roam.ts` und nutzt die bestehenden `maxX`/`groundY`-Helfer.
- `setTemplateImage` wird nur auf `darwin` aufgerufen.

Build, Typecheck, Lint, Tests und Windows-Packaging laufen erfolgreich durch. Die neuen Unit-Tests decken den Overlay-Adapter, die IPC-Kette (`preload.ts`) und die Tray-Icon-Ladung ab.

Allerdings zeigt `git status` zusätzliche Änderungen außerhalb des in Phase 2 erwarteten Dateisatzes. Diese stammen offensichtlich aus vorherigen Phasen/anderer Arbeit, sind aber für diese Verifikation als Abweichung vom erwarteten Änderungssatz zu vermerken.

---

## 2. Punktuelle Prüfung pro Build-Item

### BL-WIN-3: Overlay-Adapter für Windows

| Kriterium | Status | Begründung |
|-----------|--------|------------|
| Adapter-Modul existiert | ✅ | `src/main/overlay-adapter.ts` neu angelegt. |
| Taskleisten-Kantenerkennung | ✅ | `detectTaskbarEdge` prüft top/bottom/left/right/none. Tests für alle Fälle vorhanden. |
| `workArea` als Bezugsgröße | ✅ | `getPrimaryWorkAreaInfo` und `getOverlayWindowBounds` nutzen `display.workArea`. |
| Plattformspezifischer `setAlwaysOnTop`-Level | ✅ | `darwin` → `'floating'`; `win32`/`linux` → `'normal'`. |
| Keine `setBounds`-Animation | ✅ | `fitWindowToWorkArea` ruft `win.setBounds(..., false)` auf. |
| Bounds explizit via IPC an Renderer | ✅ | `BOUNDS_CHANGED_CHANNEL = 'state:bounds'`; Senden in `main.ts` bei Änderungen und initial nach `did-finish-load`. |
| Renderer nutzt IPC-Bounds | ✅ | `renderer.ts` setzt `canvas.width/height` direkt aus dem Payload. |
| WorkArea-Änderungen dedupliziert | ✅ | `main.ts` speichert `lastWorkArea` und aktualisiert nur bei tatsächlicher Änderung. |
| `clampRoamStateToBounds` integriert | ✅ | In `roam.ts` implementiert und wiederverwendet `maxX`/`groundY`. |
| Smoke-Test erweitert | ✅ | `--smoke` gibt `boundsMatchWorkArea` zurück. |
| Auto-Hide-Erkennung | ⚠️ | Wie im Review kritisiert, kann `detectTaskbarEdge` Auto-Hide nicht zuverlässig erkennen (`workArea == bounds`). Wurde bewusst als dokumentierte Limitation akzeptiert. |
| Z-Order auf echter Windows-Hardware verifiziert | ⚠️ | `'normal'` ist konservative Wahl; empirischer Test auf Windows 10/11 fehlt. Fallback `'pop-up-menu'` dokumentiert. |

### BL-WIN-4: Tray-Adapter für Windows

| Kriterium | Status | Begründung |
|-----------|--------|------------|
| Plattformspezifische Icon-Auswahl | ✅ | `loadTrayIcon` lädt auf `win32`/`linux` `tray-icon.png`, auf `darwin` `tray-iconTemplate.png`. |
| `setTemplateImage` nur auf macOS | ✅ | Guard `process.platform === 'darwin'` vor `setTemplateImage`. |
| Tray-Menü unverändert | ✅ | `buildMenuTemplate` und `createTray` enthalten keine plattformspezifischen Menü-Änderungen. |
| Tests für Icon-Ladung | ✅ | `tray.test.ts` deckt `win32`, `darwin`, `linux` ab. |

---

## 3. Ergebnisse der ausgeführten Befehle

| Befehl | Ergebnis |
|--------|----------|
| `npm run build` | ✅ Erfolgreich (`Assets built successfully.`) |
| `npm run typecheck` | ✅ Erfolgreich (keine Fehler) |
| `npm run lint` | ✅ Erfolgreich (keine Fehler) |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npx electron-builder --win --publish never` | ✅ Erfolgreich (NSIS + portable erstellt und signiert) |

**Testabdeckung Phase 2:**
- `src/main/overlay-adapter.test.ts`: 14 Tests
- `src/main/preload.test.ts`: 3 Tests
- `src/main/tray.test.ts`: +3 Tests für `loadTrayIcon`

---

## 4. Gefundene Fehler / Lücken / Abweichungen

### 4.1 Unerwartete Dateiänderungen außerhalb des Phase-2-Scopes
**Schweregrad:** Mittel

`git status` zeigt neben den erwarteten Phase-2-Dateien weitere Modifikationen an:

```
 M .github/workflows/ci.yml
 M .gitignore
 M CLAUDE.md
 M PRD.md
 M README.md
 M electron-builder.yml
 M package.json
?? "## BEAVER ANIMATIONS IDEE ROHTEXT.md"
?? assets/icon.ico
?? assets/tray-icon.png
?? docs/adr/002-cross-platform-scope.md
?? scripts/build-assets.js
```

Diese Dateien sind nicht Teil der in Phase 2 zu ändernden Dateiliste. Sie dürften aus Phase 1 oder paralleler Arbeit stammen. Für die reine Phase-2-Verifikation sind sie als „unerwartet" zu kennzeichnen.

### 4.2 Auto-Hide-Taskleiste bleibt ungelöst
**Schweregrad:** Niedrig – Mittel

`detectTaskbarEdge` erkennt Auto-Hide nicht (workArea == bounds). Der Implementierungs-Agent hat dies bewusst als Limitation dokumentiert und keine native AppBar-API eingeführt. Akzeptabel im Kontext der Phase-2-Ziele, aber nicht vollständig gegen den ursprünglichen Plan (siehe Akzeptanzkriterien in `phase-2-plan.md`).

### 4.3 Z-Order-Level `'normal'` nicht empirisch verifiziert
**Schweregrad:** Mittel

Der Code kommentiert korrekt, dass `'normal'` auf echter Windows-Hardware getestet werden muss. Dieser Verifikations-Agent kann keinen GUI-Test durchführen. Falls `'normal'` unter der Taskleiste liegt, ist der dokumentierte Fallback `'pop-up-menu'` vorgesehen.

### 4.4 `display-metrics-changed` kann ohne WorkArea-Änderung feuern
**Schweregrad:** Niedrig

Die Deduplizierung in `main.ts` fängt dies ab, aber `onWorkAreaChanged` selbst reagiert auf alle drei Events und ruft den Callback auf, auch wenn sich nichts geändert hat. Da `main.ts` filtert, ist dies praktisch kein Problem, wäre aber sauberer im Adapter selbst zu kapseln.

---

## 5. Empfohlene Fixes / Follow-up

1. **Git-Arbeitsbereich bereinigen:** Prüfen, ob die zusätzlichen Änderungen (CI, README, Assets aus Phase 1) bereits committet werden sollen, damit `git status` für Phase 2 nur die erwarteten Dateien anzeigt.
2. **Manueller Windows-Smoke-Test:** Auf echter Windows-Hardware prüfen:
   - Biber bleibt über der sichtbaren Taskleiste (`'normal'`).
   - Taskleiste oben/links/rechts → Biber bleibt innerhalb der WorkArea.
   - Auto-Hide: Dokumentiertes Verhalten bestätigen.
   - Falls nötig: Fallback auf `'pop-up-menu'` testen und endgültig festlegen.
3. **Optionale Verstärkung des Adapters:** `onWorkAreaChanged` könnte intern deduplizieren, damit der Callback nur bei echten Änderungen feuert.
4. **Tray-Icon-Kontrast:** In Phase 4 (BL-WIN-10/HiDPI) visuelles Design-Gate für dunkle Taskleisten einplanen.

---

## 6. Gesamt-Status

**PASSED WITH WARNINGS**

Die Implementierung entspricht dem Plan und den Review-Empfehlungen, alle automatisierten Checks sind grün, und die neuen Tests sind sinnvoll. Die Warnungen betreffen ausschließlich:
- Laufzeitverhalten, die nur auf echter Windows-Hardware verifiziert werden können (Z-Order, Auto-Hide).
- Zusätzliche Dateiänderungen im Arbeitsbereich, die außerhalb des Phase-2-Scopes liegen.

Eine Freigabe für Phase 2 ist unter der Bedingung empfohlen, dass die genannten manuellen Smoke-Tests auf Windows zeitnah durchgeführt werden.
