# Phase 1 — Token-Tracking & Aggregation

> Part of Milestone 4. Done when: Täglich aggregierte Token-Summen (Input/Output, ohne
> Cache) pro Modell aus den Usage-Logs erfasst und lokal gespeichert werden (#24, #25).

**Status:** not-started (Stub — Detail-Definition zu Phasenbeginn mit Rodgi)

**Accountable:** Rodgi · **Agent:** pi
**Zyklus:** Zyklus 1
**Blocked by:** none (M1-Usage-Logs existieren) — **sofort startbar**
**Blocks:** M4/P2
**Dauer (grob):** ~1 Woche

## Waves
- [ ] WAVE-1 — Log-Reader nach TokScale-Vorbild: lokale Token-Logs finden + parsen, **nur echte Input/Output-Tokens** pro Modell (Cache-Creation + Cache-Read strikt ausgeschlossen), Tages-Aggregation
- [ ] WAVE-2 — Speicher-Schema (lokal, append-sicher, atomic-file), Edge-Cases (#24), Tests

## Notes
- Keine Rohdatenberge: nur Datum + aggregierte Werte pro Tag und Modell (Meeting 01:10:50).
- Datenquelle: **TokScale-Logik** als Vorlage fürs Finden/Auslesen der lokalen Token-Logs (Spec §1b) — eigener Reader, keine Tool-Dependency.
- Items: `Reference/windows-native-flight-plan.md` #24 (Codex-Pfade-Edge-Cases), #25 (Spike-Erkennung).
