# Beaver Buddy — Phase 2: Core Windows Experience

**Status:** Plan / Nicht begonnen  
**Build-Items:** BL-WIN-3, BL-WIN-4  
**Ziel:** Overlay und Tray verhalten sich auf Windows nativ; der Biber bleibt immer sichtbar und wird nie von der Taskleiste verdeckt.

---

## 1. Zusammenfassung der Phase

Phase 1 hat Build, Packaging und CI für Windows stabilisiert. Phase 2 konzentriert sich auf die beiden sichtbaren Haupt-Blocker:

1. **BL-WIN-3 Overlay-Adapter für Windows**  
   Das Overlay-Fenster darf auf Windows nicht hinter die Taskleiste rutschen. Dafür müssen `setAlwaysOnTop`-Level, Fenstergröße/-position und die Roaming-Bounds plattformspezifisch behandelt werden. Die verfügbare Arbeitsfläche (`screen.getPrimaryDisplay().workArea`) ersetzt die rohe Bildschirmauflösung als Bezugsgröße für Bewegung, Kletterverhalten und Hatch-Positionierung.

2. **BL-WIN-4 Tray-Adapter für Windows**  
   Unter Windows muss das farbige `assets/tray-icon.png` geladen werden. `setTemplateImage` ist nur auf macOS erlaubt. Das Menü selbst bleibt unverändert.

Beide Items sind kleine, isolierte Adapter-Änderungen. Sie führen keine neuen Dependencies ein, ändern keine Renderer-Animationslogik und lassen die bestehenden Unit-Tests unberührt.

---

## 2. Abhängigkeiten

| Build-Item | Benötigt von | Begründung |
|------------|--------------|------------|
| BL-WIN-3   | —            | Kann unabhängig umgesetzt werden. |
| BL-WIN-4   | BL-WIN-2     | Das farbige `assets/tray-icon.png` wurde in Phase 1 (BL-WIN-2) erzeugt. |
| Phase 2    | Phase 1      | Build/Packaging/CI müssen bereits auf Windows laufen. |

**Reihenfolge innerhalb Phase 2:**
1. BL-WIN-3 umsetzen.
2. BL-WIN-4 umsetzen (kurz, da Asset vorhanden).
3. Gesamt-Build + Tests laufen lassen.
4. Manuelle Smoke-Tests auf Windows durchführen.

---

## 3. BL-WIN-3: Overlay-Adapter für Windows

### 3.1 Problemstellung

In `src/main/main.ts` steht aktuell:

```ts
win.setAlwaysOnTop(true, 'floating');
```

Auf macOS hält `'floating'` das Fenster korrekt über normalen Apps. Auf Windows landet ein Fenster mit diesem Level aber **unter der Taskleiste**, wenn es an den unteren Rand positioniert wird. Zusätzlich orientieren sich Roaming-Bounds momentan an der Fenstergröße, was zufällig der `workArea` entspricht, solange sich die Taskleiste nicht ändert. Es gibt aber keine Reaktion auf Taskleisten-Änderungen (Position, Auto-Hide, Größe) und keine explizite Sicherstellung, dass der Biber immer innerhalb der `workArea` bleibt.

### 3.2 Lösungsansatz

Kleiner plattformspezifischer Adapter, der die folgenden drei Aufgaben übernimmt:

1. `setAlwaysOnTop`-Level je nach Plattform wählen.
2. Verfügbare Arbeitsfläche (`workArea`) liefern und Änderungen beobachten.
3. Overlay-Fenster bei Änderungen sanft neu ausrichten.

### 3.3 Neue Datei: `src/main/overlay-adapter.ts`

