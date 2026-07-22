# Phase-4-Plan Review — Beaver Buddy Windows Port

**Geprüft:** `.flightplan/Archive/phase-4-plan.md` (BL-WIN-8, BL-WIN-10)  
**Gegen Referenzen:** `WINDOWS_PORT_PLAN.md` (Phase-4-Abschnitt), `src/renderer/renderer.ts`, `src/renderer/sprites.ts`, `src/renderer/roam.ts`, `src/renderer/sprites.test.ts`, `assets/STYLE.md`, `README.md`, `PRD.md`, `CLAUDE.md`  
**Reviewer:** kritischer Review-Agent  
**Datum:** 2026-07-15

---

## 1. Zusammenfassung des geprüften Plans

Phase 4 soll Beaver Buddy für Windows visuell fertigmachen (HiDPI/Scaling) und die Dokumentation sowie ein Design-Gate abschließen. Der Plan behandelt zwei Build-Items:

- **BL-WIN-8 (optional):** DPR-gerechte Canvas-Rendering in `src/renderer/renderer.ts`, damit Pixel-Art auf 125 %/150 %/200 % Windows-Skalierung scharf bleibt.
- **BL-WIN-10:** Aktualisierung von `README.md`, `PRD.md`, `CLAUDE.md` und ein visuelles/manuelles Design-Gate mit Screenshots unter `docs/design-reviews/phase-4-windows/`.

Der Plan ist grundsätzlich vernünftig: BL-WIN-8 ist korrekt als optional markiert, enthält eine dokumentierte Degradation und verzichtet auf neue Dependencies. Die Berücksichtigung der IPC-Bounds aus Phase 2 (`state:bounds` statt `window.innerWidth/Height`) ist erkannt und wird bei der DPR-Umrechnung genutzt.

Allerdings enthält der Plan **einen kritischen, noch nicht erkannten Implementierungsfehler** im Clearing-Verhalten von `draw()`, mehrere Lücken in der Teststrategie und unterschätzt die Edge-Cases bei reinen DPR-Änderungen ohne Fenstergrößenänderung.

---

## 2. Gefundene Probleme / Lücken / Fehler

