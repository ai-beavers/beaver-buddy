# Phase 12 — Stufen-Art-Paket: junges Baby, älterer Jugendlicher, Erwachsener (#7)

> Part of Milestone 5. Done when: Alle 5 Lebenszyklen haben eigene finale Art —
> **junges Baby** (L5–8), **älterer Jugendlicher** (L17–24) und **Erwachsener** (L25–32,
> kein Teen-Upscale-Placeholder mehr) sind generiert, gebacken und registriert.
> Baby + Jugendlicher existieren bereits.

**Status:** not-started

**Hintergrund (Owner-Beschluss 2026-07-21):** 5 Lebenszyklen statt 3 — deshalb ist diese
Phase vom „Adult-Art-Polish" zum **Stufen-Art-Paket** gewachsen und wurde in den
Z1-Scope gezogen (Nutzer erreichen Erwachsener ~Tag 37, innerhalb des Z1-Horizonts).

## Waves
- [ ] WAVE-1 — Fehlende Stufen-Parts generieren (junges Baby, älterer Jugendlicher,
  Erwachsener: größere Proportionen, gleicher Style), riggen, backen
- [ ] WAVE-2 — Placeholder-Pipeline (`build-adult-placeholder.ts`) ablösen, Stufen in
  Character-Map (M4/P4) verdrahten, Design-Gate, Galerie-Update

## Notes
- Abhängig vom angepassten ComfyUI-Workflow (M2/P2 ✅) — deshalb als letzte Phase des Milestones einsortiert.
- Aktueller Placeholder: byte-deterministischer Teen-Upscale (npm run assets:adult-placeholder), dokumentiert in `assets/STYLE.md` + `docs/asset-gallery.md`.

**Accountable:** Vlady (Assets via Claude Code; Runtime: Rodgi + pi)
**Zyklus:** Zyklus 1 (nachgezogen 2026-07-21)
**Blocked by:** M2/P2 ✅ (Workflow steht) · Verdrahtung der Stufen zusätzlich: M4/P2 + M4/P4 (Level-Grenzen + Character-Map)
**Dauer (grob):** ~2 Wochen (3 Stufen-Sets statt 1)