```ts
import { BrowserWindow, screen, type Display } from 'electron';

export type TaskbarEdge = 'top' | 'bottom' | 'left' | 'right' | 'none';

export interface WorkAreaInfo {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly taskbarEdge: TaskbarEdge;
}

function detectTaskbarEdge(bounds: Electron.Rectangle, workArea: Electron.Rectangle): TaskbarEdge {
  if (workArea.y > bounds.y) return 'top';
  if (workArea.x > bounds.x) return 'left';
  if (workArea.x + workArea.width < bounds.x + bounds.width) return 'right';
  if (workArea.y + workArea.height < bounds.y + bounds.height) return 'bottom';
  return 'none';
}

function toWorkAreaInfo(display: Display): WorkAreaInfo {
  return {
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workArea.width,
    height: display.workArea.height,
    taskbarEdge: detectTaskbarEdge(display.bounds, display.workArea),
  };
}

export function getPrimaryWorkAreaInfo(): WorkAreaInfo {
  return toWorkAreaInfo(screen.getPrimaryDisplay());
}

export function configureAlwaysOnTop(win: BrowserWindow): void {
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
  } else {
    // 'normal' reicht auf Windows, um über normalen Fenstern zu bleiben,
    // ohne in die Screensaver-Ebene zu greifen.
    // 'pop-up-menu' ist der Fallback, falls 'normal' unter bestimmten
    // Taskleisten-Konstellationen versagt.
    win.setAlwaysOnTop(true, 'normal');
  }
}

export function fitWindowToWorkArea(win: BrowserWindow, info: WorkAreaInfo): void {
  win.setBounds({
    x: info.x,
    y: info.y,
    width: info.width,
    height: info.height,
  }, true); // true = animate, sanfte Verschiebung bei Änderungen
}

export function onWorkAreaChanged(callback: (info: WorkAreaInfo) => void): () => void {
  const handler = () => callback(getPrimaryWorkAreaInfo());
  screen.on('display-added', handler);
  screen.on('display-removed', handler);
  screen.on('display-metrics-changed', handler);
  return () => {
    screen.off('display-added', handler);
    screen.off('display-removed', handler);
    screen.off('display-metrics-changed', handler);
  };
}
```

**Begründung für `normal` vs. `pop-up-menu`:**  
Der Hauptplan nennt beide Optionen. Wir starten mit `'normal'`, weil es dem macOS-Verhalten am nächsten kommt (über normalen Fenstern, aber nicht über allem). Falls Tests zeigen, dass die Taskleiste den Biber bei Auto-Hide trotzdem verdeckt, wird auf `'pop-up-menu'` umgestellt. Diese Entscheidung wird im Code kommentiert und in der Akzeptanz dokumentiert.

### 3.4 Änderungen in `src/main/main.ts`

#### Schritt 1: Adapter importieren

```ts
import { configureAlwaysOnTop, fitWindowToWorkArea, getPrimaryWorkAreaInfo, onWorkAreaChanged } from './overlay-adapter';
```

#### Schritt 2: `createWindow()` anpassen

Ersetzen:

```ts
win.setAlwaysOnTop(true, 'floating');
```

durch:

```ts
configureAlwaysOnTop(win);
```

Der Rest der Fensterkonstruktion bleibt unverändert (`skipTaskbar: true`, `focusable: false`, `transparent: true`, `frame: false`, etc.).

#### Schritt 3: WorkArea-Änderungen beobachten

Nach `mainWindow = createWindow();` in `app.whenReady()`:

```ts
mainWindow = createWindow();

let workAreaInfo = getPrimaryWorkAreaInfo();
fitWindowToWorkArea(mainWindow, workAreaInfo);

const unsubscribeWorkArea = onWorkAreaChanged((next) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  workAreaInfo = next;
  fitWindowToWorkArea(mainWindow, next);
  // Renderer über neue verfügbare Fläche informieren
  mainWindow.webContents.send(BOUNDS_CHANGED_CHANNEL, {
    width: next.width,
    height: next.height,
  });
});

mainWindow.on('closed', () => {
  unsubscribeWorkArea();
});
```

> **Hinweis:** `fitWindowToWorkArea` mit `animate: true` sorgt dafür, dass der Biber bei einer Taskleisten-Vergrößerung sanft in die neue Fläche zurückwandert, statt abgeschnitten zu werden.

### 3.5 Änderungen in `src/renderer/renderer.ts`

Der Renderer nutzt aktuell `window.innerWidth`/`window.innerHeight` als Roaming-Bounds. Das ist weiterhin korrekt, solange das Hauptfenster exakt auf `workArea` skaliert. Bei Änderungen der `workArea` muss aber die Canvas-Größe neu gesetzt und der Roaming-Zustand an die neuen Bounds angeglichen werden.

#### Schritt 1: IPC-Handler in `src/main/preload.ts` erweitern

Neuer Kanal in `src/main/ipc-channels.ts`:

```ts
export const BOUNDS_CHANGED_CHANNEL = 'state:bounds';
```

Neuer Eintrag in `src/main/preload.ts` (inkl. Inline-Literal, da preload keine Sibling-Module importieren kann):

