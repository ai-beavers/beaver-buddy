# State

> Where the project stands now. Update after every meaningful action.

**Now:** M3/P1 WAVE-1 ✅ complete (Herdr evaluation, recovered from the fork 2026-08-22, at `docs/research/`). **Owner gate decided 2026-08-22: Beaver Buddy builds its own hook-based detector — Herdr is neither dependency nor prerequisite, only the source of the logic.** WAVE-2 is re-scoped to research the coding-agent CLI hooks and ship a Claude Code tracer bullet, and is delegated to an external coding agent. Details: `Milestone-3/Phase-1/PHASE.md`.
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 paused) · M3 P1 WAVE-1 ✅ / owner gate answered / WAVE-2 re-scoped and ready to dispatch · M4 P1 WAVE-1 ✅ / WAVE-2 open, M4 P2 ✅ · M5 adult asset rows P1–P10 present, P9 runtime ✅ (PR #60) · M6 planned · Cycle-1 exit criteria: downloadable app · 100 downloads · 7 contributors (currently 3)
**Blockers:** none blocking — the M3/P1 owner gate is answered and M3 is unblocked. Open risks carried into WAVE-2: Windows was never tested in WAVE-1 and is the primary target platform · the hook mechanism differs per agent CLI, so the tracer bullet must prove the seam before further agents are added · no new npm dependency may enter without maintainer approval.
**Last:** 2026-08-22 — secured the local working state (bundle + patch + untracked backup at `../_backup-2026-08-22/`), pushed `bl-figure/beaver-baby` to `origin` (3 previously unpushed commits), committed the documentation diff open since 2026-07-26, merged `origin/main` into the branch (13 behind → current), cherry-picked the Herdr research (`2acdfaa`) out of fork PR #3, answered the three owner-gate questions, and wrote the dispatch-ready WAVE-2 prompt into `KICKOFF-AGENT-PROMPTS.md`. Tests 683 passed / 36 skipped, lint clean. Branch at `b2fa160`, 9 ahead of `origin/main`, pushed.
**Next:** Dispatch the external coding agent with the WAVE-2 prompt in `KICKOFF-AGENT-PROMPTS.md`. Before that, decide whether to bring `docs/research/` to `main` via a small PR — the prompt currently reads those files off `bl-figure/beaver-baby` via `git show`, which breaks if that branch is ever merged and deleted. Independent of M3: M4/P1 WAVE-2 (durable daily aggregate storage) and the M5 runtime waves remain open.

## Recent decisions
- **Herdr research recovered from the fork (2026-08-22):** WAVE-1 was delivered on 2026-07-26 into fork PR #3 (`rodgi040/beaver-buddy`), fork-internal and therefore invisible to the team repo for four weeks. Commit `2acdfaa` cherry-picked onto `bl-figure/beaver-baby`. Process lesson: cloud agents inherit whatever remote they find — the "fork = read-only backup" rule must be stated in the agent prompt itself, not only in AGENTS.md.
- **M3 detection: own hook-based detector, NOT Herdr (owner, 2026-08-22).** Beaver Buddy must work without a separate Herdr installation, so we reuse **the logic Herdr uses** — hooks registered in the coding-agent CLIs — while Herdr itself is never bundled, vendored or added to `package.json`. Same precedent as M4/P1, where TokScale's logic was adopted 1:1 without adopting TokScale. **Supersedes the 2026-07-21 decision "detection via Herdr, no custom detector".** Research and implementation are delegated to an external coding agent.
- **State language: Herdr's vocabulary 1:1 (owner, 2026-08-22)** — `working`, `needs-attention`, `done`, `idle`, `unknown`. Question, approval request and decision prompt all collapse into `needs-attention`; no finer precision is claimed and prompt content is never inferred.
- **Agent scope: tracer bullet (owner, 2026-08-22)** — Claude Code first, end to end until the beaver visibly reacts, with the adapter seam built so every further agent is only a new hook implementation. Codex/pi/Kimi/OpenCode follow in WAVE-3, matching M4/P1's harness list.
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
