# State

> Where the project stands now. Update after every meaningful action.

**Now:** **Re-Onboarding & Zyklus-1-Neuplanung done (2026-07-21)** — `.fp-new-projekt/` migriert (Meetings/Reference/Archive), ROADMAP mit Zyklus-1-Exit-Kriterien + Team-Matrix + Dependency-Übersicht neu geschnitten (M1–M6). **M2/P3 Fallschirm PAUSIERT** (WAVE-3, Resume via Claude Code).
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 pausiert) · M3–M6 geplant, nicht gestartet · Zyklus-1-Exit-Kriterien: App downloadbar · 100 Downloads · 7 Contributors (aktuell 3: Rodgi, Vady, Jurij)
**Blockers:** none
**Last:** Session 2026-07-21 (2/2): **Contributor-Zugang zu ai-beavers ✅** — Direct-Push auf main scheitert an Branch-Protection (PR + CI-Check erforderlich) → **PR #40** (vendored skills + Zyklus-1-Planning) gegen upstream offen, CI läuft. Fork-main gesynct (`a12b6ca`). **Upstream hat sich bewegt:** PR #28/#29/#33 gemergt ✅ (Fallschirm C1–C4 drin) + **BL-18/BL-19: Typing/Working-Animation mit Settings-Trigger bereits gebaut** ⚠️ (Overlap mit M5/P2 — Phase zu Phasenbeginn neu definieren). Merge-Konflikte (package.json Union, AGENTS.md Guardrails+.planning) sauber aufgelöst, 573 Tests ✓
**Next:** Team-Start: **M3/P1 (Jurij) ∥ M4/P1 (Rodgi) ∥ M5/P1-Assets (Vady)** — alle „Blocked by: none", sofort startbar. Detail-Definition der ersten Phasen zu Phasenbeginn mit dem jeweiligen Owner. Danach: M2/P3-Resume einplanen (Claude Code: WAVE-3/P1+P3a; pi: P2/P4/P3b).

## Recent decisions
- **Multiplattform Windows + macOS nativ** (Teambesprechung 2026-07-21): eine Electron-Codebasis, Installer für beide OS; ADR-002-Update in M1/MILESTONE.md; Release-Pipeline (M6/P4) baut + signiert beide Plattformen; macOS-Signing = Budget-Entscheid analog #4b — 2026-07-21
- **Herdr für Agent-Erkennung:** M3 nutzt das Open-Source-Terminal-Tool Herdr als Event-Quelle (kein eigener Detektor); TokScale-**Logik** 1:1 für alle Harnesses (Claude Code, Codex, pi) — 2026-07-21
- **5 Lebenszyklen:** Baby 1–4 · junges Baby 5–8 · Jugendlicher 9–16 · älterer Jugendlicher 17–24 · Erwachsener 25–32 → M5/P12 = Stufen-Art-Paket, in Z1 gezogen — 2026-07-21
- **Modell-Gewichtung:** Intelligence Index (artificialanalysis.ai), Seed-Tabelle 26 Modelle (REF=45), **γ=2 quadratisch** (Top 1,78× / Floor 0,5×; Anreiz für Modell-Qualität); Wert = Intelligenz, nicht Preis — 2026-07-21
- **XP ≠ Lebenszeit (vorerst):** Hauptlogik = XP aus Tokens → Level; Lebenszeit separat getrackt. Kurve: kumulativ quadratisch, TOTAL 120.000 XP (L32 ≈ Tag 60), Interaktionen ab L8. Spec: `Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — 2026-07-21
- Agenten-Regel: **pi nutzt ausschließlich Rodgi; Vady & Jurij arbeiten überall mit Claude Code** (einziger MCP-Zugang: Comfy Cloud) — 2026-07-21
- Zyklus 1 definiert: Exit = downloadbare App + 100 Downloads + 7 Contributors; Horizont ~6–8 Wochen; M5-Z1-Scope = P1–P5, Rest post-Z1 — 2026-07-21
- Team-Matrix: M3 = Jurij · M4 = Rodgi · M5 = Vady · M6 = Rodgi (alle reviewen) — 2026-07-21
- Blocker-Dokumentation Pflicht: `Blocked by:` in PHASE.md + Dependencies in MILESTONE.md + Übersicht in ROADMAP.md — 2026-07-21
- Eine Animation pro Phase, 1–2 Waves (WAVE-1 Assets, WAVE-2 Runtime) — 2026-07-20
- Alle Asset-Arbeit = Claude Code (einziger Comfy-Cloud-MCP); pi = Runtime/Logik — 2026-07-20
- Kein Write-Zugang auf ai-beavers → Merges in Fork `rodgi040/beaver-buddy`; upstream-PRs = Contribution-PRs für Org-Admin — 2026-07-19
- Planungsdoku bleibt lokal (gitignored) — 2026-07-17

<!-- Digest only. Plan lives in ROADMAP.md; task detail in PHASE.md / WAVE-X.md. -->