```ts
const BOUNDS_CHANGED_CHANNEL = 'state:bounds'; // must match src/main/ipc-channels.ts

contextBridge.exposeInMainWorld('beaverBuddy', {
  // ... bestehende Handler
  onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void): void => {
    ipcRenderer.on(BOUNDS_CHANGED_CHANNEL, (_event, bounds) => callback(bounds));
  },
});
```

#### Schritt 2: Renderer-Handler ergänzen

In `src/renderer/renderer.ts`:

```ts
function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  needsDraw = true;
}

window.addEventListener('resize', resizeCanvas);

window.beaverBuddy.onBoundsChanged((next) => {
  // Fenstergröße wurde vom Main-Prozess angepasst; innerWidth/innerHeight
  // sollten bereits next entsprechen, aber wir setzen Canvas explizit.
  resizeCanvas();
  // Sicherstellen, dass der Biber innerhalb der neuen Fläche bleibt.
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

#### Schritt 3: Hilfsfunktion `clampRoamStateToBounds`

In `src/renderer/renderer.ts` oder `src/renderer/roam.ts`:

```ts
function clampRoamStateToBounds(state: RoamState, b: Bounds): RoamState {
  const maxX = Math.max(0, b.width - BEAVER_TILE_PX * PET_SCALE);
  const ground = Math.max(0, b.height - BEAVER_TILE_PX * PET_SCALE);
  return {
    ...state,
    x: Math.min(Math.max(state.x, 0), maxX),
    y: Math.min(state.y, ground),
    targetX: Math.min(Math.max(state.targetX, 0), maxX),
    climbTargetY: Math.min(state.climbTargetY, ground),
  };
}
```

**Alternative:** Falls `roam.ts` diese Logik aufnehmen soll (reiner State), kann `clampRoamStateToBounds` in `roam.ts` als Export leben und in `renderer.ts` importiert werden. Das vermeidet Duplikation mit `maxX`/`groundY`.

### 3.6 Tests

`src/main/overlay-adapter.ts` ist isoliert von Electron-UI-APIs testbar:

- `detectTaskbarEdge` für alle vier Kanten + Auto-Hide (simuliert durch unterschiedliche bounds/workArea).
- `configureAlwaysOnTop` ist rein pass-through; ein Unit-Test mit Mock-`BrowserWindow` prüft, dass auf `win32` `'normal'` und auf `darwin` `'floating'` verwendet wird.
- `onWorkAreaChanged` registriert/deregistriert die drei `screen`-Events korrekt.

**Bestehende Tests bleiben grün:**

- `roam.test.ts` ändert sich nicht.
- `tray.test.ts` ändert sich nicht.
- Keine neuen Dependencies.

---

## 4. BL-WIN-4: Tray-Adapter für Windows

### 4.1 Problemstellung

In `src/main/tray.ts`:

```ts
const iconPath = path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png');
const icon = nativeImage.createFromPath(iconPath);
icon.setTemplateImage(true);
```

- `tray-iconTemplate.png` ist für macOS gedacht und wird dort als Template-Image gerendert.
- `setTemplateImage(true)` hat auf Windows keine Wirkung bzw. kann zu einem unsichtbaren/falschen Icon führen.
- In Phase 1 wurde `assets/tray-icon.png` (farbig) erzeugt.

### 4.2 Lösungsansatz

Plattformspezifische Icon-Auswahl und Template-Image-Flag.

### 4.3 Änderungen in `src/main/tray.ts`

Ersetzen der hartkodierten Zeilen durch:

```ts
const iconFileName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
const iconPath = path.join(app.getAppPath(), 'assets', iconFileName);
const icon = nativeImage.createFromPath(iconPath);
if (process.platform === 'darwin') {
  icon.setTemplateImage(true);
}
```

Alternativ kann eine kleine Hilfsfunktion `loadTrayIcon()` die Logik kapseln:

```ts
function loadTrayIcon(): NativeImage {
  const iconFileName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', iconFileName));
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}
```

### 4.4 Tests

`tray.test.ts` testet ausschließlich `buildMenuTemplate` und `formatPetLabel`. Die Icon-Ladung ist nicht gecovert, daher bleiben die Tests grün.

Optional kann ein neuer Test für `loadTrayIcon` hinzugefügt werden, der auf `process.platform` mockt und prüft, ob der richtige Dateiname gewählt und `setTemplateImage` nur auf `darwin` aufgerufen wird. Das ist aber nicht zwingend erforderlich.

---

## 5. Akzeptanzkriterien für die gesamte Phase

### BL-WIN-3

- [ ] Auf Windows startet das Overlay-Fenster mit `setAlwaysOnTop(true, 'normal')` (oder `'pop-up-menu'`, falls validiert).
- [ ] Auf macOS bleibt `setAlwaysOnTop(true, 'floating')` erhalten.
- [ ] Das Fenster wird exakt auf `screen.getPrimaryDisplay().workArea` ausgerichtet.
- [ ] Bei Änderung der Taskleisten-Position, -Größe oder des Auto-Hide-Zustands wird `workArea` neu berechnet und das Fenster sanft angepasst.
- [ ] Der Biber bleibt immer innerhalb der verfügbaren Arbeitsfläche; er verschwindet nicht hinter der Taskleiste.
- [ ] `skipTaskbar: true`, `focusable: false`, `transparent: true` bleiben erhalten.
- [ ] Klick-Through funktioniert weiterhin (`setIgnoreMouseEvents(true)`).
- [ ] Kein Fokus-Diebstahl durch das Overlay.

### BL-WIN-4

- [ ] Unter Windows wird `assets/tray-icon.png` als farbiges Tray-Icon angezeigt.
- [ ] Unter macOS bleibt `assets/tray-iconTemplate.png` mit `setTemplateImage(true)` unverändert.
- [ ] Das Tray-Kontextmenü öffnet sich und alle Einträge funktionieren.

### Gesamtphase

- [ ] `npm run build` läuft auf Windows und macOS durch.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` sind grün.
- [ ] `npx electron-builder --win --publish never` erzeugt weiterhin funktionierende Installer.
- [ ] Manuelle Smoke-Tests auf Windows bestätigen: Biber sichtbar, Tray-Menü funktioniert, Taskleisten-Änderungen werden überlebt.

