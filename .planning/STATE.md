# State

> Where the project stands now. Update after every meaningful action.

**Now:** M3/P1 WAVE-1 — Herdr evaluation and integration planning — is owner-approved and ready for Jurij's cloud agent. The wave must identify active coding agents and evidence-backed states before any Beaver Buddy integration is implemented.
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 paused) · M3 P1 WAVE-1 ready / WAVE-2 gated on review · M4 P1 WAVE-1 ✅ / WAVE-2 open, M4 P2 ✅ · M5 adult asset rows P1–P10 present · M6 planned · Cycle-1 exit criteria: downloadable app · 100 downloads · 7 contributors (currently 3)
**Blockers:** none for Herdr research · integration may require separate approval if Herdr must become a project dependency, bundled executable, network service or privileged process · local `main` is three commits behind `origin/main` and the synchronized documentation diff is uncommitted
**Last:** 2026-07-26 — synchronized product/planning docs against fetched upstream state; corrected M4/M5 status; selected M3 Herdr as the next focus; defined the research-only WAVE-1 and resume handoff.
**Next:** In a cloud-agent session run `/fp-resume`, create a fresh research branch/worktree from fetched `origin/main`, and execute `.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md` without adding a Beaver Buddy dependency or implementation code.

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
- **XP cap removed (2026-07-23):** Levels continue indefinitely through the quadratic formula; L32 is a calibration anchor, not a hard cap. L25+ remains adult. The exact table covers L1–L32; `xpForLevel`/`levelForXp` use the formula for L33+.
- **Stage capabilities (2026-07-23):** `stage-capabilities.ts` defines stage-specific behavior (`canGrab`, `canType`, `roamPace`). Renderer gates delegate to capabilities instead of hard-coded stage checks.
- **Electron process rule (2026-07-23):** Stop only the Beaver Buddy instance by CommandLine path filter, never all Electron processes globally.
- **Direct upstream PRs (2026-07-23):** Work targets `ai-beavers/beaver-buddy` directly; the personal fork is a read-only backup.
- **M5 asset batch (2026-07-23):** PRs #53–#58 merged the adult P1–P10 asset rows and their design evidence; phase runtime completion is tracked separately.

<!-- Digest only. Plan lives in ROADMAP.md; task detail in PHASE.md / WAVE-X.md. -->
