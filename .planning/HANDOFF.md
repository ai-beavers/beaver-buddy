# Handoff

> Full resume context. Written by `/fp-pause`, read by `/fp-resume`. `STATE.md` is the short digest;
> this file is the complete picture so the next session loses no context.

**Last updated:** 2026-07-21 (pi-Session: Re-Onboarding & Zyklus-1-Neuplanung abgeschlossen; M2/P3-Fallschirm offiziell pausiert)

## ⚡ Rollen-Split (Owner-Beschluss 2026-07-21, aktualisiert)

- **pi = ausschließlich Rodgi** (Runtime/Logik, M4, M6)
- **Claude Code = Vady & Jurij, in allen Milestones** (Assets via Comfy-Cloud-MCP + Runtime)
- Team-Matrix: **M3 = Jurij** (Recording Agent) · **M4 = Rodgi** (Level/XP/Profil) ·
  **M5 = Vady** (Animationen) · **M6 = Rodgi** (Contribution & Release)
- Regel: genau ein Accountable pro Phase; Blocker stehen im `Blocked by:`-Feld jeder
  PHASE.md + Dependency-Tabelle in ROADMAP.md.

## current_state
**Re-Onboarding done.** `.fp-new-projekt/` ist aufgelöst:
`Meetings/2026-07-21-planung/` (transcript-raw, summary, animations-rohtext),
`Reference/windows-native-flight-plan.md` (Items #1–#64), `Archive/` (alte phase-*/plans/).
ROADMAP neu: Zyklus-1-Exit (App downloadbar · 100 Downloads · 7 Contributors), M1–M6,
Dependency-Übersicht. Alte M3/M4 aufgelöst: #19–#23 + #26/#27 + #28–#32 → post-Z1;
#24/#25 → M4/P1; #33–#45 → M6.
**M2/P3 Fallschirm: PAUSIERT** (WAVE-1 ✅, WAVE-2 ✅, WAVE-3 offen).
**Git/PRs (Stand, unverändert):** BL-17 = 8 Commits; PR #33 (C2–C4) offen; PR #28/#29
offen; Branch `feature/animation-authoring-docs` (`3bb1892`) ohne PR. Suite: 500 Tests grün.

## Neuplanung Zyklus 1 (2026-07-21, mit Owner finalisiert)
- **M3 Recording Agent & Benachrichtigungen** (Jurij, 2–3 W): P1 Event-Erkennung
  (Hörder-Logik) → P2 Darstellung (Bubble/Sign) → P3 Security-Gate. Architektur-Regel:
  Event-Erkennung und Animation strikt getrennt; kein manuelles Triggern durch Nutzer.
- **M4 Level-, XP- & Profil-System** (Rodgi, 3–4 W, parallel): P1 Token-Tracking
  (täglich aggregiert/pro Modell, Input+Output ohne Cache) → P2 XP/Level-Modell
  (1–32, 1–16 ≈ Baby→Teen) → P3 Persistenz+Profil (Name, Achievements 7/30 Tage) →
  P4 Character-Map-JSON. Lokal, keine Auth in Z1.
- **M5 Animationen** (Vady, ~1 W/Animation): Z1-Scope = P1–P5 (Baum, Coding, Drinks,
  Schlaf, Stretch); P6–P12 post-Z1. Assets können sofort starten (M2/P1–P2 ✅);
  Runtime-Trigger level-gekoppelt ← M4/P2.
- **M6 Contribution & Release** (Rodgi, ~2 W): P1 Doku ← M3/M4 · P2 Settings/Tray ·
  P3 QA ← M5-Z1 · P4 Release-Pipeline → Z1-Exit.
- Zeithorizont: ~6–8 Wochen bei paralleler Arbeit.

## remaining (in Reihenfolge)
1. **Team-Start (alle parallel, „Blocked by: none"):** M3/P1 (Jurij) · M4/P1 (Rodgi) ·
   M5/P1-Assets (Vady). Detail-Definition jeder Phase zu Phasenbeginn mit Owner.
2. **M2/P3-Resume einplanen** (Claude Code: WAVE-3/P1 Weiß-Artefakte + P3a struggle-b/c;
   pi/Rodgi: P2 Glide-Scale, P4 Wind-Drift, P3b Zufallsplayer; Spec: `Milestone-2/Phase-3/Waves/WAVE-3.md`)
3. ~~Org-Admin: PR #28/#29/#33 mergen~~ ✅ erledigt (gemergt, Stand 2026-07-21); **PR #40 (Planning) wartet auf CI + Review/Merge**
4. PR für `feature/animation-authoring-docs` erstellen (Branch prüfen: Inhalte ggf. schon via upstream drin)
5. **M5/P2 Coding-Animation neu definieren:** Upstream hat BL-18/BL-19 (Typing/Working-Animation + Settings-Trigger) bereits gebaut — Scope-Abgleich zu Phasenbeginn mit Rodgi + Vady

## decisions (Owner, verbatim) — neue oben
- „Contributor-Zugang da → auf main pushen/mergen versuchen“ → Ergebnis: Branch-Protection erzwingt PR + CI; Workflow jetzt: Branch direkt auf `upstream` pushen + PR gegen `ai-beavers/main` (kein Fork-Umweg mehr nötig) — 2026-07-21
- „pi = nur ich; Vady & Jurij überall mit Claude Code" — 2026-07-21
- „Blocker direkt in der Flightplan-Doku notieren, welche Phase welche blockiert" — 2026-07-21
- Zyklus-1-Priorisierung: Recording Agent (zentral) → XP/Level → Animationen gestaffelt → Release — 2026-07-21
- Ältere Owner-Entscheide (Fallschirm-Interaktion, 1,5× Glide, struggle-Varianten,
  Contribution-PR-Modell, `--no-ff` + Tags): siehe Archiv-HANDOFF-History bzw. WAVE-3.md

## blockers
none — Hinweise: Comfy-Cloud-MCP nur in Claude Code; `npx` in pi geblockt → lokale
`./node_modules/.bin/`-Binaries; CDP-Live-Screenshots hingen in pi → manuell durch Owner.

## next_action
**Team-Kickoff Zyklus 1:** Jurij definiert M3/P1 (Event-Erkennung), Rodgi definiert
M4/P1 (Token-Tracking), Vady startet M5/P1-Assets (Baum) mit Claude Code.
Bei pi-Resume (Rodgi): M4/P1 Detail-Definition → Waves anlegen.
Bei Claude-Code-Resume (Vady): entweder M5/P1-Assets oder M2/P3-WAVE-3 (Weiß-Artefakte
+ struggle-Strips) — Owner-Priorität: M5/P1.
