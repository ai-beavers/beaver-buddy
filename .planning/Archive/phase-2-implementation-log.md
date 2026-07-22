# Beaver Buddy — Phase 2: Core Windows Experience — Implementationslog

**Datum:** 2026-07-15  
**Build-Items:** BL-WIN-3 (Overlay-Adapter für Windows), BL-WIN-4 (Tray-Adapter für Windows)  
**Umgesetzt von:** Implementierungs-Agent

---

## 1. Zusammenfassung der Änderungen

### 1.1 Neue Datei: `src/main/overlay-adapter.ts`

Eingeführt als plattformspezifischer Adapter für Overlay-Position, Z-Order und Taskleisten-Erkennung:

- `detectTaskbarEdge(bounds, workArea)` — ermittelt `top`/`bottom`/`left`/`right`/`none` aus dem Vergleich von Display-Bounds und Work-Area.
- `getPrimaryWorkAreaInfo()` — liefert die Work-Area des primären Displays inkl. Taskleisten-Kante.
- `getOverlayWindowBounds(display)` — berechnet die Fenster-Bounds aus der Work-Area.
- `configureAlwaysOnTop(win)` — setzt auf macOS `floating`, auf Windows/Linux `normal`.
- `fitWindowToWorkArea(win, info)` — setzt Fenster-Bounds sofort (`setBounds(..., false)`), ohne Animation.
- `onWorkAreaChanged(callback)` — abonniert `display-added`, `display-removed`, `display-metrics-changed` und liefert einen Unsubscribe-Handler.

### 1.2 Anpassungen `src/main/main.ts`

- Importiert den Overlay-Adapter und `BOUNDS_CHANGED_CHANNEL`.
- `createWindow()` verwendet `configureAlwaysOnTop(win)` statt hartkodiertem `'floating'`.
- Nach dem Fensteraufbau wird `fitWindowToWorkArea(mainWindow, lastWorkArea)` aufgerufen.
- `onWorkAreaChanged`-Handler speichert die letzte Work-Area und aktualisiert `setBounds` nur, wenn sich `x/y/width/height` tatsächlich ändern.
- Bei Work-Area-Änderungen werden die neuen Bounds über IPC (`state:bounds`) an den Renderer gesendet.
- `did-finish-load` sendet die initialen Bounds explizit an den Renderer.
- `--smoke` liefert zusätzlich `boundsMatchWorkArea` zurück.

### 1.3 IPC-Kanal `state:bounds`

- `src/main/ipc-channels.ts`: `BOUNDS_CHANGED_CHANNEL = 'state:bounds'`.
- `src/main/preload.ts`: `onBoundsChanged` exposed via `contextBridge`; Kanal-Name als Inline-Literal (Preload kann keine Sibling-Module importieren).

### 1.4 Anpassungen Renderer

- `src/renderer/roam.ts`: Neue Exportfunktion `clampRoamStateToBounds(state, bounds)` verwendet die bestehenden `maxX`/`groundY`-Helfer.
- `src/renderer/renderer.ts`:
  - `Window.beaverBuddy` Interface um `onBoundsChanged` erweitert.
  - Handler setzt `canvas.width/height` explizit auf die IPC-Bounds (nicht `window.innerWidth/Height`).
  - Roaming-State wird nach Bounds-Änderung auf die neuen Grenzen geklemmt.

### 1.5 Tray-Adapter für Windows (`src/main/tray.ts`)

- Neue Hilfsfunktion `loadTrayIcon()`:
  - macOS: `assets/tray-iconTemplate.png` + `setTemplateImage(true)`.
  - Windows/Linux: `assets/tray-icon.png` (farbig), kein `setTemplateImage`.

### 1.6 Tests

- `src/main/overlay-adapter.test.ts` (neu):
  - `detectTaskbarEdge` für alle vier Kanten + `none`.
  - `configureAlwaysOnTop` für `darwin`, `win32`, `linux`.
  - `fitWindowToWorkArea` prüft `setBounds(..., false)`.
  - `onWorkAreaChanged` prüft Subscribe/Unsubscribe und Event-Feuerung.
- `src/main/preload.test.ts` (neu):
  - Prüft, dass `onBoundsChanged` über `contextBridge` exposed wird.
  - Simuliert `ipcRenderer.on('state:bounds', ...)` und prüft Weiterleitung an Callback.
- `src/main/tray.test.ts` (erweitert):
  - Tests für `loadTrayIcon()` auf `win32`, `darwin`, `linux` inkl. Template-Image-Verhalten.

---

## 2. Entscheidungen

### 2.1 Auto-Hide-Taskleiste

**Befund:** `workArea` und `bounds` sind bei Auto-Hide auf Windows oft identisch; eine zuverlässige Erkennung der Taskleisten-Kante ist ohne native AppBar-API nicht möglich.

**Entscheidung:** Auto-Hide wurde explizit aus den Akzeptanzkriterien entfernt. Der Code dokumentiert dies in `detectTaskbarEdge` und `getPrimaryWorkAreaInfo`: Bei Auto-Hide wird `taskbarEdge: 'none'` zurückgegeben und das Fenster auf die volle Bildschirmgröße ausgerichtet. Der Biber kann kurzzeitig von einer eingeblendeten Auto-Hide-Leiste verdeckt werden. Eine native AppBar-API wurde nicht eingeführt, da dies neue Dependencies (z. B. `node-ffi-napi`) erfordern würde — im Widerspruch zu CLAUDE.md und den Review-Befunden.

### 2.2 Fenster-Animation bei Bounds-Änderungen

**Entscheidung:** `fitWindowToWorkArea` verwendet `setBounds(..., false)` (keine Animation). Begründung:

