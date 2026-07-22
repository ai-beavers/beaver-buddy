# State

> Where the project stands now. Update after every meaningful action.

**Now:** **Cycle 1 fully planned, team ready** · PR #40 (Planning → ai-beavers/main): CI green, **waiting for review** · M2/P3 parachute paused (WAVE-3 open)
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 paused) · M3–M6 planned, not started · Cycle-1 exit criteria: app downloadable · 100 downloads · 7 contributors (currently 3: Rodgi, Vlady, Jurij)
**Blockers:** PR #40 — REVIEW_REQUIRED (approval by Gw3i/Org-Admin required; no code blocker)
**Last:** Session 2026-07-21: re-onboarding + Cycle 1 complete (XP spec γ=2, 5 life stages, Herdr, TokScale logic, multi-platform Win+macOS) · contributor workflow (PR #40, CI green, REVIEW_REQUIRED) · KICKOFF + agent prompts · name fix Vlady · fp-pause
**Next:** ① Request review for PR #40 (CI green, REVIEW_REQUIRED) → ② after merge: team dispatch (prompts in KICKOFF-AGENT-PROMPTS.md) → ③ Team start: **M3/P1 (Jurij) ∥ M4/P1 (Rodgi) ∥ M5/P1 assets (Vlady)** — all “Blocked by: none”. Open owner decisions: Apple account, Mac test hardware, macOS Z1 priority (NOTE.md).

## Recent decisions
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

<!-- Digest only. Plan lives in ROADMAP.md; task detail in PHASE.md / WAVE-X.md. -->
