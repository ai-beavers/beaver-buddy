# Milestone 3 — Recording Agent & Benachrichtigungen

> Why it matters: **Zentrales Zyklus-1-Feature** (Meeting 2026-07-21): Der Biber erkennt,
> wenn ein Coding-Agent seine Arbeit abgeschlossen hat oder Input braucht, und zeigt das
> visuell an — der eigentliche Nutzen des Desktop-Pets für Entwickler.

**Status:** not-started

**Accountable:** Jurij · **Agent:** Claude Code · **Dauer (grob):** 2–3 Wochen

## Architektur-Regeln (Owner-Beschluss aus Meeting + 2026-07-21)
- **Erkennung via Herdr (Owner-Beschluss 2026-07-21):** Für die Agent-Status-Erkennung
  nutzen wir **Herdr** — ein Open-Source-Terminal-Übersichtstool zum Managen mehrerer
  Coding-Agents parallel. Herdr liefert die Erkennungs-/Benachrichtigungslogik, welcher
  Coding-Agent wann fertig ist bzw. Input braucht. Wir bauen **keine eigene
  Detektionslogik**, sondern integrieren Herdr als Event-Quelle.
- **Strikte Trennung:** Ein Modul überwacht externe Agenten (Herdr-Integration),
  ein separates Modul steuert die Charakteranimation. Keine Vermischung.
- **Sicherheitsmechanismus:** Animationen dürfen nicht unbefugt manuell durch Nutzer
  ausgelöst werden (Cheat-Schutz für spätere XP-/Achievement-Relevanz).
- Darstellung startet mit dem bestehenden Bubble/Quip-System; dedizierte Animationen
  (z. B. Schild hochhalten) kommen aus M5 nach.

## Phases
- [ ] Phase 1 — Event-Erkennung via Herdr: Herdr evaluieren + integrieren (Agent fertig / Input nötig), Zustandsmodell · **Blocked by:** none
- [ ] Phase 2 — Benachrichtigungs-Darstellung: Bubble/Sign-UX bei Events, nicht-invasiv · **Blocked by:** M3/P1
- [ ] Phase 3 — Security-Gate & Härtung: manuelles Triggern unterbinden, Event↔Animation-Contract dokumentieren + Tests · **Blocked by:** M3/P1

## Success
- Biber meldet zuverlässig „Agent fertig" / „Input nötig" im Live-Betrieb; Events und
  Animation sind getrennte Module; kein manueller Auslöse-Pfad für Nutzer.

## Dependencies
- **Blocked by:** none (M1 ✅)
- **Blocks:** M5 Sign-/Event-Animationen (Darstellung), M6/P1 (Contributor-Doku dokumentiert den Event/Animation-Contract)

## Notes
- Quelle: `.flightplan/Meetings/2026-07-21-planung/summary.md` (Recording Agent 02:01:30,
  Benachrichtigungen 02:02:01, Trennung 02:05:22, Hörder 02:06:13, Sicherheitsmechanismus).
