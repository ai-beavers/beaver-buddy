# Phase 2 — ComfyUI-Workflow „PixelArt Builder" klonen & anpassen

> Part of Milestone 2. Done when: Ein neuer Workflow erzeugt Biber-Parts in anderen Größenparametern im gleichen Style, und die Parts sind im Puppet Studio nutzbar.

**Status:** done (2026-07-19)

## Waves
- [x] WAVE-1 — Workflow klonen, Größenparameter anpassen, erste Parts generieren (siehe `Waves/WAVE-1.md`)

## Notes
- Vorlage: bestehender ComfyUI-Workflow „PixelArt Builder" (Hamster-Avatar-Animationen).
- Ziel: schnelle Generierung neuer Charaktere/Stadien/Parts im konsistenten Stil; komplexere Animationen durch Kombination einzelner Animationen.
- Parts landen unter `assets-src/parts/<rig>/` (gitignored), Sheets nach Bake in `assets-src/baked/` — nur reviewed Sheets werden committed (CLAUDE.md Assets-Regel).
- MCP-Server für ComfyUI ist konfiguriert (Zugriff in früherer Session bestätigt); Setup-Doku ist bewusst nicht im Repo (keine API-Keys/lokalen Pfade committen).
