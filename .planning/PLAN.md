# Plan — Flightplan Re-Onboarding & Zyklus-1-Planung

> Kontext: Die alte Flightplan-Version hat `.flightplan/` nicht sauber sortiert; das Meeting
> vom 21.07.2026 (`.fp-new-projekt/MEETINGS-TRANSCRIPTS/`) definiert erstmals **Zyklus 1**,
> der in keiner Planungsdatei abgebildet ist. Die laufende M2/P3-Fallschirm-Arbeit
> (WAVE-3 bei Claude Code) wird **pausiert** und später fortgeführt.
>
> **Team (3 Contributors):**
> - **Rodgi (Owner)** — überall dabei; Schwerpunkt: Features mit aufbauen, bei Animationen
>   mithelfen, **genaue Definition der State-Logik**; Gesamt-Review & Owner-Entscheide
> - **Vlady** — **Sprite-Animationen** (steuert Claude Code/ComfyUI-Generierung, Asset-Review)
> - **Jurij** — **Event-Logik & hart Technisches** (State Machine, Tracking, IPC, Architektur)
> - **Agenten-Regel (verbindlich): pi = nur Rodgi** · **Claude Code = Vlady & Jurij, überall**
>   (nicht nur Assets; weiterhin einziger Agent mit Comfy-Cloud-MCP)
>
> Aufgaben werden so verteilt, dass sich die Arbeit nicht überschneidet:
> genau **ein menschlicher Accountable pro Phase**, parallele Arbeit nur an disjunkten Phasen.

## Schritt 0 — Laufende Phase sauber pausieren (fp-pause)

- `HANDOFF.md` umschreiben: Status „WAVE-3 PAUSIERT (Owner-Beschluss)". Resume-Pfad
  exakt dokumentieren: Claude Code macht später P1 (Weiß-Artefakte) + P3a (struggle-b/c)
  via `/fp-resume` weiter; pi danach P2/P4/P3b. Spec bleibt `WAVE-3.md`.
- `STATE.md`: Now/Next auf „Re-Onboarding & Zyklus-1-Planung" setzen; P3 als „pausiert".
- `Planning/Milestone-2/Phase-3/PHASE.md`: Status → `in-progress (pausiert)`.

## Schritt 1 — Aufräumen & Migration (Re-Onboarding)

Ziel-Struktur (alles lokal/gitignored, Konvention bleibt):

```
.flightplan/
  STATE.md · ROADMAP.md · HANDOFF.md · NOTE.md
  Meetings/2026-07-21-planung/   ← Transkript-Rohtext + Zusammenfassung + Animations-Rohtext
  Reference/windows-native-flight-plan.md   ← aktive Item-Quelle #1–#64
  Archive/                        ← .fp-new-projekt-Restbestand (phase-*.md, plans/, …)
  Planning/Milestone-N/Phase-N/…  (unverändert)
  Reviews/ · Debugging/
```

- `MEETINGS-TRANSCRIPTS/` → `.flightplan/Meetings/2026-07-21-planung/` (Dateinamen
  normalisieren: `transcript-raw.md`, `summary.md`, `animations-rohtext.md`).
- `windows-native-flight-plan.md` → `.flightplan/Reference/`.
- Rest von `.fp-new-projekt/` → `.flightplan/Archive/`; danach `.fp-new-projekt/` löschen.
- **Referenzen aktualisieren:** ROADMAP.md, MILESTONE.md (M1–M4), NOTE.md; `.gitignore` prüfen.
- **NOTE.md bereinigen:** F2 als erledigt markieren; Inbox-Dubletten entfernen; neue
  Meeting-Items als Inbox aufnehmen (Level/XP, Recording Agent, Namensgebung, Achievements,
  Prestige, Sicherheitsmechanismus, Account-Verknüpfung später, kosmetische Monetarisierung).
- **Debugging/README.md** fixen (Verweis auf nicht-existentes `Planning/Debugging/`).

## Schritt 2 — Zyklus-1 in ROADMAP.md verankern

- **Zyklus-1-Header** mit Exit-Kriterien (Meeting 21.07.):
  1. Funktionierende, herunterladbare App (Windows-Installer)
  2. 100 Downloads
  3. 7 zusätzliche Contributors (aktuell: 3 — Owner, Vladi, Juri)
- Jeder Milestone erhält Zyklus-Markierung + **Owner-Feld** (Team-Verantwortlicher).
- Referenzblock (Quelle: `Meetings/…/summary.md`): XP = Input+Output-Tokens (ohne Cache),
  tagesaggregiert pro Modell, lokale Konfig-Datei (keine Auth in Z1), Level 1–32
  (1–16 ≈ Baby→Teen), Interaktionen ab ~Level 8, Prestige post-Z1, Character-Map-JSON,
  Trennung Ereignislogik ↔ Charakteranimation.

## Schritt 3 — Milestones gemeinsam definieren (Team-Walkthrough)

