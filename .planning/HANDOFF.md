# Handoff

> Full resume context. Written by `/fp-pause`, read by `/fp-resume`. `STATE.md` is the short digest;
> this file is the complete picture so the next session loses no context.

**Last updated:** 2026-07-22 (pi — PR #40 + #41 MERGED, fork→upstream migration complete, M4/P1 draft PR #42)

## current_state
**Fork → upstream migration COMPLETE.** `origin` = `ai-beavers/beaver-buddy` (we are
contributors, maintain role); the old fork stays as read-only backup remote `fork`.
The rule is recorded in `AGENTS.md` (merged via PR #40). **PR #40** (vendored skills +
Cycle-1 planning, fully English) and **PR #41** (animation-authoring docs) were both
merged by **Gw3i** on 2026-07-22. All `.planning/` docs are now English (owner
requirement). 15 stale upstream branches were closed with `archive/*` tags; tags
`v0.1.0` + `docs/animation-authoring` are upstream.
**M4/P1 in progress:** the multi-harness usage-log work (Pi Agent, Kimi Code, OpenCode;
per-source opt-in) was merged via **PR #42** (branch `feat/multi-harness-usage-logs`);
agent brief: `Planning/Milestone-4/Phase-1/AGENT-BRIEF.md`.
**Debug finding:** the beaver does not grow because XP sources are opt-in
(report: `.planning/Debugging/DEBUG-beaver-growth.md`) — fixed by the opt-in toggles in PR #42.
**M2/P3 parachute:** still officially paused (WAVE-3 polish open → resume later, Claude Code).

## completed (Session 2026-07-22)
- **Fork cleanup:** `feature/animation-authoring-docs` merged `--no-ff` (AGENTS.md conflict
  resolved), tag `docs/animation-authoring`, 7 merged branches deleted locally + remotely
- **Migration plan executed** (all 6 steps): permission clarified (rodgi040 + jurij =
  `maintain`; **Vlady = `Gw3i`**), PR #41 opened, reviews requested from Gw3i + jurij,
  remotes swapped (`upstream`→`origin`, `origin`→`fork`), main tracking `origin/main`,
  AGENTS.md remote rule (commit `32267ef`, in PR #40)
- **Upstream branch cleanup:** 15 merged stale branches (BL-1–BL-12, BL-11-fix-*,
  build-loop) tagged `archive/*` at the branch tip + deleted
- **`.planning/` translated to English:** bulk pre-translated by the Kimi session;
  remainder by 2 scout + 2 worker subagents + manual byte-level umlaut sweep
  (0 German tokens left; commits `05c15fd`, `3270955`); PR #40 title/body already English
- **M4/P1:** agent brief written (TokScale = analysis reference only, never commit it;
  own reader: real input/output tokens only, daily aggregation, 10-min incremental
  refresh, Win + macOS, push-capable schema for the later AI-Beavers user DB);
  feature work moved to `feat/multi-harness-usage-logs` off `origin/main` → draft PR #42
- **/debug beaver growth** (read-only scout): root cause = XP sources opt-in
  (`settings-store.ts` defaults `false`); side finding code ≠ spec (3 stages/linear/cache-counting
  vs. 5 stages/quadratic/no-cache); report `DEBUG-beaver-growth.md`
- **`.codex/agents/` configs** added (code-verifier, executor, plan-verifier, planner, research)
- **main synced:** merge of `origin/main` into local `main`, 6 conflict files resolved
  toward the English versions, new local content integrated in English

## completed (Session 2026-07-21, condensed)
- Re-onboarding `.fp-new-projekt/` → `.flightplan/{Meetings,Reference,Archive}`; Cycle 1
  defined (exit: downloadable app · 100 downloads · 7 contributors); ROADMAP M1–M6 +
  team matrix (Jurij = M3, Rodgi = M4 + M6, Vlady = M5); XP/level spec (γ=2, 120,000 XP
  total, quadratic, no cache); 5 life stages; Herdr for M3 detection; TokScale logic for
  M4/P1; multi-platform Windows + macOS native; name fix Vady → Vlady

## remaining (in order)
1. **Housekeeping PR:** the remaining local `main` commits (`.codex/agents/` configs,
   M4/P1 AGENT-BRIEF, debug report, session state updates) — branch off `main`, push,
   PR against ai-beavers/main
2. **Fork archiving** (owner action in GitHub UI: rodgi040/beaver-buddy → Settings → Archive)
3. **Team dispatch:** prompts from `.planning/KICKOFF-AGENT-PROMPTS.md` to Vlady (M5/P1)
   + Jurij (M3/P1) — now unblocked, planning is on ai-beavers/main
4. **M4/P1 follow-up:** PR #42 merged the first increment; remaining waves in
   `Planning/Milestone-4/Phase-1/PHASE.md` to be driven by the owner
5. **Dependabot PRs #38/#39:** owner merge (Gw3i)
6. **Open from this session:** onboarding hint "growth needs connect" into NOTE.md/M4 spec?
   (owner decision pending)
7. **Owner decisions (NOTE.md):** Apple Developer account (~$99/yr), macOS test hardware,
   macOS Z1 priority, #3/#4b/#63/#64
8. **Later:** M2/P3 WAVE-3 resume (Claude Code) · M4/P2 (XP model per spec: 5 stages,
   quadratic, no cache, γ=2 — closes the code≠spec debug finding) · M5/P12 stage art
   package · calibrate XP constant after 1 week of M4/P1 data

## decisions (Owner, verbatim, translated)
- "Check which open branches we still have … then merge them cleanly with merge commits
  and tags" — 2026-07-22
- "I want us to create branches only from the original repository main and open PRs
  directly on the main repo, without working on the fork" — 2026-07-22
- "I'm not sure only the admin can merge PRs … please note that in the plan" — 2026-07-22
  (confirmed: org ruleset requires owner/admin; Gw3i merged)
- "The cloned repo (TokScale) must not be committed into the codebase, only noted as a
  logical reference" — 2026-07-22
- "All PR files must be in English" (repo owner, via Rodgi) — 2026-07-22
- "pi = only me; Vlady & Jurij everywhere with Claude Code" — 2026-07-21
- "Only input and output tokens count, no cache/cache-read" — 2026-07-21
- "γ = 2" (model weighting spread; value = intelligence, not token price) — 2026-07-21
- "5 life stages: baby, young baby, teenager, somewhat older teenager, adult" — 2026-07-21
- "For detection we want to use Herdr" — 2026-07-21
- "Electron app native for Windows and macOS" (team meeting) — 2026-07-21
- "Parachute resume: later!" — 2026-07-21

## blockers
- None for the team. (Fork archiving + Dependabot merges = owner actions, not blockers.)

## next_action
**Housekeeping PR** for the remaining local `main` commits (see remaining ①) → then
**team dispatch** (KICKOFF-AGENT-PROMPTS.md to Vlady + Jurij).
