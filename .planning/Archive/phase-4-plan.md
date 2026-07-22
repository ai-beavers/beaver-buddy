# Beaver Buddy — Phase 4: Polish & Release-Readiness

**Status:** Planungsdokument (keine Source-Änderungen enthalten).  
**Build-Items:** BL-WIN-8, BL-WIN-10  
**Ziel:** Visuelle Qualität auf Windows-HiDPI-Displays sicherstellen, Icons und Dokumentation für einen Release-Ready-Zustand bringen, Design-Gate für Windows abgeschlossen.

---

## 1. Zusammenfassung der Phase

Phase 4 ist die letzte Umsetzungsphase vor den zurückgestellten Folgeaufgaben (BL-WIN-6, BL-WIN-7, Codex-Tracking). Sie behandelt zwei Build-Items:

1. **BL-WIN-8 — Renderer HiDPI / Scaling (optional):** Der transparente Canvas-Overlay soll auf Windows-Displays mit 125 %/150 %/200 %-Skalierung scharf bleiben, ohne dass die Pixel-Art durch bilineare Skalierung verschwimmt.
2. **BL-WIN-10 — Dokumentation & Design-Gate:** README, PRD und CLAUDE.md werden auf den aktuellen Windows-Status geprüft und ergänzt. Ein visuelles Design-Gate bewertet Windows-Tray-Icon, Anwendungs-Icon und HiDPI-Rendering; Screenshots und Verdict landen in `docs/design-reviews/`.

Die Phase führt **keine neuen Features** ein, ändert keine Geschäftslogik und fügt **keine neuen Dependencies** hinzu.

---

## 2. Abhängigkeiten zu vorherigen Phasen

| Build-Item | Benötigt abgeschlossen | Begründung |
|---|---|---|
| BL-WIN-8 | BL-WIN-3 (Overlay-Adapter) | Die Canvas-Größe wird über `state:bounds` aus dem Main-Prozess gesteuert. HiDPI-Anpassungen müssen sich an diese Bounds-Schnittstelle halten, ohne die Taskleisten-Logik zu zerstören. |
| BL-WIN-10 | BL-WIN-2 (Windows-Installer/Icon), BL-WIN-4 (Tray-Icon), BL-WIN-8 (HiDPI) | Design-Gate bewertet erst alle visuellen Endpunkte, wenn Packaging, Tray und HiDPI stehen. |

**Nicht blockierend, aber relevant:** BL-WIN-5 (Usage-Paths) ist bereits abgeschlossen; Windows-Codex-Tracking bleibt zurückgestellt und sollte in BL-WIN-10 dokumentiert bleiben.

---

## 3. BL-WIN-8: Renderer HiDPI / Scaling (optional)

### 3.1 Kontext

Aktueller Stand in `src/renderer/renderer.ts:82-83`:

```ts
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
```

Das Canvas arbeitet in **logischen Pixeln**. Unter Windows mit 125 %/150 %/200 % Skalierung liefert `window.innerWidth/Height` weiterhin logische Pixel, während Chromium intern ein `devicePixelRatio` (DPR) von 1.25/1.5/2.0 verwendet. Wenn das Canvas-Element per CSS auf die Fenstergröße skaliert wird, wird der kleine logische Canvas auf den physischen Bereich hochskaliert → bilineare Weichzeichnung der Pixel-Art, obwohl `ctx.imageSmoothingEnabled = false` gesetzt ist.

### 3.2 Ziel

- Das Overlay bleibt bei Windows-Skalierungen von 125 %, 150 % und 200 % visuell scharf.
- Pixel-Art wird mit nearest-neighbor gezeichnet (keine bilineare Interpolation).
- Sprite-Skalierungen bleiben so integer wie möglich; keine halben Quellpixel.
- Das Verhalten auf macOS und Linux darf nicht regressieren.

### 3.3 Konkrete Schritte

#### Schritt 1: Physische Canvas-Größe an DPR koppeln

**Datei:** `src/renderer/renderer.ts`

Einführen einer Hilfsfunktion, die das Canvas-Element an die physische Auflösung anpasst und den Kontext um den DPR skaliert. Logische Bounds für `roam.ts` werden separat geführt.

```ts
function configureCanvasDpr(logicalWidth: number, logicalHeight: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
```

Hinweis: `ctx.setTransform` statt `ctx.scale`, damit ein Wechsel des DPR (Monitor-Wechsel, Skalierungsänderung) nicht kumulativ wirkt.

