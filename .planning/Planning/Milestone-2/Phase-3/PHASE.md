# Phase 3 — Fallschirm-Drop (Interaktions-Animation)

> Part of Milestone 2. Done when: Die Interaktion „3× klicken → Biber klebt am
> Cursor (zappelnd, Overlay fängt alles ab) → Doppelklick lässt los →
> Fallschirm-Gleitflug mit Wind-Sway → saubere Landung → zurück in den
> Roam-Loop" ist vollständig implementiert, getestet, designtechnisch abgenommen
> (Design-Gate) und in `docs/asset-gallery.md` registriert. Die
> Interaktionslogik ist in `docs/interaction-model.md` dokumentiert
> (plattformneutral, macOS-portierbar).

**Status:** in-progress — **PAUSIERT 2026-07-21** (Re-Onboarding/Zyklus-1-Neuplanung; WAVE-1 ✅, WAVE-2 ✅, WAVE-3 offen. Resume: Claude Code → WAVE-3/P1+P3a, danach pi → P2/P4/P3b)

**Blocked by:** none · **Blocks:** nichts hart (Pilot-Interaktion; M5 kann parallel starten)
**Accountable:** Vlady (Assets via Claude Code) + Rodgi (Runtime via pi)

## Geklärter Scope (Owner-Entscheide 2026-07-20)

- **Klick-Erkennung:** Biber ist in **jedem** Zustand anklickbar (idle, walk,
  climb — vorerst keine Einschränkung). 3 Klicks müssen in ein **Gesamt-
  Zeitfenster von 4 Sekunden** passen (Fenster startet mit Klick 1; danach
  Reset des Zählers).
- **Grab:** Nach Klick 3 klebt der Biber am Cursor. **Zappel-Animation**
  (neues Asset, noch zu erzeugen). Roam-State-Machine pausiert.
- **Input-Capture:** Während des Grab fängt das Overlay **alle** Maus-Events
  ab — keine anderen Fenster sind klickbar, bis der Biber losgelassen wird.
- **Release:** **Doppelklick** (irgendwo) lässt den Biber an der aktuellen
  Cursor-Position los.
- **Gleitflug:** Fallschirm-Animation (8 Frames) + **prozeduraler Wind-Sway**
  (horizontale Drift + leichte Rotation, so realistisch wie möglich). Die
  Gleit-Frames werden **neu erzeugt/verbessert** (Wind-Wirkung in den Sprites
  selbst + zusätzliche Runtime-Bewegung).
- **Landung:** dedizierte, cleane **Lande-Animation** (neues Asset), danach
  nahtlos zurück in `idle` → normaler Roam-Loop.
- **Assets:** Gap-Analyse zuerst; fehlende Animationen (struggle, verbesserte
  parachute-wind, land) werden erzeugt — Studio-Keyframe-Rezepte und/oder
  ComfyUI-Generierung. Kosten/Credits sind kein Blocker (Owner).

## Waves
- [x] WAVE-1 — Assets: Gap-Analyse + **Voll-ComfyUI-Generierung** (struggle,
      parachute-wind, land) + Bake ins App-Sheet-Format
      (`assets-src/baked/beaver-baby/`, 768×480, 5 Rows) + Smoke-Test.
      Intake ins committete Sheet + Test-Reconciliation + Design-Gate → C4.
      (siehe `Waves/WAVE-1.md`)
- [x] WAVE-2 — Runtime: Input-Capture-Layer, Click-Counter (4-s-Fenster),
      `roam.ts`-State-Machine (grabbed/gliding/landing), Glide-Physik mit
      Wind-Sway, Tests, Design-Gate, Galerie + `docs/interaction-model.md`
      finalisieren (siehe `Waves/WAVE-2.md`)
- [ ] WAVE-3 — Polish nach Owner-Sichtung (2026-07-20): P1 Weiß-Artefakte
      Fallschirm (Near-White-Pass im Ingest), P2 Glide-Skalierung (Biber
      größer beim Schweben), P3 struggle-Variation (Detailplanung mit Owner),
      P4 Wind-Drift-Varianz (siehe `Waves/WAVE-3.md`)

## Notes
- Pflichten wie immer: Design-Gate-Verdict (#38) unter `docs/design-reviews/`,
  Registrierung in `docs/asset-gallery.md`.
- Interaktions-Spezifikation: `docs/interaction-model.md` (Repo, englisch) —
  Referenz auch für die spätere macOS-Implementierung.
- `roam.ts` bleibt eine reine, unit-testbare State-Machine (kein DOM/Canvas).
