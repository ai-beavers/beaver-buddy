# Bereich 4 — HiDPI / Bubble / Renderer (Windows-Parität)

## 1. Urteil: LÜCKE(N) GEFUNDEN

1 kleine, konditionale Lücke (DPI-Wechsel ohne DIP-Bounds-Änderung wird verschluckt) + 2 kosmetische Risiken. Der Kern des Upstream-Retina-Fixes (9c8bd00) ist im Merge d7acaf0 vollständig und als echter Superset enthalten: **Nirgends wird DPR auf ganze Werte gerundet/gesnappt** — 1.25 / 1.5 / 1.75 laufen als Float durchgängig durch Backing-Store-Größe und Context-Transform.

## 2. Befunde

### F1 — [lücke] DPI-Wechsel bei gleicher DIP-WorkArea erzeugt weder BOUNDS_CHANGED noch DOM-resize → Canvas dauerhaft unscharf

- `src/main/main.ts:227-234` — der Guard in `onWorkAreaChanged` vergleicht nur `x/y/width/height` der WorkAreaInfo, **nicht** `scaleFactor` oder Display-ID. Szenario: Primärmonitor-Wechsel zwischen zwei Displays mit identischer DIP-WorkArea, aber unterschiedlichem scaleFactor (gängige Kombi: 1920×1080 @100 % ↔ 3840×2160 @200 % — z. B. Docken/Undocken, Primärmonitor umstellen). `display-metrics-changed`/`display-removed` feuern zwar (`src/main/overlay-adapter.ts:121-131`), aber der Guard return-t früh → **kein** `BOUNDS_CHANGED_CHANNEL`-Send.
- Konsequenz Renderer: Das Fenster behält seine DIP-Größe → **kein** DOM-`resize`-Event → der DPR-Watcher `src/renderer/renderer.ts:214-221` feuert nicht → `currentDpr` (renderer.ts:95) bleibt stale. Backing Store und Transform bleiben auf dem alten DPR → gesamtes Canvas inkl. Quip-Bubble-Text unscharf bis zum nächsten Bounds-Event oder App-Neustart.
- Verschärfend: Selbst wenn BOUNDS_CHANGED gesendet würde, nutzt `onBoundsChanged` (renderer.ts:201-209) das ggf. stale `currentDpr` und liest `window.devicePixelRatio` nicht neu — die Konvergenz hängt heute allein am nachfolgenden DOM-resize, das in diesem Fall ausbleibt.
- Häufigkeit: niedrig, aber reales Windows-Szenario; auf macOS praktisch nicht erreichbar (Primärdisplay-Wechsel mit identischer DIP-WorkArea und DPR-Sprung 1↔2 ist dort unüblich).
- **Fix (ohne neue Dependencies):** Renderer-seitig selbstheilend: im bestehenden rAF-Loop (`frame()`, renderer.ts:365) `window.devicePixelRatio !== currentDpr` prüfen und bei Drift `currentDpr` aktualisieren + `applyDpr` + `needsDraw = true` (Kosten: ein Float-Vergleich pro Frame; Alternative: `matchMedia('(resolution: …dppx)')`-Listener). Zusätzlich in `onBoundsChanged` `currentDpr = window.devicePixelRatio || 1` neu lesen, damit der Handler nicht vom Event-Ordering mit DOM-resize abhängt. Optional main-seitig `scaleFactor` in den Change-Vergleich aufnehmen (WorkAreaInfo bereits display-abgeleitet, `overlay-adapter.ts:54-63`).

### F2 — [risiko] +0.5-Crisp-Line-Trick der Bubble-Outline ist bei DPR 1.25/1.5/1.75 wirkungslos

- `src/renderer/bubble.ts:103-114` — `strokeRect(x + 0.5, …)` + Tail-Stroke mit +0.5 landet nur bei dpr = 1 und 2 auf physikalischen Pixelmitten. Bei dpr = 1.25/1.5/1.75 ist die 1-CSS-px-Kontur 1.25/1.5/1.75 phys. px breit; die Kanten liegen notwendigerweise auf Bruchteilspositionen (Kantenabstand nicht ganzzahlig) → Outline antialiased/leicht weich.
- Kein Funktionsverlust: Der Bubble-**Text** bleibt scharf (Backing-Store-Supersampling greift bei jedem dpr > 1; `bold 12px` → 15/18/21 phys. px Glyphen, bubble.ts:119). Betroffen ist nur die 1-px-Kontur — kosmetisch, und 1:1 der Zustand jeder Canvas-App bei Windows-Scaling 125/150/175 %.
- **Fix (optional, ohne neue Dependencies):** Stroke-Breite `1/dpr` CSS px und Stroke-Positionen aufs physikalische Raster runden (`Math.round(v * dpr) / dpr`); `drawBubble` müsste dazu den DPR kennen — z. B. via `ctx.getTransform().a` (keine Signaturänderung nötig) oder als Parameter aus renderer.ts. Alternativ bewusst als akzeptables Fractional-Scaling-Verhalten dokumentieren.

### F3 — [risiko] Pixel-Art-Sprites zeigen bei krummem DPR ungleiche Art-Pixel-Breiten

