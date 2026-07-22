# Kritischer Review: Phase 2 — Core Windows Experience

**Geprüfter Plan:** `.flightplan/Archive/phase-2-plan.md`  
**Hauptplan-Referenz:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md`, Abschnitt „Phase 2: Core Windows Experience"  
**Quelldateien:** `src/main/main.ts`, `src/main/tray.ts`, `src/renderer/roam.ts`, `src/main/ipc-channels.ts`, `src/main/preload.ts`, `src/renderer/renderer.ts`, `src/main/tray.test.ts`  
**Review-Datum:** 2026-07-15  
**Reviewer:** Kritischer Review-Agent

---

## 1. Zusammenfassung des geprüften Plans

Phase 2 adressiert die beiden sichtbarsten Windows-Blocker aus dem Hauptplan:

- **BL-WIN-3:** Einführung eines `src/main/overlay-adapter.ts`, der `setAlwaysOnTop`-Level, Taskleisten-Erkennung via `screen.getPrimaryDisplay().workArea` und Neuausrichtung des Overlay-Fensters bei Display-/Taskleisten-Änderungen kapselt. Der Adapter kommuniziert neue Bounds über den neuen IPC-Kanal `state:bounds` an den Renderer.
- **BL-WIN-4:** Plattformspezifische Icon-Auswahl in `src/main/tray.ts` — auf Windows wird `assets/tray-icon.png` geladen und `setTemplateImage` nur auf macOS aufgerufen.

Der Plan ist klein, fokussiert, führt keine neuen Dependencies ein und beschränkt sich weitgehend auf den Main-Prozess. Die grundsätzliche Architektur (Adapter-Modul, plattformspezifische Verzweigungen, manuelle Smoke-Tests) ist solide.

**Allerdings überschätzt der Plan die Robustheit der Taskleisten-Erkennung und unterschätzt die Synchronisation zwischen Main-Prozess und Renderer bei Fenster-Resizes.** Unter Windows führen Auto-Hide-Taskleisten und die asynchrone Natur von Electron-Fenster-Animationen zu konkreten Lücken, die vor der Umsetzung geschlossen werden sollten.

---

## 2. Gefundene Probleme / Lücken / Fehler

### 2.1 Auto-Hide-Taskleiste wird nicht erkannt — Plan suggeriert das Gegenteil

**Schweregrad:** Blocker

Der vorgeschlagene `detectTaskbarEdge` vergleicht `display.bounds` mit `display.workArea`. Bei einer **Auto-Hide-Taskleiste** ist `workArea` auf Windows in der Regel **identisch mit `bounds`**, solange die Leiste ausgeblendet ist. Wenn sie einblendet, reserviert sie zwar visuell Platz, ändert die `workArea` des Electron-Displays aber nicht zwangsläufig.

Das bedeutet:
- `detectTaskbarEdge` gibt bei Auto-Hide `'none'` zurück.
- Das Overlay-Fenster wird auf die volle Bildschirmgröße ausgerichtet.
- Der Biber kann hinter der eingeblendeten Taskleiste verschwinden — genau das Gegenteil von BL-WIN-3.

Der Plan schreibt im Akzeptanzkriterium: „Bei Änderung der Taskleisten-Position, -Größe oder des Auto-Hide-Zustands wird workArea neu berechnet und das Fenster sanft angepasst" und im Testplan: „detectTaskbarEdge für alle vier Kanten + Auto-Hide (simuliert durch unterschiedliche bounds/workArea)". Das ist irreführend: Unterschiedliche `bounds`/`workArea` simulieren eine **sichtbare** Taskleiste, nicht Auto-Hide.

**Referenz:** `src/main/overlay-adapter.ts` (geplant), Abschnitt 3.3; Akzeptanzkriterien Abschnitt 5.

---

### 2.2 `fitWindowToWorkArea` mit `animate: true` ist für transparente Overlays problematisch

**Schweregrad:** Hoch

Der Plan verwendet `win.setBounds({...}, true)` (animate: `true`), um das Fenster bei Taskleisten-Änderungen „sanft" zu verschieben. Das ist problematisch aus zwei Gründen:

1. **Asynchrone Renderer-Synchronisation:** Während das Fenster animiert skaliert, ändern sich `window.innerWidth`/`innerHeight` nicht atomar. Der Renderer bekommt das `resize`-Event und/oder die IPC-Nachricht `state:bounds` zu einem beliebigen Zeitpunkt der Animation. Der Plan behauptet: „Fenstergröße wurde vom Main-Prozess angepasst; innerWidth/innerHeight sollten bereits next entsprechen" — das ist eine ungültige Annahme.
2. **Artefakte bei transparentem Fenster:** Electron-Window-Animationen auf transparenten, klick-durch-Fenstern können auf Windows zu Flackern oder Ghosting führen, weil der Window-Manager das Fenster während der Animation neu composited.

**Referenz:** `src/main/overlay-adapter.ts` (geplant), Abschnitt 3.3; `src/renderer/renderer.ts` (geplant), Abschnitt 3.5.

---

### 2.3 `setAlwaysOnTop(true, 'normal')` ist unverifiziert und möglicherweise unzureichend

**Schweregrad:** Hoch

Die zentrale Design-Entscheidung von BL-WIN-3 ist, dass das Overlay über der Windows-Taskleiste bleibt. Der Plan setzt auf `setAlwaysOnTop(true, 'normal')` mit dem Fallback `'pop-up-menu'`. Das ist richtig gedacht, aber:

- Auf Windows wird durch `setAlwaysOnTop` das Fenster zu `HWND_TOPMOST`. Ob es über der Taskleiste (`Shell_TrayWnd`, ebenfalls topmost) liegt, hängt von der Aktivierungsreihenfolge und dem konkreten Level ab.
- `'normal'` ist laut Electron-Dokumentation ein gültiger Windows-Level, aber es gibt keine Garantie, dass er über der Taskleiste liegt.
- `'pop-up-menu'` liegt höher, kann aber dazu führen, dass das Overlay über Vollbild-Apps und sogar über dem Task-Manager bleibt — was laut Akzeptanzkriterium „Vollbild-App" gewünscht, aber in Spielen/Videos störend sein kann.

Der Plan behandelt das als „Mittel"-Risiko und akzeptiert manuelle Tests. Das ist akzeptabel, aber der Implementierungs-Agent muss **beide Level empirisch testen** und nicht einfach `normal` als fertige Lösung übernehmen.

**Referenz:** `src/main/overlay-adapter.ts` (geplant), `configureAlwaysOnTop`; Abschnitt 3.3; Risikotabelle Abschnitt 6.

---

### 2.4 Keine Deduplizierung von WorkArea-Änderungen

**Schweregrad:** Mittel

`onWorkAreaChanged` ruft bei jedem `display-added`, `display-removed` und `display-metrics-changed` sofort `fitWindowToWorkArea` auf. `display-metrics-changed` feuert jedoch auch bei DPI-/Scaling-Änderungen, die die `workArea` nicht verändern. Das führt zu unnötigen `setBounds`-Aufrufen und potenziellem Flackern.

**Empfohlene Korrektur:** Vorherige `workArea` speichern und nur bei tatsächlicher Änderung neu setzen.

**Referenz:** `src/main/overlay-adapter.ts` (geplant), `onWorkAreaChanged`.

---

### 2.5 Renderer empfängt initiale Bounds nicht explizit

**Schweregrad:** Mittel

Der Plan setzt die Canvas-Größe initial auf `window.innerWidth`/`window.innerHeight`. Das funktioniert, solange das Fenster beim Laden bereits seine finale Größe hat. Durch den geplanten `fitWindowToWorkArea`-Aufruf mit Animation nach `createWindow()` kann das Fenster aber noch animieren, wenn der Renderer `did-finish-load` erreicht. Dann stimmen `canvas.width/height` kurzzeitig nicht mit der tatsächlichen workArea überein.

**Referenz:** `src/main/main.ts` (geplant), Abschnitt 3.4; `src/renderer/renderer.ts` (geplant), Abschnitt 3.5.

---

### 2.6 Renderer-Handler mischt `window.innerWidth/Height` mit expliziten IPC-Bounds

**Schweregrad:** Mittel

Der geplante Handler:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  resizeCanvas(); // setzt canvas.width = window.innerWidth
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

- `resizeCanvas()` verwendet `window.innerWidth/Height`, ignoriert aber den expliziten `next`-Payload.
- Wenn `window.innerWidth/Height` noch nicht aktualisiert ist (siehe 2.2 und 2.5), wird die Canvas auf falsche Werte gesetzt.
- `clampRoamStateToBounds` wird nur einmal aufgerufen. Während der Biber in einem `walk` oder `climb` ist, kann er kurzzeitig außerhalb der neuen Bounds gezeichnet werden, bis `tick()` ihn zurückholt.

**Referenz:** `src/renderer/renderer.ts` (geplant), Abschnitt 3.5.

---

### 2.7 Keine automatisierten Tests für die Renderer-Integration

**Schweregrad:** Mittel

Der Plantestplan sieht Unit-Tests für `overlay-adapter.ts` vor, aber keine Tests für die Interaktion zwischen `main.ts` → IPC → `preload.ts` → `renderer.ts`. Genau diese Kette ist aber der riskante Teil von BL-WIN-3. Die Komplexität liegt nicht im reinen `detectTaskbarEdge`, sondern in der synchronen/asynchronen Interaktion zwischen Main-Prozess und Renderer.

**Referenz:** Abschnitt 7.2 des Plans.

---

### 2.8 Tray-Icon-Qualität auf Windows nicht geprüft

**Schweregrad:** Niedrig

Der Plan lädt `assets/tray-icon.png` auf Windows. Windows-Tray-Icons sollten typischerweise 16×16 px (bzw. 20×20/32×32 je nach DPI) sein. Ein großes PNG wird von Electron skaliert, was auf HiDPI-Displays unscharf wirken kann. Das ist zwar in Phase 4 (BL-WIN-10/HiDPI) vorgesehen, sollte aber im Testplan explizit als manueller Check vermerkt werden.

**Referenz:** `src/main/tray.ts` (geplant), Abschnitt 4.3; Risikotabelle Abschnitt 6.

---

### 2.9 Smoke-Test `--smoke` prüft nicht die WorkArea-Ausrichtung

**Schweregrad:** Niedrig

Der bestehende Smoke-Test in `src/main/main.ts` prüft `windowCreated`, `alwaysOnTop`, `ignoresMouse`, `transparent` und `paused`. Er könnte ohne großen Aufwand um `win.getBounds()` vs. `screen.getPrimaryDisplay().workArea` erweitert werden, um Regressionen bei der WorkArea-Ausrichtung automatisch zu erkennen.

**Referenz:** `src/main/main.ts:136-150`; Testplan Abschnitt 7.1/7.3.

---

### 2.10 Redundanter erster `fitWindowToWorkArea`-Aufruf

**Schweregrad:** Niedrig

`createWindow()` in `src/main/main.ts` erstellt das Fenster bereits mit `x/y/width/height = workArea` (Zeilen 95-101). Der Plan fügt danach nochmals `fitWindowToWorkArea(mainWindow, workAreaInfo)` hinzu. Das ist redundant und sollte entweder entfallen oder durch einen Kommentar erklärt werden. Wenn `fitWindowToWorkArea` animiert, entsteht hier ein unnötiger Animationsschritt mit Größe 0.

**Referenz:** `src/main/main.ts` (geplant), Abschnitt 3.4.

---

## 3. Konkrete Verbesserungsvorschläge

### 3.1 Auto-Hide korrekt behandeln

**Dateien:** `src/main/overlay-adapter.ts`, `WINDOWS_PORT_PLAN.md`

- **Option A (empfohlen):** Dokumentieren, dass `workArea/bounds` Auto-Hide **nicht** zuverlässig erkennt. Akzeptanzkriterium anpassen: „Der Biber bleibt bei sichtbarer Taskleiste sichtbar; bei Auto-Hide kann er kurzzeitig von der eingeblendeten Leiste verdeckt werden, sofern keine native AppBar-API verwendet wird."
- **Option B:** Windows-AppBar-API (z. B. `SHAppBarMessage`) über einen kleinen native Node-Addon oder `node-ffi-napi` aufrufen. Das würde aber eine native Dependency erfordern und verstößt gegen das CLAUDE.md-Prinzip, keine neuen Dependencies einzuführen. Daher nur empfehlenswert, wenn Auto-Hide als harter Anforderung gilt.
- **Option C (Kompromiss):** Bei unklarer Taskleisten-Kante einen kleinen Sicherheitsabstand (z. B. 8 px) vom jeweiligen Bildschirmrand einhalten, bis die Kante eindeutig ist.

### 3.2 `fitWindowToWorkArea` ohne Animation verwenden

**Datei:** `src/main/overlay-adapter.ts`

```ts
export function fitWindowToWorkArea(win: BrowserWindow, info: WorkAreaInfo): void {
  win.setBounds({ x: info.x, y: info.y, width: info.width, height: info.height }, false);
}
```

Stattdessen die „Sanftheit" im Renderer erreichen: Wenn die Bounds kleiner werden, setzt der Renderer das nächste Roaming-Ziel (`targetX`, ggf. `climbTargetY`) so, dass der Biber selbst in die neue Fläche läuft. Das vermeidet Fenster-Animationen und hält die Pixel-Art integer.

### 3.3 Renderer verwendet explizite IPC-Bounds, nicht `window.innerWidth/Height`

**Dateien:** `src/main/preload.ts`, `src/renderer/renderer.ts`

```ts
// preload.ts
onBoundsChanged: (callback: (bounds: { width: number; height: number }) => void): void => {
  ipcRenderer.on(BOUNDS_CHANGED_CHANNEL, (_event, bounds) => callback(bounds));
},

