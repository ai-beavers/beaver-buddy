# State

> Where the project stands now. Update after every meaningful action.

**Now:** **PR #52 open** — XP-Migration mit Modellgewichtung (Wave A: Reset-Entfernung, Wave B: Spec-Kurve + 5 Stufen + Migration) · **Branch `feat/xp-cap-and-settings`** — Cap-Entfernung + Settings-UI + Alterslogik-Fundament (Waves C/D/E/F1 done, 649 Tests grün) · M5 build-loop Branch (BL-1..9) gemergt: adult hat 14 Animation-Rows; young-baby/older-teen nur idle/walk
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 paused) · M3 planned · M4 P1 in-progress, P2 in-progress (Wave B implementiert) · M5 adult-animations teilweise ✅ (BL-1..9, build-loop merge), P1–P12 Stubs offen · M6 planned · Cycle-1 exit criteria: app downloadable · 100 downloads · 7 contributors (currently 3)
**Blockers:** none for the team · PR #52 waiting for review · M5/P12 young-baby/older-teen/adult volle Rows (Blocked by: Vlady / Comfy Cloud)
**Last:** Session 2026-07-23: Wave A (Reset-Entfernung, PR #52) + Wave B (Model-Gewichte γ=2, 5-Stufen-Kurve 120k, State v2, Migration) · XP-Cap aufgehoben (quadratisch unendlich, L25+ adult) · Settings-UI: Beaver-Status-Section (XP, Level, Stage, Progress-Bar, per-Modell-Cursor) · stage-capabilities.ts (canGrab/canType/roamPace) · M5 Crosscheck: 12 Phasen vollständig, adult BL-1..9 done, P9–P11 + young-baby/older-teen/adult Rows fehlen · CLAUDE.md: Agent-Hygiene-Regel (Electron-Kill nur per Pfad-Filter)
**Next:** ① Owner-Test der App (Settings + Cap-Entfernung) · ② Push `feat/xp-cap-and-settings` → PR #52 Update oder separater PR · ③ Wave F2: UI-Konzept (wartet auf Owner-Transkript) · ④ pi-agent Token-Counter Fix · ⑤ M5/P12 Dispatch an Vlady (young-baby/older-teen/adult komplette Rows)

## Recent decisions
- **Remote layout: `origin` = ai-beavers (we are contributors, maintain role); fork `rodgi040/beaver-buddy` = read-only backup, never push** — recorded in AGENTS.md — 2026-07-22
- **All committed docs in English** (owner requirement; `.planning/` translated via PR #40) — 2026-07-22
- **Multi-platform Windows + macOS native** (team meeting 2026-07-21): one Electron codebase, installers for both OSs; ADR-002 update in M1/MILESTONE.md; release pipeline (M6/P4) builds + signs both platforms; macOS signing = budget decision analogous to #4b — 2026-07-21
- **Herdr for agent detection:** M3 uses the open-source terminal tool Herdr as event source (no own detector); TokScale-**logic** 1:1 for all harnesses (Claude Code, Codex, pi) — 2026-07-21
- **5 life stages:** Baby 1–4 · young baby 5–8 · teenager 9–16 · older teenager 17–24 · adult 25–32 → M5/P12 = stage art package, pulled into Z1 — 2026-07-21
- **Model weighting:** Intelligence Index (artificialanalysis.ai), seed table 26 models (REF=45), **γ=2 quadratic** (top 1.78× / floor 0.5×; incentive for model quality); value = intelligence, not price — 2026-07-21
- **XP ≠ lifetime (for now):** main logic = XP from tokens → level; lifetime tracked separately. Curve: cumulative quadratic, TOTAL 120,000 XP (L32 ≈ day 60), interactions from L8. Spec: `Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — 2026-07-21
- Agent rule: **pi used exclusively by Rodgi; Vlady & Jurij work with Claude Code everywhere** (only MCP access: Comfy Cloud) — 2026-07-21
- Cycle 1 defined: exit = downloadable app + 100 downloads + 7 contributors; horizon ~6–8 weeks; M5 Z1 scope = P1–P5, rest post-Z1 — 2026-07-21
- Team matrix: M3 = Jurij · M4 = Rodgi · M5 = Vlady · M6 = Rodgi (everyone reviews) — 2026-07-21
- Blocker documentation mandatory: `Blocked by:` in PHASE.md + Dependencies in MILESTONE.md + overview in ROADMAP.md — 2026-07-21
- One animation per phase, 1–2 waves (WAVE-1 assets, WAVE-2 runtime) — 2026-07-20
- All asset work = Claude Code (only Comfy-Cloud-MCP); pi = runtime/logic — 2026-07-20
- No write access to ai-beavers → merges into fork `rodgi040/beaver-buddy`; upstream PRs = contribution PRs for org admin — 2026-07-19
- Planning docs stay local (gitignored) — 2026-07-17
- **XP-Cap entfernt (2026-07-23):** Level läuft über quadratische Formel unendlich weiter; L32 ist Kalibrieranker, kein Hard-Cap. L25+ bleibt adult (neue Stages via M5/P12). LEVEL_XP_THRESHOLDS-Tabelle deckt L1–L32; xpForLevel/levelForXp nutzen Formel für L33+.
- **Stage Capabilities (2026-07-23):** `stage-capabilities.ts` definiert stufenspezifisches Verhalten (canGrab, canType, roamPace). Renderer-Gates delegieren an Capabilities statt Hard-Coded-Stage-Checks. Neue Animationen = Capability-Flip.
- **Electron-Kill-Regel (2026-07-23):** Nur beaver-buddy-Instanz killen (per CommandLine-Filter), nicht alle Electron-Prozesse global — andere Apps (UltraWhisperFlow) laufen auf derselben Maschine.

<!-- Digest only. Plan lives in ROADMAP.md; task detail in PHASE.md / WAVE-X.md. -->