#### Schritt 2: Bounds-Schnittstelle beibehalten

**Datei:** `src/renderer/renderer.ts`

`bounds()` muss weiterhin logische Pixel zurückgeben, damit `roam.ts`, `bubble.ts`, `hatch.ts` und die Dirty-Rect-Berechnungen unverändert bleiben können.

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };

function bounds(): Bounds {
  return logicalBounds;
}
```

Im `onBoundsChanged`-Handler (Zeile 189 ff.) wird die logische Größe gespeichert und das Canvas neu konfiguriert:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  logicalBounds = { width: next.width, height: next.height };
  configureCanvasDpr(next.width, next.height);
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

#### Schritt 3: Initialisierung anpassen

**Datei:** `src/renderer/renderer.ts`

Die direkte Zuweisung `canvas.width = window.innerWidth` entfällt. Stattdessen:

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };
configureCanvasDpr(logicalBounds.width, logicalBounds.height);
```

Die `createRoamState`-Initialisierung (`renderer.ts:99`) verwendet weiterhin `bounds()`.

#### Schritt 4: Zeichenlogik nicht anfassen

- `drawFrame` in `src/renderer/sprites.ts` bleibt unverändert.
- `PET_SCALE` und `LODGE_SCALE` in `src/renderer/pet-config.ts` bleiben Integer.
- Alle Koordinaten in `draw()`, `drawHatch()` und `bubble.ts` bleiben logische Pixel; die DPR-Skalierung erfolgt implizit durch den transformierten Kontext.

#### Schritt 5: Testabdeckung ergänzen

**Datei:** `src/renderer/renderer.test.ts` (neu anlegen, falls nicht vorhanden) oder Erweiterung eines bestehenden Renderer-Tests.

Da `renderer.ts` stark auf DOM/API-Seiteneffekte angewiesen ist, wird ein klarer Unit-Test für die DPR-Mathematik bevorzugt, statt den gesamten Renderer zu mocken. Falls ein solcher Test nicht praktikabel ist, wird der HiDPI-Pfad manuell im Design-Gate verifiziert.

Empfohlene Testidee (optional):

```ts
// Beispiel: Extrahiere configureCanvasDpr in eine rein funktionale Hilfsfunktion
// configureCanvas(logicalWidth, logicalHeight, dpr) -> { canvasWidth, canvasHeight, styleWidth, styleHeight }
expect(configureCanvas(1920, 1080, 1.5)).toEqual({
  canvasWidth: 2880,
  canvasHeight: 1620,
  styleWidth: '1920px',
  styleHeight: '1080px',
});
```

Wenn keine Extraktion erfolgt, reicht ein manueller Verifikationsschritt im Design-Gate.

### 3.4 Risiken und Degradation (optionaler Charakter)

| Risiko | Auswirkung | Mitigation |
|---|---|---|
| Nicht-integer DPR (1.25, 1.5) führt zu ungleichmäßigen Pixel-Verdopplungen. | Pixel-Art flackert leicht oder wirkt „wackelig". | Akzeptanzkriterium: bei 200 % (DPR=2) muss es perfekt integer sein; bei 125 %/150 % darf es nicht bilinear weichgezeichnet sein. Falls 125 %/150 % unbefriedigend aussehen, Dokumentation der Einschränkung und Vormerkung für Design-Gate/Assets. |
| `window.devicePixelRatio` ändert sich während der Laufzeit (Monitor-Wechsel, Skalierungsänderung). | Canvas wird mit falschem DPR gezeichnet. | `configureCanvasDpr` bei jedem `onBoundsChanged`-Aufruf erneut aufrufen; ggf. zusätzlich auf `window.matchMedia` für DPR-Änderungen lauschen. |
| Regression auf macOS/Linux. | Biber wird zu groß/zu klein oder unscharf. | Expliziter visueller Smoke-Test auf macOS; CI kann dies nicht ersetzen. |
| Zusätzliche Komplexität überwiegt den Nutzen. | Zeitverlust, Code ist schwerer wartbar. | BL-WIN-8 ist optional. Falls die Implementierung nicht innerhalb eines kleinen, isolierten Diff umsetzbar ist, wird sie dokumentiert abgeschaltet (siehe 3.5). |

### 3.5 Dokumentierte Abschaltung / Degradation

