# Handoff

> Full resume context. Written by `/fp-pause`, read by `/fp-resume`. `STATE.md` is the short digest;
> this file is the complete picture so the next session loses no context.

**Last updated:** 2026-07-21 (pi, fp-pause — Planungssession sauber beendet)

## current_state
**Zyklus 1 ist vollständig geplant, das Team kann starten.** Re-Onboarding von `.flightplan/`
abgeschlossen, Planung committed unter `.planning/` (Team-Snapshot; `.flightplan/` bleibt lokaler
gitignorter Master). **PR #40** (vendored skills + Zyklus-1-Planning → `ai-beavers/main`):
**CI ubuntu + windows GRÜN ✅, Status: `REVIEW_REQUIRED`** — Merge wartet auf Approval
(Gw3i/Org-Admin; Rodgi kann nicht selbst approven). Branch `chore/zyklus1-planning` auf
upstream ist der aktuelle Stand (`4b55734`); Fork-main gesynct. Working Tree sauber.
**M2/P3 Fallschirm:** weiterhin offiziell pausiert (WAVE-1/2 ✅ upstream gemergt via PR #33,
WAVE-3 Polish offen → Resume später, Claude Code).

## completed (Session 2026-07-21)
- **Re-Onboarding:** `.fp-new-projekt/` aufgelöst → `Meetings/2026-07-21-planung/`,
  `Reference/windows-native-flight-plan.md`, `Archive/`; alle Pfad-Referenzen aktualisiert;
  `.gitignore` bereinigt; Debugging-README gefixt; NOTE.md ent-dublettiert (F1/F2 erledigt)
- **Zyklus 1 definiert:** Exit-Kriterien (App downloadbar · 100 Downloads · 7 Contributors);
  ROADMAP mit M1–M6 + Team-Matrix + Dependency-Übersicht; 11 neue PHASE.md-Stubs mit
  Pflichtfeldern (`Accountable`, `Blocked by:`, `Blocks:`, `Dauer`); M2/P4–P15 → M5/P1–P12 umgezogen
- **Team-Matrix:** Jurij = M3 (Recording Agent) · Rodgi = M4 (Level/XP) + M6 (Release) ·
  Vlady = M5 (Animationen) · Agenten-Regel: **pi = nur Rodgi, Claude Code = Vlady & Jurij**
- **XP-/Level-Spec** (`Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md`): nur echte
  Input+Output-Tokens (Cache strikt raus), 5 XP/1k, Kurve kumulativ quadratisch TOTAL 120.000
  (L32 ≈ Tag 60, Referenz 400k Tokens/Tag), **γ=2** Modell-Gewichtung via Artificial Analysis
  Intelligence Index (Seed-Tabelle 26 Modelle aus Owner-Screenshot, REF=45, Top 1,78× / Floor 0,5×),
  Lebenszeit-Tracking getrennt von XP
- **5 Lebenszyklen:** Baby L1–4 · junges Baby L5–8 · Jugendlicher L9–16 · älterer Jugendlicher
  L17–24 · Erwachsener L25–32 → M5/P12 als Stufen-Art-Paket in Z1-Scope gezogen
- **M3:** Herdr als Erkennungslogik (statt eigener Detektion) · **M4/P1:** TokScale-**Logik**
  1:1 für alle Harnesses (Claude Code, Codex, pi), eigener Reader, kein Tool-Dependency
- **Multiplattform-Beschluss** (Teambesprechung): Windows + macOS nativ; ADR-002-Update (M1),
  M6/P4 mit macOS-Targets/Signing/CI-Runner
- **Contributor-Workflow:** Merge upstream/main (41 Commits: BL-17, BL-18/19 Typing-Animation),
  Konflikte sauber aufgelöst (package.json Union, AGENTS.md Guardrails + .planning-Sektion),
  Verifikation tsc/eslint/573 Tests ✓; Direct-Push → Branch-Protection (PR + CI erzwungen) →
  **PR #40 erstellt**, CI grün, REVIEW_REQUIRED; `KICKOFF.md` + `KICKOFF-AGENT-PROMPTS.md`
- **Namensfix:** Vady → **Vlady** (21 Dateien + PLAN.md, verifiziert 0 Rest-Treffer)

## remaining (in Reihenfolge)
1. **Rodgi:** Review für PR #40 anfragen (Gw3i/Org-Admin) → nach Merge: **Team-Dispatch**
   (Prompts aus `.planning/KICKOFF-AGENT-PROMPTS.md` an Vlady + Jurij)
2. **Team-Start (parallel, „Blocked by: none"):** Jurij = M3/P1 (Herdr-Evaluierung) ·
   Rodgi = M4/P1 (Log-Reader TokScale-Logik) · Vlady = M5/P1 (Baum-Assets)
3. **Offene Owner-Entscheide (NOTE.md):** Apple-Developer-Account (~99 $/Jahr) ·
   macOS-Testhardware im Team · macOS gleichwertig zum Z1-Launch? · #3/#4b/#63/#64
4. **Später:** M2/P3-WAVE-3-Resume (Claude Code) · M5/P2-Scope gegen BL-18/19 abgleichen
   (Typing-Animation existiert bereits upstream) · `feature/animation-authoring-docs`-PR prüfen
   · BL-7-Verdict · Kalibrierung XP-Konstante nach 1 Woche M4/P1-Daten

## decisions (Owner, verbatim)
- „pi = nur ich; Vlady & Jurij überall mit Claude Code" — 2026-07-21
- „Blocker direkt in der Flightplan-Doku notieren, welche Phase welche blockiert" — 2026-07-21
- „XP und Lebenszeit getrennt; Hauptlogik = XP-Punkte → Level" — 2026-07-21
- „Nur Input- und Output-Tokens zählen, kein Cache/Cache-Read" — 2026-07-21
- „γ = 2" (Spreizung Modell-Gewichtung; Wert = Intelligenz, nicht Token-Preis) — 2026-07-21
- „5 Lebenszyklen: Baby, junges Baby, Jugendlicher, etwas älterer Jugendlicher, Erwachsener" — 2026-07-21
- „TokScale-Logik 1:1 nutzen für das Fetchen der lokalen Token-Logs, alle Coding-Agent-Harnesses" — 2026-07-21
- „Für die Erkennung wollen wir Herdr nutzen" (Open-Source-Terminal-Übersichtstool) — 2026-07-21
- „Elektron-App direkt als Multiplattform-App nativ für Windows und macOS" (Teambesprechung) — 2026-07-21
- „Fallschirm-Resume: erst später!" — 2026-07-21

## blockers
- **PR #40: REVIEW_REQUIRED** — Merge braucht Approval (Gw3i/Org-Admin). Kein Code-Blocker;
  Team kann schon vom Branch `chore/zyklus1-planning` lesen.

## next_action
**Review für PR #40 anfragen** (CI grün) → nach Merge: Prompts aus
`.planning/KICKOFF-AGENT-PROMPTS.md` an Vlady (M5/P1) und Jurij (M3/P1) schicken;
Rodgi startet M4/P1 via `/fp-resume`.