| # | Problem | Schweregrad | Begründung |
|---|---|---|---|
| 1 | **`draw()` löscht bei fehlendem Dirty-Rect den falschen Bereich**, wenn `ctx` DPR-skaliert ist. In `src/renderer/renderer.ts:279` steht `ctx.clearRect(0, 0, canvas.width, canvas.height)`. Nach BL-WIN-8 sind `canvas.width/height` physische Pixel (z. B. 2880×1620 bei 1.5× DPR), aber der Kontext ist um `dpr` skaliert. Der Aufruf würde dann nur den logischen Bereich `0..canvas.width/dpr` löschen — also nicht den ganzen Canvas. | **Kritisch** | Visuelles Smearing/Geisterbilder im gesamten Overlay, sobald ein Frame ohne Dirty-Rect gezeichnet wird (erster Frame, Resize, Quip-Ausblendung). |
| 2 | **`bounds()` muss explizit auf `logicalBounds` umgestellt werden**, nicht nur „weiterhin logische Pixel zurückgeben“. Aktuell hängt `bounds()` an `canvas.width/height`. Der Plan erwähnt die Änderung, aber nicht die Konsequenz: alle Aufrufer (`createRoamState`, `clampRoamStateToBounds`, `hatchPosition`, `layoutBubble`, `tick`) bekommen sonst physische Pixel und der Biber wandert außerhalb des sichtbaren Fensters. | **Hoch** | Funktionale Regression im Roaming/Clamping, wenn der Patch nur halb ausgeführt wird. |
| 3 | **DPR-Änderungen ohne Fenstergrößenänderung werden nicht zuverlässig erkannt.** `onBoundsChanged` wird nur bei Work-Area-Änderungen aus dem Main-Prozess gefeuert. Ändert der Nutzer in Windows nur die Skalierung (z. B. 100 % → 125 %), ohne dass sich die logische Fenstergröße ändert, kommt kein neues `state:bounds`-Event. | **Hoch** | Biber bleibt unscharf oder falsch skaliert, bis er das Fenster verschiebt/resize. |
| 4 | **Kein Test für die Regression in `draw()` und `bounds()`.** Der Plan schlägt optional einen rein mathematischen Test für `configureCanvasDpr` vor, ignoriert aber das eigentliche Risiko: die Interaktion zwischen DPR-transformiertem Kontext, `canvas.width/height` und den logischen Koordinaten in `draw()` / `bounds()`. | **Mittel** | Fehler aus #1 und #2 können durch bestehende Tests nicht aufgedeckt werden. |
| 5 | **Nicht-integer-DPR (1.25, 1.5) führt zu ungleichmäßigen Pixel-Verdopplungen.** Der Plan nennt das als Risiko, unterschätzt aber die visuelle Auswirkung: bei 1.25× werden 4 Quellpixel auf 5 physische Pixel verteilt, was bei langsam wanderndem Sprite zu „wackelnden“ Outlines führt. Das Design-Gate-Kriterium „keine bilineare Weichzeichnung“ ist notwendig, aber nicht hinreichend für ein gutes Ergebnis. | **Mittel** | Akzeptanzkriterium „125 %/150 % dürfen nur keine Bilinear-Unschärfe zeigen“ könnte im Design-Gate als FAIL enden, obwohl technisch korrekt implementiert. |
| 6 | **Design-Gate-Prozess unterschätzt den Aufwand für synthetische Screenshots.** Der Plan verlangt Screenshots bei 100 %, 125 %, 150 % und 200 % Skalierung plus Taskleiste an vier Kanten. Das erfordert mindestens 16 manuelle Screenshots (4 Skalierungen × 4 Kanten), ohne Auto-Hide-Variante. | **Niedrig-Mittel** | Zeitaufwand nicht budgetiert; Gefahr, dass das Gate unvollständig abgeschlossen wird. |
| 7 | **Auto-Hide-Taskleiste und HiDPI-Rendering sind nicht verknüpft.** Wenn bei Auto-Hide `workArea === bounds` gilt (dokumentierte Limitation aus Phase 2), wird das Overlay auf die volle physische Auflösung ausgerichtet. Das Design-Gate sollte prüfen, ob der Biber bei eingeblendeter Auto-Hide-Leiste trotzdem scharf aussieht und nicht abgeschnitten wird. | **Niedrig-Mittel** | Lücke im Design-Gate; potenziell neuer FAIL, der nicht abgedeckt ist. |
| 8 | **PRD.md-Zeilenangaben können veralten.** Der Plan verweist auf konkrete Zeilennummern (z. B. R10 bei Zeile 108–115). Bei zukünftigen Änderungen an `PRD.md` verschieben sich die Zeilen, was Verwirrung beim Implementierungs-Agenten verursachen kann. | **Niedrig** | Kein Blocker, aber wartungsfeindlich; besser auf Überschriften/IDs verweisen. |
| 9 | **„Finales Master-Icon fehlt“ wird als bekanntes Follow-up markiert, aber nicht in `WINDOWS_PORT_PLAN.md` als explizites Build-Item nachgetragen.** Wenn BL-WIN-10 abschließt, bleibt das Icon-Debt unsichtbar, bis ein Folgeplan es aufgreift. | **Niedrig** | Verfolgungsrisiko; sollte in der Follow-up-Liste von `WINDOWS_PORT_PLAN.md` verankert werden. |

---

## 3. Konkrete Verbesserungsvorschläge

### 3.1 Kritisch: `draw()` an DPR-Transformation anpassen
**Datei:** `src/renderer/renderer.ts:279`

Ändere den Full-Canvas-Clear so, dass er im skalierten Kontext logische Koordinaten verwendet:

```ts
// Statt:
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Besser:
ctx.clearRect(0, 0, bounds().width, bounds().height);
```

Da `bounds()` logische Pixel zurückgeben muss (siehe 3.2), wird der Clear-Bereich durch die `setTransform(dpr, …)`-Matrix korrekt auf den physischen Canvas ausgedehnt.

### 3.2 Hoch: `bounds()` explizit auf `logicalBounds` umstellen
**Datei:** `src/renderer/renderer.ts:92-94`

Der Plan erwähnt `logicalBounds`, aber die aktuelle `bounds()`-Implementierung liest `canvas.width/height`. Dies muss in der Implementierung zwingend geändert werden:

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };

