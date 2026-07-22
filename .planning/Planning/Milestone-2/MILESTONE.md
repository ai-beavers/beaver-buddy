# Milestone 2 — Asset-Pipeline & Animationen

> Why it matters: Neue Biber-Figuren, Stadien und Animationen sollen mit dem ComfyUI-Workflow + PixiJS Puppet Studio schnell und reproduzierbar erzeugt und in die App gebacken werden — ohne manuelle Pixelarbeit.

**Status:** in-progress (P3 pausiert seit 2026-07-21 — Re-Onboarding/Zyklus-1-Neuplanung; Resume via `/fp-resume` in Claude Code, Spec: `Phase-3/Waves/WAVE-3.md`)

**Accountable:** Vlady (Assets) + Rodgi · **Agent:** Claude Code (Assets), pi (Runtime, nur Rodgi)

## Phases
> Konvention (Owner-Beschluss 2026-07-20): eine Animation pro Phase, 1–2 Waves
> (WAVE-1 Assets, WAVE-2 Runtime). Detail-Definition jeweils zu Phasenbeginn.
> **Umzug 2026-07-21:** Die Animations-Umsetzungsphasen (ehem. P4–P15) leben jetzt
> in **Milestone 5**. Hier bleiben nur Pipeline-Fundament + Fallschirm-Pilot.

- [x] Phase 1 — PixiJS Puppet Studio (BL-14, ADR 003)
- [x] Phase 2 — ComfyUI-Workflow „PixelArt Builder" klonen & anpassen
- [ ] Phase 3 — Fallschirm-Drop (Interaktions-Animation) — **pausiert** (WAVE-1 ✅, WAVE-2 ✅, WAVE-3 Polish offen)

## Success
- Pipeline steht: Parts/Animationen werden generiert, geriggt, gebacken, reviewed und in `assets/sprites/` + `docs/asset-gallery.md` registriert. ✅ (P1/P2)
- Fallschirm-Drop als Pilot-Interaktion komplett (Design-Gate + Galerie).

## Dependencies
- **Blocked by:** none (M1 ✅)
- **Blocks:** M5 alle Phasen (Pipeline), M4/P4 (Character-Map nutzt Bake-Output)

## Offene Resume-Punkte (P3, bei Wiederaufnahme)
- Claude Code: WAVE-3/P1 (Weiß-Artefakte Fallschirm) + P3a (struggle-b/c-Strips)
- pi (Rodgi): WAVE-3/P2 (Glide-Scale 1,5×) + P4 (Wind-Drift) + P3b (Zufallsplayer)
- Owner: Live-Test + Sign-off struggle-Frames · Org-Admin: PR #28/#29/#33