---

## 6. Risiken und Mitigationen

| Risiko | Auswirkung | Wahrscheinlichkeit | Mitigation |
|--------|------------|--------------------|------------|
| `'normal'` reicht nicht, um über Auto-Hide-Taskleiste zu bleiben | Biber wird kurzzeitig verdeckt | Mittel | Fallback auf `'pop-up-menu'` dokumentieren und in Akzeptanztest prüfen. |
| `screen`-Events feuern nicht bei jeder Taskleisten-Änderung | Biber bleibt außerhalb der neuen workArea | Niedrig | Zusätzlich `resize`-Event auf `BrowserWindow` oder periodische Prüfung in Betracht ziehen (nur falls empirisch nötig). |
| `fitWindowToWorkArea` mit Animation erzeugt kurzen visuellen Sprung | Biber „ruckelt" bei Taskleisten-Änderung | Niedrig | Animation kann auf `false` gesetzt werden, falls störend. |
| Renderer empfängt `state:bounds` vor `did-finish-load` | Message geht verloren | Niedrig | Initialer Bounds-Request erst nach `did-finish-load` senden, oder Renderer ignoriert frühe Events. |
| Farbiges Tray-Icon auf Windows ist bei dunklem Taskleisten-Hintergrund schlecht sichtbar | Schlechte UX | Mittel | In Phase 4 (BL-WIN-10/HiDPI) Design-Gate für kontrastreiches Icon einplanen. |
| `nativeImage.createFromPath` bei fehlendem `tray-icon.png` wirft nicht sofort, aber das Icon ist leer | Leeres Tray-Icon | Niedrig | Build-Script/CI prüft Existenz der Asset-Dateien; manueller Smoke-Test. |

---

## 7. Test- und Verifikationsschritte

