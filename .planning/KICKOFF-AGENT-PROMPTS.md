# Agent-Start-Prompts — Team Kickoff Zyklus 1

> Ready-to-paste Prompts für Vladys und Jurijs Claude-Code-Sessions.
> Stand: 2026-07-21. Voraussetzung: Repo-Klon mit dem Stand aus PR #40
> (`.planning/` muss im Checkout vorhanden sein).

## Prompt für Vlady (Claude Code) — M5 Animationen

```
Du arbeitest am Projekt Beaver Buddy (Electron Desktop-Pet, Pixel-Art-Biber).
Lies ZUERST in dieser Reihenfolge:
1. CLAUDE.md (Projekt-Regeln, nicht verhandelbar)
2. .planning/KICKOFF.md (Zyklus 1, Team, Konventionen)
3. .planning/ROADMAP.md (Milestones + Dependency-Übersicht)
4. .planning/Planning/Milestone-5/MILESTONE.md + Milestone-5/Phase-1/PHASE.md

Deine Rolle: Du bist Vladys Coding-Agent für MILESTONE 5 (Sprite-Animationen).
Du bist der einzige Agent mit Comfy-Cloud-MCP — ALLE Asset-Arbeit läuft über dich.
Konvention: eine Animation pro Phase, WAVE-1 = Assets (du), WAVE-2 = Runtime (pi/Rodgi).

Deine erste Aufgabe: M5/Phase-1 (Baum pflanzen & gießen, #15) — WAVE-1 Assets:
Gap-Analyse (was existiert in assets-src/parts/ und tools/puppet-studio/rigs/tree.json?),
fehlende Frames per ComfyUI-Workflow generieren, über das Puppet Studio backen,
Smoke-Test. Referenzen: assets-src/reference/, .planning/Reference/windows-native-flight-plan.md (#15).
Blocked by: nichts — sofort startbar. Detail-Definition stimmt du mit Rodgi ab, bevor du loslegst.
Niemals .planning/-Dateien selbst ändern; Status-Updates laufen über Rodgi.
```

## Prompt für Jurij (Claude Code) — M3 Recording Agent

```
Du arbeitest am Projekt Beaver Buddy (Electron Desktop-Pet, Pixel-Art-Biber).
Lies ZUERST in dieser Reihenfolge:
1. CLAUDE.md (Projekt-Regeln, nicht verhandelbar)
2. .planning/KICKOFF.md (Zyklus 1, Team, Konventionen)
3. .planning/ROADMAP.md (Milestones + Dependency-Übersicht)
4. .planning/Planning/Milestone-3/MILESTONE.md + Milestone-3/Phase-1/PHASE.md

Deine Rolle: Du bist Jurijs Coding-Agent für MILESTONE 3 (Recording Agent &
Benachrichtigungen) — das zentrale Zyklus-1-Feature.

Deine erste Aufgabe: M3/Phase-1 (Event-Erkennung via Herdr):
Evaluiere das Open-Source-Tool Herdr (Terminal-Übersicht für parallele Coding-Agents):
Wie installiert man es, wie meldet es Agent-Status (fertig / wartet auf Input / läuft)?
Entwerfe das Zustandsmodell + Integrations-Design (Herdr-Adapter als eigenes Modul,
strikt getrennt von der Animationsschicht). Ergebnis: Evaluierungs-Doku + Adapter-Design,
danach Implementierung mit Tests (Vitest, Regeln in CLAUDE.md).
Blocked by: nichts — sofort startbar. Detail-Definition stimmt du mit Rodgi ab, bevor du loslegst.
Niemals .planning/-Dateien selbst ändern; Status-Updates laufen über Rodgi.
```

## Prompt für Rodgi (pi) — M4 Level/XP (Referenz)

```
/fp-resume → .planning/Planning/Milestone-4/Phase-1/PHASE.md lesen +
Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md (Spec).
Aufgabe M4/P1: Log-Reader nach TokScale-Logik — lokale Token-Logs aller Harnesses
(Claude Code, Codex, pi) finden + parsen; NUR echte Input/Output-Tokens
(Cache-Creation + Cache-Read strikt rausfiltern); Tages-Aggregat pro Modell;
Speicher via atomic-file; Tests gegen Fixture-Logs.
```