- `src/renderer/sprites.ts:91-116` (drawFrame, nearest-neighbor via `imageSmoothingEnabled = false`, canvas-dpr.ts:42) + Integer-Draw-Positionen auf dem **CSS**-Raster (renderer.ts:320-321). Bei dpr 1.25/1.5/1.75 ist das Device-Ratio nicht ganzzahlig → Art-Pixel werden 2/3 phys. px breit im Wechsel; beim Roamen minimales "Shimmern", weil CSS-Integer-Raster ≠ physikalisches Raster.
- Inhärent bei fraktionellem Scaling (betrifft jede Pixel-Art-App unter Windows 125/150/175 %), ohne Änderung der Pet-Pixelgröße nicht sinnvoll fixbar → Wontfix-Kandidat, nur als bekanntes Verhalten dokumentieren. Kein Paritäts-Defizit im engeren Sinn (macOS hat nativ keine fraktionellen DPRs).

## 3. Verifiziert OK

- **Kein Integer-DPR-Snapping:** Grep über `src/` — einzige Rundung ist `Math.round(logical * dpr)` auf das Endprodukt (`src/renderer/canvas-dpr.ts:17-18`, korrekt: physikalische Pixel müssen ganzzahlig sein); `window.devicePixelRatio` wird als Float übernommen (`src/renderer/renderer.ts:95,215`).
- **Merge-Superset bestätigt:** `git diff upstream/main HEAD -- src/renderer/` zeigt: Upstreams `syncCanvasResolution()` (9c8bd00) ist vollständig durch unser `applyDpr` ersetzt (identische Semantik) **plus** `onBoundsChanged`-Handler, `resize`-DPR-Watcher und `clampRoamStateToBounds`; `bubble.ts` ist diff-frei = Upstreams Retina-Text-Fix (bold, `textAlign='left'`, gerundete Glyph-Origins, bubble.ts:116-126) unverändert übernommen.
- **DPR-Transform idempotent:** `setTransform` (nicht `scale`) — wiederholte `applyDpr`-Calls akkumulieren nicht (`canvas-dpr.ts:41`); `imageSmoothingEnabled = false` wird nach jedem Canvas-Resize erneut gesetzt (canvas-dpr.ts:42).
- **Testabdeckung fraktioneller DPRs vorhanden:** dpr 1.25 + 1.5 in `src/renderer/canvas-dpr.test.ts:6-18`; dpr 1.5-Resize-Pfad in `src/renderer/renderer.test.ts:130-139`; dpr 2 in renderer.test.ts:112-128. (1.75 fehlt, trivial nachrüstbar — gleiche Codepfade.)
- **BOUNDS_CHANGED-Verdrahtung:** `display-added`/`display-removed`/`display-metrics-changed` subscribed (`src/main/overlay-adapter.ts:121-131`); Initial-Bounds nach `did-finish-load` (`src/main/main.ts:380-386`); Preload-Channel `state:bounds` korrekt weitergeleitet (`src/main/preload.ts:18,61-65`); Renderer nutzt explizite Bounds statt innerWidth/Height (`renderer.ts:201-209`).
- **Event-Ordering IPC ↔ resize konvergiert** (solange beide feuern): beide Handler enden in idempotentem `applyDpr` mit final konsistentem (bounds, dpr)-Paar, egal in welcher Reihenfolge (renderer.ts:201-221).
- **Clear/Dirty-Rect DPR-sicher:** `clearRect` in logischen Koordinaten unter DPR-Transform (`renderer.ts:300-306`, Test renderer.test.ts:141-156); Tail-Stroke-Bleed +1 CSS px (renderer.ts:355-359) deckt auch den 1.25-fachen physikalischen Bleed der fraktionalen Kontur.
- **Canvas-State-Reset unproblematisch:** `canvas.width =`-Setzen resettet den 2D-State, aber alle Draw-Pfade setzen Stile pro Call (`bubble.ts:91,107,119`; `sprites.ts` drawFrame mit save/restore, sprites.ts:107).
- **Backing-Store-Rundung:** `Math.round(logical*dpr)` mit ganzzahligen DIP-Bounds (Electron workArea) → max. ±0,5 phys. px Abweichung vom Ideal; Chromium-Layer-Snapping hält das 1:1-Texel-Mapping — Standard-Muster, keine sichtbare Unschärfe.

## 4. Vorgeschlagene Flight-Plan-Items

1. **DPR-Drift-Guard im Renderer** — `devicePixelRatio` im rAF-Loop (oder via `matchMedia('(resolution: …dppx)')`) gegen `currentDpr` prüfen und bei Drift `applyDpr` neu anwenden; schließt die Lücke "DPI-Wechsel ohne DIP-Bounds-Änderung" (Primärmonitorwechsel 100 % ↔ 200 %), inkl. `currentDpr`-Neulesen in `onBoundsChanged`.
2. **Bubble-Outline: physikalisches Pixel-Snapping bei fraktionellem DPR (optional/kosmetisch)** — Stroke-Breite `1/dpr` + Positionen via `ctx.getTransform().a` aufs Device-Raster runden, damit die 1-px-Kontur auch bei 125/150/175 % crisp bleibt.