function bounds(): Bounds {
  return logicalBounds;
}
```

Und im `onBoundsChanged`-Handler muss `logicalBounds` gesetzt werden:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  logicalBounds = { width: next.width, height: next.height };
  configureCanvasDpr(next.width, next.height);
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

**Wichtig:** Kein anderer Code darf danach `canvas.width/height` als logische Größe interpretieren.

### 3.3 Hoch: Auf DPR-Änderungen separat lauschen
**Datei:** `src/renderer/renderer.ts`

Ergänze einen Listener, der auch bei reinen DPR-Änderungen `configureCanvasDpr` neu aufruft:

```ts
function updateDprFromMedia(): void {
  configureCanvasDpr(logicalBounds.width, logicalBounds.height);
  needsDraw = true;
}

window.matchMedia('screen and (resolution: 1dppx)').addEventListener('change', updateDprFromMedia);
// Hinweis: matchMedia für DPR-Änderungen ist ein bekanntes Pattern, funktioniert aber nicht
// auf allen Plattformen zuverlässig. Alternativ kann man beim resize-Event prüfen,
// ob sich devicePixelRatio geändert hat.
```

Noch robuster: Beim `window.resize`-Event prüfen, ob `window.devicePixelRatio` gegenüber dem letzten bekannten Wert gesprungen ist, und ggf. neu konfigurieren. Das sollte im Plan als **zwingender Schritt** (nicht „ggf.") geführt werden, weil Windows-Nutzer die Skalierung häufig ohne Fenster-Resize ändern.

### 3.4 Mittel: Renderer-Teststrategie erweitern
**Dateien:** `src/renderer/renderer.test.ts` (neu) oder `src/renderer/sprites.test.ts`

Der Plan schlägt einen mathematischen Test für `configureCanvasDpr` vor. Das ist sinnvoll, aber nicht ausreichend. Zusätzlich empfohlen:

1. **Unit-Test für DPR-Mathematik:**
   ```ts
   expect(configureCanvas(1920, 1080, 1.5)).toEqual({
     canvasWidth: 2880,
     canvasHeight: 1620,
     styleWidth: '1920px',
     styleHeight: '1080px',
   });
   ```

2. **Regressionstest für `bounds()` nach DPR-Umstellung:** Stelle sicher, dass `bounds()` nach `configureCanvasDpr(1920, 1080, 2)` weiterhin `{ width: 1920, height: 1080 }` liefert, obwohl `canvas.width === 3840`.

3. **Integrationstest für `draw()` Clear-Bereich:** Wenn möglich, prüfen, dass nach einem Full-Canvas-Clear bei DPR=2 der Clear-Rect logische 1920×1080 (nicht physische 3840×2160) an `clearRect` übergeben wird. Das verhindert Fehler #1.

Da `renderer.ts` stark DOM-seiteneffektbehaftet ist, kann Punkt 3 aufwendig sein. Mindestens Punkte 1 und 2 sollten aber umgesetzt werden, bevor BL-WIN-8 als abgeschlossen gilt.

### 3.5 Mittel: Design-Gate-Kriterien für nicht-integer DPR präzisieren
**Datei:** `.flightplan/Archive/phase-4-plan.md` Abschnitt 4.3

Ergänze das HiDPI-Kriterium:

> „Bei 200 %: Sprite-Kanten sind scharf und Pixel-Verdopplung ist integer (keine halben Pixel).  
> Bei 125 %/150 %: Keine bilineare Weichzeichnung; leichte Ungleichmäßigkeit im Pixel-Raster ist akzeptabel, solange die Silhouette beim Stehen/Walken nicht auffällig flackert."

Falls bei 125 %/150 % ein sichtbares Flackern auftritt, sollte das Verdict explizit als **CONDITIONAL PASS** (nicht FAIL) dokumentiert werden, weil dies ein fundamentales Limit von nearest-neighbor bei nicht-integer-DPR ist.

### 3.6 Mittel: Auto-Hide in Design-Gate aufnehmen
**Datei:** `.flightplan/Archive/phase-4-plan.md` Abschnitt 4.3

Ergänze einen Prüfpunkt:

| Prüfpunkt | Kriterium |
|---|---|
| **Auto-Hide-Taskleiste** | Bei aktivierter Auto-Hide-Taskleiste wird der Biber nicht dauerhaft verdeckt; bei eingeblendeter Leiste bleibt er scharf und vollständig sichtbar. |

### 3.7 Niedrig: Icon-Debt als explizites Follow-up verankern
**Datei:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md` Abschnitt 8