Falls BL-WIN-8 im Implementierungslauf als zu riskant oder zu aufwändig eingestuft wird, ist die **Degradation** zulässig:

1. Die Änderungen in `src/renderer/renderer.ts` werden rückgängig gemacht oder gar nicht erst committet.
2. In `README.md` und `CLAUDE.md` wird ein Hinweis ergänzt:
   > „On Windows displays with non-100 % scaling the beaver is rendered at the logical resolution. A future update will add per-display DPR scaling to keep pixel art perfectly crisp at 125 %/150 %/200 %."
3. BL-WIN-8 wird in `.flightplan/Archive/WINDOWS_PORT_PLAN.md` als „optional — zurückgestellt" markiert.
4. BL-WIN-10 Design-Gate dokumentiert den aktuellen Stand und bewertet die Akzeptanz der Unschärfe.

---

## 4. BL-WIN-10: Dokumentation & Design-Gate

### 4.1 Ziel

- README.md, PRD.md und CLAUDE.md spiegeln konsistent den Windows-Status wider.
- Ein visuelles/manuelles Design-Gate bewertet Windows-Icons und HiDPI-Rendering.
- Ergebnisse des Design-Gates (Screenshots + Verdict) werden in `docs/design-reviews/` abgelegt.

### 4.2 Dateien und Änderungen

#### `README.md`

**Zu prüfende/abschließende Stellen:**

- Zeile 37: „Supported on macOS 14+ and Windows 10/11." — bereits korrekt.
- Zeile 39-41: Scope-Note zum Windows-Fokus — beibehalten.
- Zeile 73-80: Windows overlay & tray behavior — beibehalten, ggf. nach BL-WIN-8 um HiDPI-Hinweis ergänzen.
- Zeile 82-96: Windows usage tracking — beibehalten, Codex-Tracking-Status dokumentiert lassen.
- Zeile 109-125: Troubleshooting — nach BL-WIN-8 aktualisieren:
  - Auto-Hide-Limitation bleibt bestehen.
  - Tray-Icon-Kontrast: Hinweis auf Design-Gate-Ergebnis.
  - Falls BL-WIN-8 umgesetzt: HiDPI-Hinweis ergänzen.
  - Falls BL-WIN-8 abgeschaltet: Hinweis auf bekannte Unschärfe bei Skalierung.

**Mögliche Ergänzung nach BL-WIN-8:**

```md
### HiDPI / display scaling

The overlay renders at the native device pixel ratio on Windows, so the beaver
stays crisp at 100 %, 125 %, 150 % and 200 % display scaling. Pixel art is
drawn with nearest-neighbor scaling; at 125 %/150 % the pixel grid may show
minor unevenness, but no bilinear blur.
```

#### `PRD.md`

- Scope-Note (Zeile 18-20) beibehalten.
- R10 (Design QA gate, Zeile 108-115) um Windows-Tragfähigkeit ergänzen: Screenshots müssen auf Windows-Synthetic-Desktop erstellt werden.
- Falls BL-WIN-8 abgeschaltet: HiDPI als bekannte Einschränkung unter „Explicitly OUT of scope (MVP)" oder als Fußnote zu R3/R10 eintragen.

#### `CLAUDE.md`

- Usage-log-Pfad-Abschnitt (Zeile 59-70) ist bereits Windows-kompatibel; prüfen, ob Codex-Status aktuell bleibt.
- Overlay etiquette (Zeile 72-83) beibehalten; ggf. Hinweis: „HiDPI scaling must not break click-through or pixel-grid discipline".
- Definition of done (Zeile 103-107) ergänzen: Für sichtbare Windows-Änderungen gehört ein Design-Gate-Screenshot zu „demonstrably hold".

### 4.3 Design-Gate-Kriterien

Das Design-Gate ist **visuell/manuell**. Es gibt kein finales Master-Icon; die Bewertung erfolgt gegen die vorläufigen Assets.