// renderer.ts
window.beaverBuddy.onBoundsChanged((next) => {
  canvas.width = next.width;
  canvas.height = next.height;
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

Damit entfällt die unsichere Annahme, dass `window.innerWidth/Height` bereits aktualisiert ist.

### 3.4 Deduplizierung der WorkArea-Änderungen

**Datei:** `src/main/main.ts`

```ts
let lastWorkArea = getPrimaryWorkAreaInfo();
fitWindowToWorkArea(mainWindow, lastWorkArea);

const unsubscribeWorkArea = onWorkAreaChanged((next) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (
    next.x === lastWorkArea.x &&
    next.y === lastWorkArea.y &&
    next.width === lastWorkArea.width &&
    next.height === lastWorkArea.height
  ) {
    return;
  }
  lastWorkArea = next;
  fitWindowToWorkArea(mainWindow, next);
  mainWindow.webContents.send(BOUNDS_CHANGED_CHANNEL, {
    width: next.width,
    height: next.height,
  });
});
```

### 3.5 Z-Order-Level empirisch ermitteln und dokumentieren

**Datei:** `src/main/overlay-adapter.ts`

- `configureAlwaysOnTop` sollte leicht austauschbar sein (Konstante oder Parameter).
- Der Implementierungs-Agent muss auf echter Windows-Hardware testen:
  1. `'normal'` — Taskleiste sichtbar + Auto-Hide.
  2. `'pop-up-menu'` — falls `'normal'` versagt.
- Ergebnis in Code-Kommentar und Plan dokumentieren. Akzeptanzkriterium erweitern: „Für den finalen Level existiert ein dokumentierter Smoke-Test auf Windows 10/11."

### 3.6 `clampRoamStateToBounds` in `roam.ts` integrieren

**Datei:** `src/renderer/roam.ts`

Da `roam.ts` bereits `maxX(bounds)` und `groundY(bounds)` berechnet, sollte `clampRoamStateToBounds` dort als Export leben und die bestehenden Hilfsfunktionen wiederverwenden:

```ts
export function clampRoamStateToBounds(state: RoamState, bounds: Bounds): RoamState {
  const max = maxX(bounds);
  const ground = groundY(bounds);
  return {
    ...state,
    x: clamp(state.x, 0, max),
    y: Math.min(state.y, ground),
    targetX: clamp(state.targetX, 0, max),
    climbTargetY: Math.min(state.climbTargetY, ground),
  };
}
```

Vermeidet Duplikation der `BEAVER_TILE_PX * PET_SCALE`-Berechnung.

### 3.7 Smoke-Test um WorkArea-Prüfung erweitern

**Datei:** `src/main/main.ts`

```ts
const result = {
  windowCreated: !win.isDestroyed(),
  alwaysOnTop: win.isAlwaysOnTop(),
  ignoresMouse: ignoresMouseEvents,
  transparent: true,
  paused: isPaused(pauseState),
  boundsMatchWorkArea: (() => {
    const wb = win.getBounds();
    const wa = screen.getPrimaryDisplay().workArea;
    return wb.x === wa.x && wb.y === wa.y && wb.width === wa.width && wb.height === wa.height;
  })(),
};
```

### 3.8 Testplan um Renderer-Integration erweitern

**Datei:** `.flightplan/Archive/phase-2-plan.md`

- Explizit vermerken, dass `renderer.ts`/`preload.ts` nicht ohne laufenden Electron-Prozess unit-getestet werden können.
- Mindestens einen manuellen Test definieren, der nachweist, dass `state:bounds` im Renderer ankommt und die Canvas-Größe korrekt aktualisiert wird (z. B. durch DevTools-Logging oder `--debug-bounds`-Flag).

---

## 4. GO / NO-GO Empfehlung

**Empfehlung: GO — mit kritischen Vorbedingungen**

Phase 2 ist prinzipiell sinnvoll und umsetzbar. Die grundsätzliche Richtung (Adapter-Modul, plattformspezifische Verzweigungen, minimale Eingriffe) stimmt. Allerdings darf der Implementierungs-Agent die in Abschnitt 2 genannten Probleme nicht ignorieren.

**Vorbedingungen für GO:**

1. **Auto-Hide-Realität klären:** Entweder Auto-Hide aus dem Akzeptanzkriterium entfernen **oder** eine konkrete Lösung (AppBar-API, Sicherheitsabstand) planen. Der aktuelle Plan suggeriert eine Robustheit, die der Algorithmus nicht bietet.
2. **Animation aus `fitWindowToWorkArea` entfernen:** Verwenden Sie `setBounds(..., false)` und verschieben Sie die Bewegungssanftheit in den Renderer/Roaming-Code.
3. **Renderer verwendet explizite IPC-Bounds:** Keine Annahmen über `window.innerWidth/Height` während eines Resizes.
4. **Z-Order-Level empirisch testen:** Dokumentieren Sie, warum `'normal'` oder `'pop-up-menu'` gewählt wurde, auf Basis echter Windows-Tests.
5. **Deduplizierung einbauen:** `setBounds` nur aufrufen, wenn sich `workArea` tatsächlich geändert hat.

Wenn diese Vorbedingungen erfüllt werden, ist Phase 2 ein risikoarmer, gut reviewbarer Schritt.

---

## 5. Wichtige Hinweise für den Implementierungs-Agenten

1. **Testen Sie auf echter Windows-Hardware (nicht nur CI).** Die Z-Order- und Taskleisten-Erkennung sind stark vom konkreten Windows-Build, DPI-Einstellungen und Taskleisten-Konfiguration abhängig. Insbesondere Auto-Hide und Taskleisten an linken/rechten/oberen Kanten müssen manuell geprüft werden.

2. **Vermeiden Sie `setBounds` mit Animation auf transparenten Overlays.** Das führt zu Flackern und Asynchronität. Setzen Sie Bounds sofort und lassen Sie den Biber selbst in die neue Fläche laufen.

3. **Halten Sie den IPC-Kanal `state:bounds` eng gekoppelt an die tatsächliche Fenstergröße.** Senden Sie die Bounds nicht nur bei `display-*`-Events, sondern stellen Sie sicher, dass der Renderer initial und bei jedem tatsächlichen Resize die korrekten Werte erhält.

4. **Prüfen Sie `tray-icon.png` visuell im Windows-Tray.** Dunkle Taskleisten können ein farbiges Icon verschlucken. Notieren Sie, falls ein kontrastreicheres Icon für Phase 4 nötig ist.

5. **Lassen Sie `src/renderer/roam.ts` frei von Plattform-Logik.** Bewegen Sie `clampRoamStateToBounds` als reinen State-Helfer nach `roam.ts`, aber führen Sie keine `process.platform`-Abfragen im Renderer ein.

6. **Erweitern Sie den Smoke-Test um `boundsMatchWorkArea`.** Das ist ein günstiger automatisierter Regressionsschutz für die zentrale Behauptung von BL-WIN-3.

7. **Achten Sie auf `win.setIgnoreMouseEvents(true)`.** Das wird nur in `createWindow()` gesetzt und muss nach einem `setBounds` nicht neu gesetzt werden — verifizieren Sie das aber in den Smoke-Tests.

8. **Keine neuen Dependencies ohne separate Abstimmung.** Der Plan hält sich an CLAUDE.md. Wenn Auto-Hide eine native AppBar-API erfordert, muss das explizit mit dem Projektleiter abgestimmt werden.

---

## 6. Datei-Assets geprüft

- `assets/tray-icon.png`: Vorhanden ✅
- `assets/tray-iconTemplate.png`: Vorhanden ✅
- `assets/icon.ico`: Vorhanden ✅

Die in BL-WIN-2 erzeugten Assets existieren, sodass BL-WIN-4 nicht durch fehlende Dateien blockiert ist.
