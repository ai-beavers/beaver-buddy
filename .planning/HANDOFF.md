# Handoff

> Full resume context. Written by `/fp-pause`, read by `/fp-resume`. `STATE.md` is the short digest;
> this file is the complete picture so the next session loses no context.

## authoritative_update_2026-08-22 — M3/P1 WAVE-1 recovered, owner gate open

- **The M3/P1 Herdr research was never missing — it was delivered to the wrong repository.** Codex cloud agent, 2026-07-26, into fork `rodgi040/beaver-buddy` PR #3 (branch `codex/analyze-fp-resume-skill-documentation`, commit `2acdfaa`), fork-internal and therefore invisible to `ai-beavers/beaver-buddy` for four weeks. Cherry-picked onto `bl-figure/beaver-baby` as `546cdf9`. Fork PR #3 remains open.
- **WAVE-1 is complete.** `docs/research/herdr-evaluation.md` (164 lines) + `docs/research/herdr-integration-plan.md` (217 lines). Herdr 0.7.5, protocol 17, Apache-2.0.
- **WAVE-2 is blocked on three owner decisions:** distribution · state language · scope. See `Milestone-3/Phase-1/PHASE.md`. M3/P2 and M3/P3 sit behind that same gate.
- **Key limitation:** Herdr has no `question` state — question, approval and decision prompts all become `blocked`, so the plan proposes `needs-attention` instead of the original `waiting-for-input`/`question` split. No agent was verified live; **Windows was never tested**.
- **Local state secured 2026-08-22:** full backup at `../_backup-2026-08-22/` (bundle of all refs + patch + untracked + `.flightplan/` mirror); `bl-figure/beaver-baby` pushed to `origin` (3 previously unpushed commits from 2026-07-27); the documentation diff open since 2026-07-26 committed as `ca56d65`; `origin/main` merged in as `0ba368f` (was 13 commits behind). Tests 683 passed / 36 skipped, lint clean.
- **Upstream reality:** `origin/main` = `5914070` (2026-08-01). Since 2026-08-02 there has been no functional commit on main — only Dependabot. Vlady's PR #71 (video-to-sprite skill) and PR #60 (toilet+newspaper+recovery, assets **and** runtime) were the last substantive work.
- The sections below preserve older session history. Where they conflict, this update and `STATE.md` take precedence.

## pause_2026-07-26 — M3/P1 Herdr

- Owner selected M3/P1 as the next focus: identify active coding-agent instances and reliable `working`, `waiting-for-input`, `question`, `done` or fallback states through Herdr.
- Active task: research-only `.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md`.
- The cloud agent may install Herdr only in its isolated environment and must produce `docs/research/herdr-evaluation.md` plus `docs/research/herdr-integration-plan.md` before any Beaver Buddy implementation.
- Herdr remains an adapter behind a normalized main-process seam. Animation and sound are downstream configurable mappings.
- Use a fresh research branch/worktree from fetched `origin/main`; local `main` is three commits behind and the planning-sync diff is uncommitted.
- Next action: run `/fp-resume`, execute WAVE-1, then stop for owner review.

## authoritative_update_2026-07-26

- Fetched upstream state: `origin/main` = `40d9420`; local clean `main` = `3417d19`, three commits behind.
- PR #52 is merged: reset removal, model-weighted XP migration, five stages, unlimited levels, Beaver Status settings and stage-capabilities foundation.
- M4/P1 WAVE-1 is complete through PR #42 plus the functional Pi parser fix in PR #57. WAVE-2 durable daily-aggregate storage remains open.
- M5 adult asset rows P1–P10 are present. P9/P10 WAVE-1 assets are complete; their runtime waves remain open. P11 and the full P12 stage package remain open.
- PR #59 is a later re-merge/housekeeping commit on the Pi-fix branch; the functional parser change landed in PR #57.
- The sections below preserve older session history. When they conflict, this update and `STATE.md` take precedence.

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
- None for the team. M5/P11 and P12 asset work requires Vlady with Claude Code/Comfy Cloud; the settings UI concept requires owner direction.

## next_action
Run `/fp-resume`, then execute `.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md` on a fresh research branch/worktree from fetched `origin/main`.
