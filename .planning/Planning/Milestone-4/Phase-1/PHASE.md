# Phase 1 — Token-Tracking & Aggregation

> Part of Milestone 4. Done when: Täglich aggregierte Token-Summen (Input/Output, ohne
> Cache) pro Modell aus den Usage-Logs erfasst und lokal gespeichert werden (#24, #25).

**Status:** in-progress — WAVE-1 an Cloud-Agent delegiert (2026-07-22, Brief: [AGENT-BRIEF.md](AGENT-BRIEF.md))

**Accountable:** Rodgi · **Agent:** Cloud-Agent (Claude Code/Codex) für WAVE-1, pi danach
**Zyklus:** Zyklus 1
**Blocked by:** none (M1-Usage-Logs existieren) — **sofort startbar**
**Blocks:** M4/P2
**Dauer (grob):** ~1 Woche

## Waves
- [ ] WAVE-1 — Log-Reader nach TokScale-Vorbild: lokale Token-Logs finden + parsen, **nur echte Input/Output-Tokens** pro Modell (Cache-Creation + Cache-Read strikt ausgeschlossen), Tages-Aggregation
- [ ] WAVE-2 — Speicher-Schema (lokal, append-sicher, atomic-file), Edge-Cases (#24), Tests

## Notes
- Keine Rohdatenberge: nur Datum + aggregierte Werte pro Tag und Modell (Meeting 01:10:50).
- Datenquelle: **TokScale-Logik** als Vorlage fürs Finden/Auslesen der lokalen Token-Logs (Spec §1b) — eigener Reader, keine Tool-Dependency. Referenz-Repo: https://github.com/junhoyeo/tokscale (**nur** logische Referenz, nicht in die Codebase committen — Details im AGENT-BRIEF).
- **Refresh-Intervall:** Reader wird von der App **alle 10 Minuten** aufgerufen → inkrementell lesen.
- **Ausblick (nicht Z1-Scope):** aggregierte Token-Verbräuche sollen später in die **Nutzer-DB des AI-Beavers-Accounts** gepusht werden → Schema push-fähig wählen, Push selbst erst später.
- Branch: `feat/token-log-reader/M4-P1` (nur eigener Code + Analyse-Doku, **kein** Merge nach main ohne Rodgi-Review).
- Items: `Reference/windows-native-flight-plan.md` #24 (Codex-Pfade-Edge-Cases), #25 (Spike-Erkennung).
