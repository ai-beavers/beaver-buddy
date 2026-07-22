# Kickoff — Beaver Buddy · Zyklus 1 (Team: Rodgi, Vlady, Jurij)

> Lies das zuerst. Danach: `ROADMAP.md` → dein `Planning/Milestone-N/MILESTONE.md` → deine Phase.

## 🎯 Zyklus 1 — Ziel
**Exit-Kriterien:** ① App öffentlich downloadbar (Installer) ② 100 Downloads ③ 7 Contributors (wir sind 3)
**Horizont:** ~6–8 Wochen · **Kernfeature:** Recording Agent — der Biber erkennt via **Herdr**,
wenn ein Coding-Agent fertig ist oder Input braucht, und zeigt es an. Dazu Gamification:
Token → XP → Level 1–32 → 5 Lebenszyklen.

## 👥 Wer macht was (verbindlich)
| Person | Milestone | Agent | Erste Aufgabe |
|---|---|---|---|
| **Jurij** (Event-Logik, Technik) | M3 Recording Agent | Claude Code | **M3/P1:** Herdr evaluieren + integrieren |
| **Rodgi** (State-Logik, Features, Review) | M4 Level/XP/Profil + M6 Release | pi | **M4/P1:** Log-Reader (TokScale-Logik, nur echte Input/Output-Tokens) |
| **Vlady** (Sprite-Animationen) | M5 Animationen | Claude Code | **M5/P1:** Baum-Assets (WAVE-1) |

Regeln: **Ein Accountable pro Phase.** pi nutzt nur Rodgi; Vlady & Jurij arbeiten überall mit
Claude Code. Agenten arbeiten nur auf Anweisung des jeweiligen Phase-Owners.

## 📁 Wo liegt was
- **Diese Planung (`.planning/`, committed)** = eure Lese-Quelle. Struktur:
  - `STATE.md` — aktueller Stand (Now/Next/Blockers)
  - `ROADMAP.md` — Milestones, Phasen, **Dependency-Übersicht** (was blockiert wen)
  - `Planning/Milestone-N/MILESTONE.md` — Why, Phasen, Success, Dependencies
  - `Planning/Milestone-N/Phase-N/PHASE.md` — Done-when, Waves, **Accountable**, **Blocked by**, Dauer
  - `Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — **die XP-/Level-Spec** (Kurve, Gewichte, Stufen)
  - `Meetings/2026-07-21-planung/` — Meeting-Quelle · `Reference/` — Item-Specs #1–#64 · `Archive/`
- Master liegt lokal bei Rodgi (`.flightplan/`, gitignored); er synct hierher.

## 📐 Konventionen
- Jede Phase: **Done-when** im Header, Waves als Checkboxen, `Blocked by:` prüfen, bevor gestartet wird.
- **Eine Animation pro Phase** (M5): WAVE-1 = Assets (Claude Code/ComfyUI), WAVE-2 = Runtime (pi/Rodgi).
- Design-Gate-Verdicts → `docs/design-reviews/` · Asset-Registrierung → `docs/asset-gallery.md`.
- Code-Regeln: `CLAUDE.md` lesen (Electron-Hardening, Security, Style) — **nicht verhandelbar**.

## 🔢 XP-/Level-System in 30 Sekunden
Nur **echte Input+Output-Tokens** (kein Cache!) zählen → 5 XP pro 1.000 Tokens ×
**Modell-Gewicht** (Intelligence Index artificialanalysis.ai, **γ=2**: Top-Modell 1,78×, Floor 0,5×)
→ kumulativ quadratische Kurve, L32 = 120.000 XP ≈ Tag 60.
**5 Lebenszyklen:** Baby L1–4 · junges Baby L5–8 · Jugendlicher L9–16 · älterer Jugendlicher
L17–24 · Erwachsener L25–32. Interaktionen ab L8. Alles als Daten in der Character-Map (M4/P4).

## 🚀 Start
1. `ROADMAP.md` lesen, eigene Phase finden, `Blocked by:` prüfen (M3/P1, M4/P1, M5-Assets: **none** → sofort startbar)
2. Detail-Definition der eigenen Phase mit Rodgi abstimmen (Konvention: zu Phasenbeginn)
3. Arbeiten in Waves; STATE.md/PHASE.md-Checkboxen werden bei Abschluss aktualisiert (Rodgi synct)
