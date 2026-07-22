# Milestone 4 — Level-, XP- & Profil-System

> Why it matters: Das Gamification-Rückgrat (Meeting 2026-07-21): Token-Verbrauch wird zu XP,
> XP zu Leveln 1–32 (1–16 ≈ Baby→Teen), Level schalten Interaktionen frei (ab ~Level 8).
> Lokale Persistenz ohne Auth — Account-Verknüpfung erst post-Zyklus 1.

**Status:** not-started

**Accountable:** Rodgi (State-Logik/Definition) · Jurij berät Datenmodell · **Agent:** pi · **Dauer (grob):** 3–4 Wochen (parallel zu M3)

## Fakten aus dem Meeting (verbindlich)
- XP primär aus **Input- + Output-Tokens** aller gängigen Modelle, **Cache ausgeschlossen**
  (keine Doppelzählung). Modelle können später per Intelligenz-Benchmark gewichtet werden.
- Speicherung **täglich aggregiert pro Modell** (Datum + Input/Output-Summen) — keine Rohdatenberge.
- **Lokale Konfig-Datei**, keine Auth in Z1; Migration zu Account/DB ist post-Z1 vorgesehen.
- Level-Cap **32**; Level 1–16 = erste Entwicklungsphase (Baby→Teen); schneller Fortschritt am Anfang.
- **Character-Map-JSON:** Level ↔ Sprites ↔ Animationen als erweiterbarer Contract
  (Updates ohne Neuprogrammierung).
- **Namensgebung** beim ersten Start (Pokémon-Prinzip); Marke „AI Beaver" bleibt.
- **Achievements** für Meilensteine (z. B. 7 / 30 Tage aktive Zeit).

## Phases
- [ ] Phase 1 — Token-Tracking & Aggregation: Tages-Summen pro Modell aus den Usage-Logs (#24, #25), Speicher-Schema · **Blocked by:** none (M1-Logs existieren)
- [ ] Phase 2 — XP-/Level-Modell: XP-Formel, Level-Tabelle 1–32, Stufen-Mapping (Baby/Teen/Adult), Fortschrittskurve · **Blocked by:** M4/P1
- [ ] Phase 3 — Persistenz & Profil: lokale Konfig (atomic-file), Namensgebung beim ersten Start, Achievements (7/30 Tage) · **Blocked by:** M4/P2
- [ ] Phase 4 — Character-Map-JSON: Contract Level↔Sprite-Sets↔Animationen, Loader + Validierung · **Blocked by:** M2/P1–P2 ✅ (Pipeline/Bake-Format steht)

## Success
- XP steigen nachweisbar mit Token-Verbrauch; Level-Aufstieg löst Stufen-/Interaktions-Freischaltung
  aus; Profil (Name, Level, Achievements) überlebt Restarts; Character-Map ist der einzige
  Ort, der Level↔Assets verknüpft.

## Dependencies
- **Blocked by:** none hart (P4 nutzt fertige M2-Ergebnisse)
- **Blocks:** M5 Runtime-Verdrahtung level-gekoppelter Trigger (ab P2), M6/P1 (Doku)

## Notes
- Items #24/#25 aus `.flightplan/Reference/windows-native-flight-plan.md` fließen in P1 ein;
  #26/#27 (MRR) bleiben post-Zyklus 1.
- Quelle: `.flightplan/Meetings/2026-07-21-planung/summary.md` (Level 00:54:38/01:04:16,
  XP 01:03:06, Aggregation 01:10:50, Character-Map 01:30:53, lokale Speicherung 02:11:46).