| Prüfpunkt | Kriterium | Bewertung |
|---|---|---|
| **App-Icon** (`assets/icon.ico`) | Wird im Explorer, Installer und Task-Manager korrekt angezeigt; keine sichtbaren Skalierungsartefakte bei 16×16 bis 256×256. | PASS / FAIL mit Größenangabe |
| **Tray-Icon** (`assets/tray-icon.png`) | Auf hellem und dunklem Windows-Taskleisten-Hintergrund erkennbar; nicht zu klein oder zu groß; Kanten nicht ausgefranst. | PASS / FAIL |
| **HiDPI-Rendering** | Bei 100 %, 125 %, 150 %, 200 % Skalierung: Sprite-Kanten sind scharf, keine bilineare Weichzeichnung; Pixel-Art wirkt nicht verschwommen. | PASS / FAIL pro Skalierung |
| **Overlay-Rand** | Biber bleibt innerhalb der Work-Area; kein Abschneiden an Taskleiste (unten/oben/links/rechts). | PASS / FAIL pro Position |
| **Konsistenz** | Farben und Stil von Icon und Sprite passen zusammen; kein visueller Bruch zwischen Sprite-Palette und App-Icon. | PASS / FAIL |

### 4.4 Design-Gate-Prozess

1. **Vorbereitung:**
   - Windows-Testmaschine mit mindestens zwei Skalierungsstufen (z. B. 100 % und 200 %).
   - Sauberer/Synthetischer Desktop-Hintergrund (keine persönlichen Fenster, Dateinamen oder Benachrichtigungen).
2. **Screenshots erstellen:**
   - App-Icon im Explorer (Klein-/Mittel-/Großansicht).
   - Installer-Fenster mit Icon.
   - Task-Manager-Prozess-Icon.
   - Tray-Icon auf hellem und dunklem Taskleisten-Hintergrund.
   - Overlay mit Biber in Ruhe- und Walk-Animation bei 100 %, 125 %, 150 %, 200 %.
3. **Ablage:**
   - Screenshots unter `docs/design-reviews/phase-4-windows/`.
   - Markdown-Verdict `docs/design-reviews/phase-4-windows/verdict.md` mit Tabelle aus 4.3.
4. **Bei FAIL:**
   - Blocker dokumentieren.
   - Falls es sich um ein Minor-Problem handelt (z. B. Tray-Icon-Kontrast auf dunklem Hintergrund), kann ein kurzer Follow-up-Fix innerhalb von BL-WIN-10 erfolgen (z. B. Kontrast-Anpassung am vorläufigen PNG).
   - Falls ein finales Master-Icon nötig ist, wird es als bekanntes Follow-up markiert (kein neues Build-Item in Phase 4).

---

## 5. Akzeptanzkriterien für die gesamte Phase

### BL-WIN-8 (optional)

- [ ] Bei 200 %-Windows-Skalierung ist das Overlay-Rendering scharf (integer Pixel-Verdopplung).
- [ ] `ctx.imageSmoothingEnabled = false` bleibt aktiv.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` bleiben grün.
- [ ] Das Verhalten auf macOS/Linux ist visuell unverändert (keine Regression).
- [ ] Falls abgeschaltet: Einschränkung ist in README.md, CLAUDE.md und WINDOWS_PORT_PLAN.md dokumentiert.

### BL-WIN-10

- [ ] README.md, PRD.md und CLAUDE.md sind konsistent und reflektieren macOS + Windows.
- [ ] Windows-Scope-Note, Usage-Tracking-Einschränkung und Codex-Status sind aktuell.
- [ ] Design-Gate-Verdict liegt in `docs/design-reviews/phase-4-windows/verdict.md`.
- [ ] Screenshots sind sauber/synthetisch und zeigen App-Icon, Tray-Icon und Overlay bei relevanten Skalierungen.
- [ ] Alle FAILs sind entweder behoben oder als bekannte Einschränkung dokumentiert.

---

## 6. Risiken und Mitigation

| Risiko | Auswirkung | Mitigation |
|---|---|---|
| BL-WIN-8 führt zu Regressionen auf macOS/Linux. | Visuelle Qualität leidet auf nicht-Windows-Plattformen. | Änderungen minimal und hinter einer DPR-Hilfsfunktion kapseln; auf macOS visuell smoke-testen; bei Regressionsgefahr BL-WIN-8 abschalten. |
| 125 %/150 %-DPR sieht trotz `imageSmoothingEnabled = false` nicht perfekt aus. | Design-Gate FAIL für HiDPI. | Akzeptanzkriterien differenzieren: 200 % muss perfekt sein; 125 %/150 % dürfen nur „keine Bilinear-Unschärfe" zeigen. |
| Keine Windows-Hardware für Design-Gate verfügbar. | Design-Gate kann nicht durchgeführt werden. | CI-Windows-Runner kann Packaging prüfen, aber nicht visuell. Notfall: Design-Gate wird auf einem Windows-VM-Screenshot durchgeführt oder als „pending on real hardware" dokumentiert. |
| Finales Master-Icon fehlt weiterhin. | Design-Gate kann nur vorläufige Assets bewerten. | Design-Gate dokumentiert, dass die Bewertung gegen Sprite-generierte Icons erfolgt; finales Icon als bekanntes Follow-up markieren. |
| Dokumentation driftet auseinander (README/PRD/CLAUDE). | Inkonsistente Aussagen. | Gemeinsame Abschnitte (Usage-Tracking, Scope-Note, HiDPI) in allen drei Dateien synchron prüfen. |

---

## 7. Test- und Verifikationsschritte

1. **Automatisierte Checks (lokal und CI):**
   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npx electron-builder --win --publish never
   ```
