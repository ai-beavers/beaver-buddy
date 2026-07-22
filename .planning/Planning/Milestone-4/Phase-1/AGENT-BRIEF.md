# Agent-Brief — M4/P1 WAVE-1: TokScale-Analyse & Log-Reader

> **Für:** Cloud Coding Agent (Claude Code / Codex Cloud) — eigenständig ausführbar
> **Erstellt:** 2026-07-22 (Rodgi, via pi) · **Accountable:** Rodgi
> **Phase:** [M4/P1 — Token-Tracking & Aggregation](PHASE.md) · **Status-Vorgabe:** WAVE-1

## Auftrag (in einem Satz)

Analysiere das Open-Source-Repo **TokScale** als logische Referenz, dokumentiere seine
Logik sauber, und baue eine **eigene, kompatible Token-Log-Reader-Logik**, die die
Electron-App (Beaver Buddy) direkt unter **Windows und macOS** nutzen kann.

## Referenz-Repo

**https://github.com/junhoyeo/tokscale**

### ⚠️ Regeln zum Umgang mit dem Referenz-Repo (verbindlich)

1. Klone TokScale **nur in deine Cloud-Umgebung / ein Temp-Verzeichnis** —
   **NIEMALS in die Beaver-Buddy-Codebase committen.** Weder ganz noch in Teilen
   (kein Vendoring, kein Copy-paste von Code-Dateien).
2. TokScale dient ausschließlich als **logische Referenz**: Wir übernehmen das
   *Verständnis* (Wo liegen die Logs? Wie sind sie strukturiert? Wie parst man sie?),
   nicht den Code.
3. In Code und Doku nur als Referenz vermerken, z. B.:
   `// Logik angelehnt an junhoyeo/tokscale (siehe TOKSCALE-ANALYSIS.md)`

## Schritt 1 — Analyse & Doku (Deliverable A)

Untersuche das TokScale-Repo und dokumentiere in
**`.planning/Planning/Milestone-4/Phase-1/TOKSCALE-ANALYSIS.md`** (neue Datei, auf Deutsch):

- **Wo** liegen die lokalen Token-/Usage-Logs der Coding-Agent-Harnesses
  (Claude Code, Codex, pi) — jeweils **Windows- und macOS-Pfade**
- **Wie** sind die Logs strukturiert (Format, Felder, wo stehen Input-/Output-Tokens)
- **Wie** findet + parst TokScale sie (Lesereihenfolge, Rotation, Edge-Cases)
- **Abgrenzung:** Welche Token-Arten zählen — für uns relevant: **nur echte
  Input- + Output-Tokens**; Cache-Creation- und Cache-Read-Tokens sind **strikt
  ausgeschlossen** (Owner-Entscheid 2026-07-21)
- Was wir davon übernehmen / was wir bewusst anders machen

## Schritt 2 — Eigene Reader-Logik bauen (Deliverable B)

Baue eine eigene Implementierung (TypeScript, passend zur bestehenden Electron-Codebasis —
vorher **`CLAUDE.md`** und **`CONTRIBUTING.md`** lesen, Guardrails gelten):

- **Log-Discovery + Parser** für Claude Code, Codex und pi (TokScale-Logik 1:1 als
  Verhaltensreferenz, eigener Code, **keine Tool-Dependency** auf TokScale)
- **Tages-Aggregation:** nur Datum + aggregierte Input/Output-Summen pro Tag und Modell
  (keine Rohdatenberge — Meeting-Beschluss)
- **Plattformen:** Windows + macOS (Pfade, Zeilenenden, Datei-Encoding beachten)
- **10-Minuten-Refresh:** Der Reader muss so gebaut sein, dass die App ihn **alle
  10 Minuten** aufrufen kann — inkrementell/effizient (nicht jedes Mal alles neu
  einlesen; Merkzustand wie zuletzt gelesene Position/Datei vorsehen)
- **Zukunftsfähig (NICHT jetzt bauen):** Die aggregierten Daten sollen später in die
  **Nutzer-Datenbank des AI-Beavers-Accounts** gepusht werden (Token-Verbrauch pro
  Nutzer). Das Speicher-Schema so wählen, dass ein späterer Sync-Push möglich ist —
  aber **keine** Backend-/Netzwerk-Implementierung in dieser Wave und **keine**
  vorschnelle Abstraktion dafür (siehe ponytail-Skill)
- Tests nach Projekt-Standard; `tsc` + `eslint` + Test-Suite müssen grün sein

### Harte Regeln (aus CLAUDE.md / AGENTS.md)

- **Keine neuen Dependencies** ohne ausdrückliche Freigabe des Maintainers
- Electron-Hardening beachten (`nodeIntegration: false`, `sandbox: true`, Preload-Boundary)
- **Privacy:** Token-Logs sind lokale Nutzerdaten — keine Pfade/Usernamen in
  Commits, Tests oder Screenshots leaken; nichts verlässt das Gerät (der DB-Push
  kommt erst später und wird separat spezifiziert)

## Schritt 3 — Git-Workflow (verbindlich)

- Branch von `main`: **`feat/token-log-reader/M4-P1`**
- **Nur der selbst erstellte Code + die Analyse-Doku landen auf diesem Branch.**
  Das geklonte TokScale-Repo gehört **nicht** in die Codebase (siehe oben).
- **Nicht nach `main` mergen** — Branch bleibt offen, PR wird von Rodgi erstellt/
  reviewed (PR als Draft gegen `ai-beavers/beaver-buddy` ist ok)
- Commit-Format: conventional commits (`feat:`/`docs:`/…), siehe CONTRIBUTING.md

## Erfolgskriterien (Done =)

- [ ] `TOKSCALE-ANALYSIS.md` liegt vor (Wo/Wie/Abgrenzung, Win + macOS)
- [ ] Eigener Reader liest Logs von Claude Code, Codex + pi; nur echte
      Input/Output-Tokens; Tages-Aggregation pro Modell
- [ ] 10-Minuten-Aufruf ist effizient möglich (inkrementell)
- [ ] Läuft auf Windows + macOS (Pfade getestet bzw. sauber abstrahiert)
- [ ] Speicher-Schema ist später DB-push-fähig (ohne es schon zu implementieren)
- [ ] CI grün (tsc, eslint, Tests) · Branch `feat/token-log-reader/M4-P1` gepusht,
      **kein** TokScale-Code im Diff

## Offene Punkte / Kontakt

- Unklarheiten zur Spec → in der Analyse-Doku als „Offen:" vermerken, nicht raten
- Items #24 (Codex-Pfad-Edge-Cases) + #25 (Spike-Erkennung) aus
  `Reference/windows-native-flight-plan.md` beachten (gehören zu WAVE-2, aber
  bei der Analyse schon mitdenken)