**Reihenfolge (Option B, aus Meeting-Signalen + Abhängigkeiten abgeleitet — Draft,
wird im Walkthrough finalisiert) — mit Team-Zuordnung:**

| # | Milestone | Kern | Accountable | Agent | Zyklus |
|---|---|---|---|---|---|
| M1 | Windows-native App ✅ | done | Rodgi | pi | Z1 (erledigt) |
| M2 | Asset-Pipeline & Animationen | P1/P2 ✅ · **P3 Fallschirm pausiert** | Vlady + Rodgi | Claude Code (+ pi) | laufend |
| M3 | Recording Agent & Benachrichtigungen | Zentrales Z1-Feature: Event-Erkennung (Agent fertig/Input nötig), Event↔Animation strikt getrennt, Sicherheitsmechanismus; Darstellung zunächst via Bubble/Quip | **Jurij** | Claude Code | Z1 |
| M4 | Level-, XP- & Profil-System | Token-Tracking (aggregiert/pro Modell), XP-Prototyp, Level-Tabelle 1–32, State-Logik der Stufen, Character-Map-JSON, lokale Persistenz, Namensgebung, Achievements | **Rodgi** (Jurij berät Datenmodell) | pi | Z1 |
| M5 | Animationen (Rest) | ehem. M2 P4–P15 — „eine Animation pro Phase“; WAVE-1 Assets = Vlady + Claude Code, WAVE-2 Runtime = Rodgi + pi | **Vlady** | Claude Code | Z1 (gestaffelt) |
| M6 | Contribution-Readiness & Release | Contributor-/API-/Asset-Builder-Doku, Settings/Tray, QA-Gates, Release-Pipeline → **Z1-Exit** | **Rodgi** (alle reviewen) | pi | Z1 |
| — | Post-Zyklus 1 | Auth/Account, Prestige, Monetarisierung, MRR #26, Quips/State-Machine-Erweiterungen, Owner-Entscheide #3/#4b/#63/#64 | — | — | post |

**Vorgehen im Walkthrough (interaktiv mit dem Team):**
1. Milestone-Reihenfolge bestätigen/anpassen (Tabelle oben).
2. Pro Milestone: Zweck in 2–3 Sätzen (team-verständlich) + Phasen-Liste definieren.
   Phasen bleiben bewusst grob; Detail-Definition wie gehabt zu Phasenbeginn.
3. **Zeitschätzung:** pro Phase grobe Größe (S/M/L + Tage-Schätzung), Milestone-Dauer
   daraus aggregiert; Realitäts-Check gegen Z1-Zeithorizont (~2 Monate laut Meeting).
4. **Team-Matrix (verbindlich):** siehe Tabelle — Jurij = M3, Rodgi = M4 + M6,
   Vlady = M5. Regeln: genau ein Accountable pro Phase; Rodgi hilft überall mit,
   ist aber nie versteckter Zweit-Owner. **Agenten-Regel: pi nutzt ausschließlich
   Rodgi; Vlady & Jurij arbeiten in allen Milestones mit Claude Code.** Agenten
   arbeiten nur auf Anweisung des jeweiligen Phase-Owners.
5. **Blocker-/Abhängigkeits-Dokumentation (Pflicht, direkt in Flightplan):**
   - Jede `PHASE.md` bekommt Pflichtfeld **`Blocked by:`** (Phasen-Liste oder „none“, mit Grund).
   - Jede `MILESTONE.md` bekommt Abschnitt **Dependencies** (blocked by / blocks).
   - `ROADMAP.md` enthält eine kompakte **Dependency-Übersicht** (Tabelle), damit das
     Team auf einen Blick sieht, was wen blockiert.
   - `STATE.md`-Blockers-Feld bleibt die kurze operative Sicht.
6. Ergebnis in `ROADMAP.md` + `Planning/Milestone-N/MILESTONE.md` (Why/Phases/Success/
   Owner/Dauer/Dependencies) schreiben; alte M3/M4 auflösen und Items umhängen.

## Schritt 4 — Verifikation & Handoff

- Selbst-Check: alle `.fp-new-projekt`-Verweise aufgelöst? ROADMAP schlank? NOTE.md ohne
  Dubletten? STATE/HANDOFF konsistent? Jede Phase hat genau einen Owner?
- `STATE.md` final: „Re-Onboarding done · Zyklus 1 definiert · M2/P3 pausiert" +
  Next = erste Phase des ersten neuen Milestones detaillieren.
- Kein Code-Eingriff, keine Git-Commits (Planungsdateien sind gitignored).

## Ausführung

- Schritte 0–2: `worker`-Subagent + `reviewer`-Check, Orchestrator verifiziert Referenzen.
- Schritt 3: interaktiv mit dem Team (kein Subagent — Entscheidungen gehören den Menschen);
  Agent schreibt die Ergebnisse nach Freigabe in die Dateien.
- Schritt 4: `reviewer`-Subagent als finaler Konsistenz-Check.