### 7.1 Automatisierte Tests (lokal + CI)

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx electron-builder --win --publish never
```

Erwartetes Ergebnis:

- TypeScript ohne Fehler.
- ESLint ohne Fehler.
- Alle bestehenden Tests grün.
- Build-Ausgabe in `dist/` und `release/` vorhanden.

### 7.2 Neue Unit-Tests

- `src/main/overlay-adapter.test.ts`:
  - `detectTaskbarEdge` für top/bottom/left/right/none.
  - `configureAlwaysOnTop` wählt korrekten Level für `win32` und `darwin`.
  - `onWorkAreaChanged` subscribed/unsubscribed die drei Events.

- (Optional) `src/main/tray.test.ts` erweitern:
  - Mock für `process.platform` und Prüfung des gewählten Icon-Namens.

### 7.3 Manuelle Smoke-Tests auf Windows

1. **App starten:**
   ```bash
   npm start
   ```
2. **Sichtbarkeit prüfen:** Biber läuft am unteren Rand, ist über der Taskleiste sichtbar.
3. **Taskleiste verschieben:** Rechtsklick Taskleiste → Taskleisteneinstellungen → Position ändern (oben/links/rechts). Biber bleibt sichtbar und innerhalb der workArea.
4. **Auto-Hide aktivieren:** Taskleiste automatisch ausblenden. Biber bleibt sichtbar, auch wenn die Taskleiste eingeblendet wird.
5. **Vollbild-App:** Editor/Browser im Vollbildmodus. Biber sollte weiterhin sichtbar sein (kein Fokus-Diebstahl, aber Overlay bleibt oben).
6. **Klick-Through:** Mausklicks auf den Biber gehen an die darunter liegende Anwendung durch.
7. **Task-Manager:** Kein Eintrag in der Windows-Taskleiste (`skipTaskbar: true`).
8. **Tray:** Farbiges Icon sichtbar, Rechtsklick öffnet Menü, Pause/Resume/Quit funktionieren.

### 7.4 Manuelle Regression auf macOS

1. App starten.
2. Biber bleibt über der Dock-Menüleiste.
3. Tray-Icon ist ein Template-Image und passt sich dem Dunkel-/Hellmodus an.
4. Menü funktioniert wie bisher.

---

## 8. Dateien, die angefasst werden

| Datei | Änderung | Build-Item |
|-------|----------|------------|
| `src/main/overlay-adapter.ts` | Neu: Plattform-Adapter für AlwaysOnTop, WorkArea, Taskleisten-Kante | BL-WIN-3 |
| `src/main/main.ts` | Import Adapter, `configureAlwaysOnTop` statt `'floating'`, WorkArea-Change-Handler | BL-WIN-3 |
| `src/main/ipc-channels.ts` | Neuer Kanal `state:bounds` | BL-WIN-3 |
| `src/main/preload.ts` | `onBoundsChanged` expose | BL-WIN-3 |
| `src/renderer/renderer.ts` | Bounds-Change-Handler, Canvas-Resize, Clamp-RoamState | BL-WIN-3 |
| `src/main/overlay-adapter.test.ts` | Neue Tests | BL-WIN-3 |
| `src/main/tray.ts` | Plattformspezifische Icon-Auswahl + Template-Image nur auf macOS | BL-WIN-4 |
| `src/main/tray.test.ts` | Optional: Test für Icon-Ladung | BL-WIN-4 |

**Nicht angefasst werden:**

- `src/renderer/roam.ts` (reiner State, keine plattformspezifische Logik).
- `src/main/usage/paths.ts` (Thema von Phase 3 / BL-WIN-5).
- `src/main/mrr/keychain.ts` (verschoben auf BL-WIN-6).
- `package.json`, `electron-builder.yml` (Phase 1 abgeschlossen).

---

## 9. Offene Punkte / Follow-up

- **Z-Order-Fallback:** Falls `'normal'` unter Windows nicht ausreicht, muss `'pop-up-menu'` getestet und ggf. dokumentiert werden.
- **Multi-Monitor:** Aktuell nur `screen.getPrimaryDisplay()`. Spätere Phase könnte den Biber bei Display-Wechseln auf den neuen primären Monitor migrieren.
- **HiDPI/Scaling:** Bleibt in Phase 4 (BL-WIN-8).
- **Tray-Icon-Design:** Farbiges Icon funktioniert vorerst; Design-Gate in Phase 4.

---

## 10. Zusammenfassung für das Team

Phase 2 ist ein schlanker, risikoarmer Schritt: Zwei plattformspezifische Adapter korrigieren das sichtbarste Windows-Verhalten (Overlay-Z-Order + Tray-Icon). Die Änderungen beschränken sich auf wenige Dateien im Main-Prozess, erfordern keine neuen Dependencies und lassen Renderer-Logik sowie Tests weitgehend unberührt. Nach der Umsetzung sollte der Biber auf Windows immer sichtbar bleiben und das farbige Tray-Icon korrekt angezeigt werden.