2. **Manuelle HiDPI-Prüfung (Windows):**
   - Display-Skalierung auf 100 %, 125 %, 150 %, 200 % setzen.
   - App starten (`npm start`).
   - Biber visuell auf Schärfe prüfen (Ruhe + Walk).
   - Screenshot pro Skalierung anfertigen.
3. **Manuelle Overlay-Prüfung (Windows):**
   - Taskleiste an allen vier Kanten positionieren; Biber darf nicht verdeckt werden.
   - Klick-Through testen: Klicks auf den Biber gehen durch ans darunterliegende Fenster.
4. **Icon-Prüfung (Windows):**
   - `release/Beaver Buddy Setup 0.1.0.exe` ausführen; Installer-Icon prüfen.
   - Installierte App im Startmenü/Explorer prüfen.
   - Tray-Icon auf hellem und dunklem Taskleisten-Hintergrund prüfen.
5. **Design-Gate:**
   - Screenshots in `docs/design-reviews/phase-4-windows/` ablegen.
   - `verdict.md` mit PASS/FAIL-Tabelle erstellen.
6. **Regressions-Check (macOS, falls Hardware verfügbar):**
   - `npm run build` und App-Start; visueller Smoke-Test für Overlay-Schärfe und Tray.

---

## 8. Keine neuen Dependencies

- BL-WIN-8 verwendet ausschließlich Browser-APIs (`devicePixelRatio`, `CanvasRenderingContext2D.setTransform`).
- BL-WIN-10 verwendet keine neuen Tools; Screenshots können mit nativem Windows-Screenshot-Tool oder Snipping Tool erstellt werden.
- Falls für das Design-Gate spezielle Bildvergleichs-Tools gewünscht werden, sind diese **außerhalb des Repos** zu verwenden.

---

## 9. Offene Punkte und Follow-ups

- **Finales Master-Icon:** Nicht Teil von Phase 4. Design-Gate liefert ein Verdict gegen die vorläufigen Sprite-generierten Icons. Ein echtes Master-Icon ist ein separates Design-Follow-up.
- **BL-WIN-6 (Keychain/MRR) und BL-WIN-7 (atomares Schreiben):** Bleiben zurückgestellt und werden nicht in Phase 4 berührt.
- **Codex-Tracking auf Windows:** Bleibt zurückgestellt; README/CLAUDE-Dokumentation aktualisieren, falls sich der Status ändert.

---

## 10. Zusammenfassung der anzufassenden Dateien

| Build-Item | Datei | Art der Änderung |
|---|---|---|
| BL-WIN-8 | `src/renderer/renderer.ts` | Canvas-DPR-Konfiguration, logische Bounds trennen |
| BL-WIN-8 | `src/renderer/renderer.test.ts` (optional/neu) | Unit-Test für DPR-Mathematik, falls extrahiert |
| BL-WIN-10 | `README.md` | HiDPI-Hinweis, Troubleshooting aktualisieren |
| BL-WIN-10 | `PRD.md` | R10-Windows-Hinweis, ggf. HiDPI-Einschränkung |
| BL-WIN-10 | `CLAUDE.md` | Definition of done um Design-Gate ergänzen, HiDPI-Hinweis |
| BL-WIN-10 | `docs/design-reviews/phase-4-windows/verdict.md` (neu) | Design-Gate-Verdict |
| BL-WIN-10 | `docs/design-reviews/phase-4-windows/*.png` (neu) | Screenshots |
| Beide | `.flightplan/Archive/WINDOWS_PORT_PLAN.md` | Status von BL-WIN-8/BL-WIN-10 aktualisieren |