Ergänze unter „Verschobene Aufgaben" oder als neues Phase-5-Item:

> **Finales Master-Icon / Design-Pass** — Nachlieferung eines professionellen App-Icons und Tray-Icons durch Design; ersetzt die vorläufigen Sprite-generierten `assets/icon.ico` und `assets/tray-icon.png`.

### 3.8 Niedrig: Zeilenreferenzen in Plan durch semantische Verweise ersetzen
**Datei:** `.flightplan/Archive/phase-4-plan.md` Abschnitt 4.2

Statt „Zeile 108–115" besser: „PRD.md, Abschnitt R10 (Design QA gate)".

---

## 4. GO / NO-GO Empfehlung

**Empfehlung: GO — mit Vorbedingungen.**

Der Phase-4-Plan ist umsetzbar, aber nicht in der aktuellen Form. Vor dem Start der Implementierung müssen die Punkte #1, #2 und #3 aus Abschnitt 2 in den Plan übernommen werden, sonst riskiert der Implementierungs-Agent einen kritischen Rendering-Bug und eine DPR-Änderungs-Regression.

BL-WIN-10 (Dokumentation & Design-Gate) ist realistisch umsetzbar, auch ohne finales Master-Icon, solange das Gate klar als Bewertung gegen **vorläufige** Assets kommuniziert wird.

---

## 5. Hinweise für den Implementierungs-Agenten

Wenn du BL-WIN-8 umsetzt, beachte bitte besonders:

1. **Nie `canvas.width/height` als logische Größe verwenden**, nachdem DPR aktiviert wurde. Alle Roaming-, Hatch-, Bubble- und Dirty-Rect-Berechnungen müssen über `bounds()` laufen, das `logicalBounds` zurückgibt.

2. **Fixe den Full-Canvas-Clear in `src/renderer/renderer.ts:279`**: `ctx.clearRect(0, 0, bounds().width, bounds().height)` statt `canvas.width/height`.

3. **Lausche auf DPR-Änderungen**, nicht nur auf `onBoundsChanged`. Ein `window.resize`-Handler, der `window.devicePixelRatio` mit einem gespeicherten Wert vergleicht, ist der robusteste Ansatz ohne neue Dependencies.

4. **Halte `PET_SCALE`/`LODGE_SCALE` integer** (`src/renderer/pet-config.ts`). Ändere sie nicht auf Bruchwerte, um Halbpixel zu vermeiden.

5. **`drawFrame` in `src/renderer/sprites.ts` bleibt unverändert**, aber prüfe, dass der übergebene `ctx` die DPR-Transformation trägt und dass `x`, `y`, `scale` logische Werte bleiben.

6. **Führe nach der Umstellung einen visuellen Test auf 100 %, 125 %, 150 % und 200 % durch.** Achte dabei nicht nur auf „nicht unscharf", sondern auch auf flackernde/wackelnde Outlines bei langsamer Bewegung.

7. **Teste Auto-Hide-Taskleiste separat.** Wenn die Taskleiste eingeblendet wird, darf der Biber nicht abgeschnitten werden und das Rendering darf nicht neu initialisiert/zurückgesetzt werden.

8. **Für BL-WIN-10:** Verwende für Screenshots einen neutralen Desktop-Hintergrund und entferne persönliche Fenster/Dateinamen. Speichere das Verdict als `docs/design-reviews/phase-4-windows/verdict.md`.

9. **Falls BL-WIN-8 abgeschaltet wird:** Dokumentiere die Einschränkung in `README.md`, `CLAUDE.md` **und** `WINDOWS_PORT_PLAN.md`, wie im Plan vorgesehen. Stelle sicher, dass die Degradation wirklich alle DPR-Änderungen in `renderer.ts` rückgängig macht.

10. **Vor dem Abschluss:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` und `npx electron-builder --win --publish never` müssen grün sein. Füge mindestens einen Unit-Test für die DPR-Mathematik hinzu.
