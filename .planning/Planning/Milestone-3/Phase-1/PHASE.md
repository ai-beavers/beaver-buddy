# Phase 1 — Event-Erkennung via Herdr

> Part of Milestone 3. Done when: Die App erkennt zuverlässig die Zustände „Coding-Agent
> fertig" und „Agent wartet auf Input" — **via Herdr** (Open-Source-Terminal-Übersichtstool
> zum Managen mehrerer Coding-Agents parallel) als Event-Quelle, als eigenständiges Modul,
> getestet und ohne Kopplung an die Animationsschicht.

**Status:** not-started (Stub — Detail-Definition zu Phasenbeginn mit Jurij)

**Accountable:** Jurij · **Agent:** Claude Code
**Zyklus:** Zyklus 1
**Blocked by:** none — **sofort startbar**
**Blocks:** M3/P2, M3/P3
**Dauer (grob):** ~1–1,5 Wochen

## Waves
- [ ] WAVE-1 — Herdr evaluieren (Install/Output/API: wie meldet Herdr Agent-Status?),
  Integrations-Design, Zustandsmodell (fertig / Input nötig / läuft)
- [ ] WAVE-2 — Herdr-Adapter implementieren + Event-API/Contract definieren (Events,
  Payloads, Trennung zur Animationsschicht dokumentiert), Tests

## Notes
- Owner-Beschluss 2026-07-21: Erkennung über Herdr, KEINE eigene Detektionslogik.
- Architektur-Regel: Event-Erkennung und Charakteranimation sind strikt getrennte Module.
- Quelle: `Meetings/2026-07-21-planung/summary.md` (Recording Agent, Herdr 02:06:13).
