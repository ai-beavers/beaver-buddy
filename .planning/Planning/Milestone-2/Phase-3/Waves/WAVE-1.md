# Wave 1 — Fallschirm-Drop: Assets (struggle, parachute-wind, land)

**Status:** done (Assets generiert + gebacken + smoke-getestet; Intake ins
committete Sheet = WAVE-2/C4) · **ausführendes Tool: Claude Code** (Comfy-Cloud-MCP
ist nur dort konfiguriert; pi baut parallel die Runtime-Logik in WAVE-2)

## Ergebnis (2026-07-20, Claude Code)

### Gap-Analyse
- Rig `beaver-baby` hat alle 8 Parts inkl. `canopy`; das Keyframe-DSL könnte
  alle drei Animationen prozedural riggen (ein `parachute.ts`-Studio-Recipe
  existiert bereits, wurde aber nie ins App-Sheet gebacken). Studio-Recipes
  wären credit-frei und stiltreu gewesen.
- **Owner-Entscheid: Voll ComfyUI** (2026-07-20) — jede Animation komplett als
  Sprite-Sheet per Comfy Cloud generiert, für maximalen Ausdruck.
- Befund nebenbei: Keines der App-Sheets (baby/teen/adult) hatte je eine
  `parachute`-Row — alle drei Rows sind neu.

### Generierungs-Record (Comfy Cloud, Workflow `pixelart-builder.json`)
- Generator-Node: `GeminiNanoBanana2` (Nano Banana 2 / Gemini 3.1 Flash Image),
  16:9 @ 2K, BiRefNet-BG-Removal, Ausgabe 4×2-Grid = 8 Frames.
- Referenzbild: `assets-src/reference/beaver-baby-idle.png` (96×96, sauberer
  idle-Frame) via `upload_file` hochgeladen.
- **Style-Prompt-Anchoring aktiviert** (offene Modification #2 damit erledigt):
  „warm golden-brown fur with cream belly and 1px dark outline, side view
  facing right, same baby beaver character and colors as the reference image,
  consistent proportions in every frame" im Prompt verankert.
- Seeds (fixed, reproduzierbar): parachute-wind=810001, struggle=810002,
  land=810003.
- prompt_ids: parachute-wind `a8aac5c1-…`, struggle `4d6fd4d2-…`, land
  `75ee2f0c-…`. Rohframes → `assets-src/comfyui/{parachute-wind,struggle,land}-run/`
  (gitignored Dumps).

### Bake
- Committeter, reproduzierbarer Ingest-Schritt:
  `scripts/gen-sprites/ingest-animation-frames.mjs` — reuse der exportierten
  Funktionen aus `ingest-images.mjs` (flood-fill BG-Removal → crop bbox →
  premultiplied-alpha area-average downscale → bottom-aligned placeOnTile),
  keine neuen Deps. idle/walk werden pixelgenau aus dem bestehenden Sheet
  kopiert; struggle/parachute-wind/land angehängt.
- Locked-Scale-Ziele: struggle/land = 82px content-height (Ruhe-/Sitzframes ≈
  idle-Größe), parachute-wind = 92px (fit-to-tile → Biber im Gleitflug bewusst
  kleiner; Runtime-Placement ist WAVE-2).
- Output: `assets-src/baked/beaver-baby/{sheet.png,sheet.json}` (768×480,
  Rows idle(1)/walk(2)/struggle(8)/parachute-wind(8)/land(8)) + `_contact.png`.
- Smoke-Test: alle 5 Rows via App-`frameRect`-Logik korrekt gesliced, saubere
  Alpha-Freistellung, keine Fringes. Row-Namen matchen exakt pi's
  `AnimName`-Union in `roam.ts` (idle/walk/struggle/parachute-wind/land).

### Offen → WAVE-2/C4 (Integration)
- **Intake:** `assets-src/baked/beaver-baby/sheet.{png,json}` nach
  `assets/sprites/beaver-baby.{png,json}` übernehmen (gitignored baked → committed).
- **Test-Reconciliation:** `scripts/gen-sprites/ingest-images.test.ts` locked
  aktuell „committed sheet == idle/walk-only-Ingest" (skipIf `assets-src/beaver/`
  absent — auf dieser Maschine grün, aber latent auf Maschinen MIT Quellbildern).
  Nach Intake muss der beaver-baby-Byte-Match auf `ingest-animation-frames.mjs`
  umgezogen werden (oder beaver-baby aus `STAGE_SPECS` gelöst werden).