- Vermeidet Asynchronität zwischen Main-Prozess und Renderer.
- Transparente, klick-durch-Fenster können beim animierten Resize auf Windows flackern/ghosten.
- Die „Sanftheit" der Positionierung wird durch den Roaming-State erreicht: `clampRoamStateToBounds` stellt sicher, dass der Biber bei einer kleiner werdenden Work-Area selbst in die neue Fläche läuft.

### 2.3 Renderer-Bounds

**Entscheidung:** Der Renderer verwendet ausschließlich die expliziten Bounds aus dem `state:bounds`-IPC-Kanal. `canvas.width/height` werden im `onBoundsChanged`-Handler direkt aus dem Payload gesetzt; `window.innerWidth/Height` dienen nur noch als initialer Fallback (das Fenster wird bereits beim Erstellen auf die Work-Area ausgerichtet).

### 2.4 Z-Order-Level (`setAlwaysOnTop`)

**Entscheidung:**

- macOS: `floating` (unverändert).
- Windows/Linux: `normal`.

**Begründung:** `normal` ist der geringste topmost-Level, der das Fenster über normalen Anwendungen hält, ohne über Vollbild-Apps oder System-UI zu schweben. Der Review forderte einen empirischen Test auf echter Windows-Hardware. Dieser Agent kann keinen solchen Test durchführen. Daher wurde `normal` als konservative Startwahl implementiert und im Code kommentiert. Falls auf echter Hardware `normal` unter der Taskleiste liegt, ist der dokumentierte Fallback `'pop-up-menu'` (höherer Level, aber möglicherweise störend über Vollbild-Apps).

### 2.5 Deduplizierung von WorkArea-Änderungen

**Entscheidung:** `main.ts` speichert `lastWorkArea` und ruft `fitWindowToWorkArea` + `webContents.send` nur auf, wenn sich mindestens eines der Felder `x/y/width/height` geändert hat. Das vermeidet unnötige `setBounds`-Aufrufe bei DPI-/Scaling-Änderungen, die die Work-Area nicht verändern.

### 2.6 Keine neuen Dependencies

Es wurden keine neuen npm-Packages hinzugefügt. Alle Änderungen verwenden bestehende Electron-/Node-APIs.

---

## 3. Testergebnisse

| Befehl | Ergebnis |
|--------|----------|
| `npm run typecheck` | ✅ grün |
| `npm run lint` | ✅ grün |
| `npm test` | ✅ 312 passed, 6 skipped |
| `npm run build` | ✅ grün |
| `npx electron-builder --win --publish never` | ✅ grün |

Neue Testabdeckung:

- `src/main/overlay-adapter.test.ts`: 14 Tests
- `src/main/preload.test.ts`: 3 Tests
- `src/main/tray.test.ts`: +3 Tests für `loadTrayIcon`

Bestehende Tests sind unverändert grün geblieben.

---

## 4. Manuelle Smoke-Tests

Dieser Agent kann keine GUI-basierten Tests durchführen. Folgende Checks müssen auf echter Windows-Hardware verifiziert werden:

1. **Z-Order:** Biber bleibt über der sichtbaren Taskleiste (`setAlwaysOnTop(true, 'normal')`). Falls nicht, Fallback auf `'pop-up-menu'` testen.
2. **Taskleisten-Position:** Leiste nach oben/links/rechts verschieben; Biber bleibt innerhalb der Work-Area.
3. **Auto-Hide:** Biber kann kurzzeitig von der eingeblendeten Leiste verdeckt werden — dokumentiertes Verhalten.
4. **Tray-Icon:** Farbiges `assets/tray-icon.png` sichtbar; Rechtsklick-Menü funktioniert.
5. **Klick-Through:** Mausklicks gehen weiterhin durch das Overlay.
6. **Vollbild-App:** Biber bleibt sichtbar, stiehlt keinen Fokus.

---

## 5. Offene Probleme / Follow-up

- **Z-Order-Validierung:** Empirischer Test auf Windows 10/11 erforderlich, um `'normal'` vs. `'pop-up-menu'` endgültig zu entscheiden.
- **Auto-Hide:** Eine robuste Lösung würde die Windows AppBar-API (`SHAppBarMessage`) benötigen. Dies wurde bewusst nicht umgesetzt, da es native Dependencies erfordert.
- **Tray-Icon-Kontrast:** Farbiges Icon auf dunklem Windows-Tray-Hintergrund wurde nicht visuell geprüft. Phase 4 (BL-WIN-10/HiDPI) sollte ein Design-Gate vorsehen.
- **Multi-Monitor:** Aktuell nur primäres Display (`screen.getPrimaryDisplay()`). Spätere Phase könnte Display-Wechsel behandeln.
- **HiDPI/Scaling:** Nicht Teil dieser Phase; geplant für Phase 4.

---

## 6. Dateien, die angefasst wurden

| Datei | Änderung |
|-------|----------|
| `src/main/overlay-adapter.ts` | neu |
| `src/main/overlay-adapter.test.ts` | neu |
| `src/main/preload.test.ts` | neu |
| `src/main/main.ts` | Overlay-Adapter-Integration, Bounds-IPC, Smoke-Test-Erweiterung |
| `src/main/ipc-channels.ts` | `BOUNDS_CHANGED_CHANNEL` |
| `src/main/preload.ts` | `onBoundsChanged` expose |
| `src/renderer/renderer.ts` | Bounds-Change-Handler, Canvas-Resize aus IPC |
| `src/renderer/roam.ts` | `clampRoamStateToBounds` |
| `src/main/tray.ts` | plattformspezifische Icon-Auswahl |
| `src/main/tray.test.ts` | Tests für `loadTrayIcon` |
| `.flightplan/Archive/phase-2-implementation-log.md` | neu (dieses Log) |
