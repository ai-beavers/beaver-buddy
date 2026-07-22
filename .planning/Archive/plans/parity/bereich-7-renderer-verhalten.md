# Bereich 7 — Renderer-Verhaltens-Parität: Hatch / Evolution / Roam / Pet-Config

## 1. Urteil: PARITÄT OK

**0 Lücken, 2 Risiken.** Upstream brachte im untersuchten Bereich genau einen
Renderer-Commit (`9c8bd00`, `git log --oneline 833de1f..upstream/main -- src/renderer/`);
der Merge d7acaf0 hat ihn vollständig übernommen — `pet-config.ts`, `bubble.ts`,
`hatch.ts` und `evolution.ts` sind **byte-identisch mit upstream/main** (leerer
`git diff upstream/main HEAD`). Unser Branch-Delta ist ein reiner Superset
(`canvas-dpr.ts`, `onBoundsChanged`, DPR-Resize-Watcher, `clampRoamStateToBounds`,
eigenes Adult-Sheet). Hatch-, Evolution- und Roam-Logik sind dt-basierte,
plattformneutrale State-Machines ohne einzige `process.platform`-Verzweigung im
gesamten `src/renderer/`. 52/52 Renderer-Tests lokal grün (selbst ausgeführt:
`npx vitest run src/renderer/`).

Schnittstellen-Hinweis an den Schwarm: die DPR-Watcher-Lücke "DPI-Wechsel ohne
DIP-Bounds-Änderung" (`src/renderer/renderer.ts:214-221`) wurde bereits von
**Bereich 4 (F1)** gemeldet — hier bewusst nicht doppelt geführt.

## 2. Befunde

### F1 — [risiko] Windows-only Chromium-Occlusion-Throttling pausiert den Renderer-Loop bei voll verdecktem Overlay

- `src/main/main.ts:144-149` — `webPreferences` setzt `backgroundThrottling`
  nicht ab (Default `true`). Chromiums "native window occlusion" ist ein
  **Windows-only** Feature: Ist das Overlay vollständig von anderen Fenstern
  verdeckt, kann die Page als hidden gelten → rAF stoppt. Auf macOS existiert
  dieses Occlusion-Tracking nicht, der Loop läuft dort auch verdeckt weiter.
- Konsequenz im Code verifiziert graceful: `document.hidden`-Skip mit
  Clock-Reset (`src/renderer/renderer.ts:368-372`) → kein dt-Sprung beim
  Wiederauftauchen; zusätzlich clamped `MAX_DT_S = 0.25` jeden Frame
  (`src/renderer/pet-config.ts:34-37`). Roam/Evolution/Hatch setzen sauber fort.
- Einziger Verhaltens-Unterschied: ein Quip, der **vollständig** während der
  Verdeckung abläuft, wird nie gezeichnet (`quipState`-Expiry,
  `src/renderer/renderer.ts:447-451`). Auf macOS läuft derselbe Quip ebenso
  unsichtbar ab — nutzer-sichtbarer Unterschied praktisch null; Windows spart
  dabei sogar CPU. Unsicherheit: ob Electron 43 das Occlusion-Feature für
  transparente, `ignoreMouseEvents`-Fenster tatsächlich anwendet, ist nicht
  live verifiziert (CLI-Umgebung, s. F2).