- **Design-Gate (#38):** Windows-Screenshots @100%/200% mit *spielender*
  Animation — braucht die Runtime, daher WAVE-2. Bekannte Punkte fürs Gate:
  (a) parachute-wind-Biber kleiner (fit-to-tile), (b) einige struggle-Frames
  zeigen den Biber gedreht/left-facing (panisches Zappeln — bewertet das Gate).
- **Galerie:** Eintrag in `docs/asset-gallery.md`.

## Auftrag für Claude Code (bei `/fp-resume` direkt hier weiterlesen)

Erzeuge die drei fehlenden Animationen für das `beaver-baby`-Rig und backe sie
ins App-Sheet-Format. Owner-Freigabe für ComfyUI-Credits liegt vor
(Spend-Gate-Bestätigungen sind erwünscht, aber kein Blocker).

1. **Gap-Analyse zuerst** (30 Min): Prüfe, ob `struggle`/`land` als
   **Studio-Keyframe-Rezepte** aus den vorhandenen Parts
   (`assets-src/parts/beaver-baby/`) baubar sind (Puppet Studio,
   `tools/puppet-studio/`). Nur was posen-technisch nicht reicht, wird per
   **Comfy Cloud** neu generiert. Ergebnis hier dokumentieren.
2. **Benötigte Rows** (zusätzlich zu idle/walk/parachute):
   - `struggle` — Biber hängt (an Cursor), strampelt mit Armen/Beinen/Schwanz,
     Körper rotiert leicht (Zappeln)
   - `parachute-wind` — Gleitflug mit sichtbarem Wind: Schirm wabert, Biber
     schwankt; ersetzt/erweitert die bestehende `parachute`-Row (8 Frames)
   - `land` — Aufsetzen, kurzes Abfedern/Hocken, Übergang in idle-Pose
3. **Konventionen** (verbindlich):
   - App-Format: 96×96-Tiles, Alpha, Sheet-Row in `sheet.json` registrieren
   - Style: `assets/STYLE.md` — **Style-Prompt-Anchoring mitnehmen**
     (Palette/Outline/Right-Facing explizit in den Prompt; Carry-over aus
     Phase 2, siehe `docs/comfyui-avatar-generation.md`)
   - Referenzbild: sauberer idle-Frame aus `assets/sprites/beaver-baby.png`
     (hochladen via `upload_file`), damit Generierungen zum Charakter passen
   - Workflow-Basis: gespeicherte Cloud-Workflows `pixelart-builder.json` /
     `pixelart-parts-builder.json` (Inventory in
     `docs/comfyui-avatar-generation.md`)
   - Rohdaten nach `assets-src/comfyui/<run-name>/`, Parts-Ingest via
     `tools/puppet-studio/ingest-parts.mjs`, Bake über Studio
   - **Asset-Regel:** nur weiterverwendete Assets committen; Dumps bleiben
     lokal (gitignored)
4. **Abschluss:** Studio-Smoke-Test (alle Rows spielen fehlerfrei), dann diese
   Wave + `PHASE.md` + `.flightplan/STATE.md` aktualisieren und in
   `docs/asset-gallery.md` registrieren (Galerie-Eintrag kann auch WAVE-2).

## Prerequisites
- [x] Phase 1 + 2 done (Studio lauffähig, Parts vorhanden)
- [ ] Comfy-Cloud-MCP in Claude Code erreichbar (ggf. neu verbinden:
      `claude mcp add --transport http comfy-cloud https://cloud.comfy.org/mcp`
      + `/mcp` → Authenticate)

## Tasks
- [x] Gap-Analyse: Studio-Rezept vs. ComfyUI-Generierung pro Animation
      (Ergebnis oben dokumentiert; Owner-Entscheid: Voll ComfyUI)
- [x] `struggle` erzeugen (Comfy Cloud, seed 810002)
- [x] `parachute-wind` erzeugen (Comfy Cloud, seed 810001; 8 Frames)
- [x] `land` erzeugen (Comfy Cloud, seed 810003)
- [x] Bake: Sheet-Rows im App-Format (`assets-src/baked/beaver-baby/`)
- [x] Smoke-Test aller Rows (frameRect-Slicing + Kontaktübersicht)
- [ ] Intake ins committete Sheet + Test-Reconciliation + Design-Gate → WAVE-2/C4

## Done when
- Sheet enthält die Rows `struggle`, `parachute-wind`, `land` (zusätzlich zu
  idle/walk) im App-Format; Studio zeigt sie fehlerfrei; Analyse + Quellen
  (Studio-Rezept vs. ComfyUI-Run) sind hier dokumentiert.

## Carry-over
- Style-Prompt-Anchoring wurde oben eingefordert — nach dem Run prüfen, ob es
  im Prompt ankert (offene Modification #2, docs/comfyui-avatar-generation.md).

## pi-Verifikation (2026-07-20, unabhängig gegengeprüft)
- 3 Runs vollständig (`struggle/parachute-wind/land-run`, je 8 Frames + Previews)
- Bake 768×480, 5 Rows; `idle 1 / walk 2` byte-identisch zum Shipped-Sheet
  (kein Metadaten-Bug — pis früherer Verdacht hat sich aufgelöst)
- Sheet visuell geprüft: Wind-Wabern im Schirm, Flail-Varianten, Landung → idle ✅
- Suite 512 Tests grün im gemischten Working Tree
- **Design-Gate-Frage an Owner (für C4-Verdict):** `struggle` enthält rotierte/
  left-facing Frames — STYLE.md sagt „right-facing only". Panic-Flail-Ausnahme
  akzeptabel oder nachgenerieren?
