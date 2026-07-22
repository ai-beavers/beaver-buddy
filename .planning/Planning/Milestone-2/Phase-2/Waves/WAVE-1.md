# Wave 1 — „PixelArt Builder" klonen & erste neue Parts

**Status:** done (2026-07-19, verifiziert)

## Prerequisites
- [x] ComfyUI-MCP-Zugriff aktiv
- [x] Vorlage-Workflow „PixelArt Builder" vorhanden
- [x] Puppet Studio lauffähig (Phase 1 done)

## Tasks
- [x] „PixelArt Builder" im ComfyUI duplizieren und als neue Vorlage sichern
      — Cloud-Inventory dokumentiert `pixelart-builder.json` + Parts-Variante
      `pixelart-parts-builder.json` (docs/comfyui-avatar-generation.md)
- [x] Größenparameter an die Studio-Rigs anpassen (Ziel: 96×96-Tiles, einzelne
      Parts auf transparentem Hintergrund) — Alpha-Output verifiziert; 96×96-Ziel
      wird per `ingest-parts.mjs` (alpha-bbox trim + premultiplied downscale auf
      Rig-Proportionen) erfüllt
- [x] Test-Generierung: komplettes Part-Set für `beaver-baby`-Rig (tail, legBack,
      body, legFront, head, eyeOpen, eyeClosed, canopy) — Run 2026-07-17,
      Rohdaten `assets-src/comfyui/parts-run-1/`
- [x] Parts nach `assets-src/parts/beaver-baby/` übernehmen
      (`tools/puppet-studio/ingest-parts.mjs`) — 8 Parts, Rig-Pivots getunt
- [x] Im Studio prüfen: idle/walk/parachute mit echten Parts, dann Bake-Probe —
      Bake 2026-07-18: `assets-src/baked/beaver-baby/sheet.png` (768×288,
      3 Rows: idle 8 / walk 4 / parachute 8) + Frames im App-Format;
      Smoke-Test 2026-07-19: Studio-Server liefert UI, Rig-JSON und alle
      8 Parts fehlerfrei (HTTP 200)

## Done when
- Neuer Workflow erzeugt ein vollständiges Part-Set im gleichen Stil; Studio
  zeigt die echten Parts fehlerfrei in allen drei Rezepten. ✅

## Carry-over (nicht Teil dieser Wave, vor dem NÄCHSTEN Generierungs-Run)
- Style-Prompt-Anchoring: explizite Referenz auf Palette/Outline/Right-Facing
  aus `assets/STYLE.md` in den Parts-Builder-Prompt (offene Modification #2 in
  docs/comfyui-avatar-generation.md). Braucht Comfy-Cloud-MCP-Session oder
  manuellen UI-Eingriff — in pi ist aktuell kein MCP konfiguriert.
