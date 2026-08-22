# State

> Where the project stands now. Update after every meaningful action.

**Now:** M3/P1 WAVE-1 is **complete** — the Herdr evaluation and integration plan were recovered from the fork on 2026-08-22 and now live at `docs/research/`. WAVE-2 is **blocked on three owner decisions** (distribution · state language · scope), documented in `Milestone-3/Phase-1/PHASE.md`. Nothing else in M3 can move until those are answered.
**Progress:** M1 ✅ · M2 P1/P2 ✅ (P3 paused) · M3 P1 WAVE-1 ✅ / WAVE-2 blocked on owner gate · M4 P1 WAVE-1 ✅ / WAVE-2 open, M4 P2 ✅ · M5 adult asset rows P1–P10 present, P9 runtime ✅ (PR #60) · M6 planned · Cycle-1 exit criteria: downloadable app · 100 downloads · 7 contributors (currently 3)
**Blockers:** **M3/P2 and M3/P3 are blocked behind the M3/P1 owner gate** — three decisions are waiting, and M3 has stood still for four weeks because of it · Herdr's default update check against `herdr.dev` collides with the no-runtime-network invariant and must be disabled/verified · Windows was never tested in WAVE-1, and it is the primary target platform.
**Last:** 2026-08-22 — secured the local working state (bundle + patch + untracked backup), pushed `bl-figure/beaver-baby` to `origin` (3 previously unpushed commits), committed the documentation diff that had been open since 2026-07-26, merged `origin/main` into the branch (13 commits behind → current), and cherry-picked the Herdr research (`2acdfaa`) out of fork PR #3. Tests 683 passed / 36 skipped, lint clean.
**Next:** Owner answers the three M3/P1 gate questions. Only then can WAVE-2A/2B start (no new npm dependency required); WAVE-2C stays gated on Windows beta verification. Independent of that: M4/P1 WAVE-2 (durable daily aggregate storage) and the M5 runtime waves remain open.

## Recent decisions
- **Herdr research recovered from the fork (2026-08-22):** WAVE-1 was delivered on 2026-07-26 into fork PR #3 (`rodgi040/beaver-buddy`), fork-internal and therefore invisible to the team repo for four weeks. Commit `2acdfaa` cherry-picked onto `bl-figure/beaver-baby`. Process lesson: cloud agents inherit whatever remote they find — the "fork = read-only backup" rule must be stated in the agent prompt itself, not only in AGENTS.md.
- **Herdr state language (proposed, 2026-07-26, owner decision pending):** Herdr has no `question` state — question, approval request and decision prompt all surface as `blocked`. The integration plan proposes a single `needs-attention` state instead of the `waiting-for-input`/`question` split originally specified in M3/P1.
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