- **Fix (ohne neue Dependencies):** Kein Code-Fix nötig — Verhalten ist korrekt
  und ressourcenschonend. Optional als bekanntes Windows-Verhalten in der
  Windows-Doku/README festhalten ("bei voll verdecktem Overlay pausiert die
  Animation by design"). Kein Flight-Plan-Blocker.

### F2 — [risiko] Neue 12px-Bold-Quip-Bubble (9c8bd00) ist auf Windows weder live noch metrisch verifiziert

- Merge brachte die Bubble-Metrik-Bumps: `BUBBLE_FONT_PX 8→12`,
  `BUBBLE_CHAR_WIDTH_PX 5→7`, `MAX_CHARS 24→28`, `LINE_HEIGHT 10→15`,
  `PADDING 4→8`, `TAIL 3→5`, `OFFSET 6→8` (`src/renderer/pet-config.ts:98-108`)
  plus `bold`-Font und gerundete Glyph-Origins (`src/renderer/bubble.ts:116-126`).
  Getuned auf macOS/Retina (Commit-Message: "Sized for Retina overlays").
- Metrik-Check gegen Windows: `monospace` resolved unter Windows-Chromium zu
  **Consolas** (Advance ≈ 0.55 em → ≈ 6.6 px bei 12 px) — die 7-px-Approximation
  (`pet-config.ts:101`) ist dort großzügig, Text bleibt garantiert innerhalb der
  berechneten Bubble-Breite (schlimmster Fall 28 Zeichen: 28×6.6 ≈ 185 px ≪
  28×7+16 = 212 px). Selbst der macOS-Fall (Menlo ≈ 7.22 px → ≈ 202 px) bleibt
  im Padding. Kein Clipping (Canvas clippt nicht), kein Smear (Dirty-Rect deckt
  Bubble + Tail + 1, `src/renderer/renderer.ts:348-360`). Funktional also auf
  Windows **sicher**.
- Aber: Das Windows-Design-Gate ist provisional und stammt von **vor** dem
  Merge — "Screenshots: not captured in this CLI-only environment"
  (`docs/design-reviews/phase-4-windows/verdict.md:49-51`). Bold-12px-Consolas
  im 96-px-Pixelart-Kontext (Bubble max. 212 px breit vs. Pet-Tile 96 px) ist
  auf Windows nie gerendert begutachtet worden; Wrap-Optik bei 28 statt 24
  Zeichen/Zeile ebenfalls nicht.
- **Fix (ohne neue Dependencies):** Windows-Live-Gate nachholen mit
  Bordmitteln: `npm start -- --quip <trigger>` (QA-Flag,
  `src/main/main.ts:32,84-93,410-413`) für einen langen Quip +
  `scripts/cdp-screenshot.mjs <port> <out.png>` für den Screenshot; bei
  100 %/125 %/150 %/200 % Skalierung; Ablage unter
  `docs/design-reviews/phase-4-windows/`. Kein Code-Eingriff erwartet —
  reine Verifikation.

## 3. Verifiziert-OK-Liste

- **pet-config.ts identisch mit upstream** (leerer Diff): sämtliche Timing-
  Konstanten (SPRITE_FPS 8, MAX_DT_S 0.25, IDLE/CLIMB-Fenster, Evolution-/
  Hatch-Dauern) sind plattformneutral; `MAX_DT_S` deckt Sleep/Throttle-Stalls
  explizit ab (`src/renderer/pet-config.ts:34-37`).
- **roam.ts:** reine State-Machine, Bounds kommen aus dem Main-Prozess
  (workArea inkl. Auto-Hide-Inset, `src/main/overlay-adapter.ts:36-52`) →
  Taskleiste unten/oben/links/rechts und Auto-Hide sind für Roam/Hatch/Bubble
  automatisch korrekt. Branch-Zugabe `clampRoamStateToBounds`
  (`src/renderer/roam.ts:153-163`) klemmt den State bei Taskleisten-
  Verschiebung live ein (Aufruf `src/renderer/renderer.ts:208`).
- **Adult-Sheet lädt weiter:** `assets/sprites/beaver-adult.png/.json`
  (96-px-Tile, Rows idle/walk — konsistent mit `BEAVER_TILE_PX = 96`,
  `pet-config.ts:16`) wird stage-keyed geladen (`src/renderer/sprites.ts:43-50`,
  `Stage` inkl. `'adult'`, sprites.ts:6), per `npm run build` nach
  `dist/renderer/assets/sprites/` kopiert (`scripts/build-assets.js:38-46`,
  verifiziert: Dateien liegen in dist/) und ins Package aufgenommen
  (`electron-builder.yml:5-8`). Upstreams Teen-Fallback wurde bewusst durch
  unser echtes Sheet ersetzt (94ace5c).
- **Hatch-Platzierung Windows-sicher:** `hatchPosition()` rechnet in
  fenster-lokalen Koordinaten (`src/renderer/renderer.ts:228-230`); das Fenster
  sitzt auf dem WorkArea-Ursprung → Lodge/Baby landen oberhalb der Taskleiste
  bzw. mit 2-DIP-Auto-Hide-Inset korrekt. Handoff an Roam ohne Sprite-Pop
  (renderer.ts:437-444).
- **Evolution-Cancel bei Reset-Hatch** aus 9c8bd00 exakt einmal übernommen
  (renderer.ts:185-199) — verhindert Stage-Rücksprung nach Settings-Reset;
  main-seitige Kette persist → HATCH_START → XP-Reset bestätigt
  (merge-verification #5/#8, `src/main/main.ts:284-295`).
- **Windows ~3-px-DWM-Fensteraufblähung ohne Renderer-Impact:** Renderer nutzt
  Main-gelieferte Bounds statt `window.innerWidth` (renderer.ts:201-209,
  `src/main/main.ts:380-386`); der initiale innerWidth-Fallback heilt sich beim
  ersten `BOUNDS_CHANGED` via Clamp selbst. Smoke-Toleranz dokumentiert
  (`src/main/main.ts:180-192`).
- **Keine Render-Hz-Annahme:** Movement/Animation vollständig dt-basiert
  (Header renderer.ts:1-8; Frame-Akkumulator renderer.ts:398-407) — 120/144-Hz-
  Windows-Displays und 60-Hz-ProMotion laufen identisch schnell; `moved`-Check
  auf gerundeten Pixeln (renderer.ts:391-396) hält die CPU-Disziplin auch bei
  hohen Refresh-Raten.
- **Evolution-Flash unter DPR-Transform korrekt:** `source-in`-Composite und
  Dirty-Rect-Pad (Jitter + Rotation √2, renderer.ts:327-343) arbeiten in
  logischen Koordinaten — plattform- und skalierungsunabhängig.
- **Bounds-Verdrahtung Windows-seitig vollständig:** `display-metrics-changed`
  etc. subscribed (`src/main/overlay-adapter.ts:121-131`), Initial-Send nach
  `did-finish-load` (`src/main/main.ts:380-386`), Initial-Fit vor Ladung
  (main.ts:222-223).
- **Tests:** 52/52 Renderer-Tests grün (`npx vitest run src/renderer/`, selbst
  ausgeführt): roam (8), hatch (13), evolution (11), bubble (9), sprites (5),
  canvas-dpr (3, inkl. dpr 1.25/1.5 = Windows-Skalierungen), renderer (3, inkl.
  DPR-Wechsel-Pfad und logischem clearRect).

## 4. Vorgeschlagene Flight-Plan-Items

1. **Windows Live-Gate Renderer-Visuals (Hatch/Evolution/Quip-Bubble)** —
   echte Windows-Screenshots der post-Merge-Visuals (12-px-Bold-Bubble,
   Hatch-Sequenz, Evolution-Flash) bei 100/125/150/200 % Skalierung via
   `--quip`/`--inject-xp`/`--reset-hatch` + `scripts/cdp-screenshot.mjs`;
   Ablage in `docs/design-reviews/phase-4-windows/` (löst das dort offene
   provisional-Gate ein). Deckt F2.
2. **(Optional) Occlusion-Verhalten dokumentieren** — ein Satz in der
   Windows-Doku: bei voll verdecktem Overlay pausiert die Animation by design
   (Chromium-Occlusion, Windows-only). Kein Code. Deckt F1.
