# Session Handoff — 2026-08-22

> This handoff is authoritative. Beaver Buddy stores live Flightplan state under `.planning/`, so `/fp-resume` must read `.planning/STATE.md`, `.planning/ROADMAP.md`, the active phase and wave after this file.

## current_state

- **Branch:** `bl-figure/beaver-baby`, pushed to `origin`, 6 commits ahead of `origin/main` and 0 behind. `origin/main` = `5914070` (PR #60, 2026-08-01) — unchanged since then apart from Dependabot.
- **M3/P1 WAVE-1 is complete.** The Herdr evaluation and integration plan now live at `docs/research/herdr-evaluation.md` and `docs/research/herdr-integration-plan.md`.
- **The M3 owner gate was answered on 2026-08-22, and it changed direction:** Beaver Buddy builds its **own** hook-based detector using the logic Herdr uses, instead of depending on a running Herdr. M3 is unblocked; WAVE-2 is re-scoped and goes to an external coding agent.
- Tests 683 passed / 36 skipped (59 files), lint clean.

## completed (this session)

- **Secured everything before touching anything.** Backup at `../_backup-2026-08-22/`: a `git bundle` of all refs (verified, complete history), the uncommitted worktree patch (690 lines), all untracked files, and the gitignored `.flightplan/` mirror (106 files).
- **Pushed `bl-figure/beaver-baby` to `origin`** — 3 commits from 2026-07-27 (baby 360 turnaround sheet, `ingest-turnaround.mjs` + tests, design verdict) had never left this machine. No PR opened.
- **Committed the documentation diff** that had been open in the working tree since 2026-07-26 (`ca56d65`, 20 files), including the previously untracked M3/P1 `WAVE-1.md` research brief.
- **Merged `origin/main` into the branch** (`0ba368f`) after it had fallen 13 commits behind. One conflict in `assets/STYLE.md`, resolved additively — upstream's `toilet-read(8)`/`shake-dry(8)` entries kept ahead of this branch's baby turnaround section, nothing dropped. `package.json` and `docs/asset-gallery.md` auto-merged.
- **Recovered the Herdr research** (`546cdf9`, cherry-pick of `2acdfaa`) from fork PR #3.
- Updated `.planning/` (STATE, ROADMAP, M3/P1 PHASE, NOTE) against verified reality.

## the finding that mattered

The M3/P1 research was **not** missing — it was delivered on 2026-07-26 into the **fork** `rodgi040/beaver-buddy` as PR #3 (branch `codex/analyze-fp-resume-skill-documentation`, commit `2acdfaa`), fork-internal, never pointed at `ai-beavers/beaver-buddy`. Nothing of it existed in the team repo, so the phase read as "not started" for four weeks. The fork PR is still open and unmerged.

Process lesson (recorded in NOTE.md): cloud agents inherit whatever remote configuration they find. The AGENTS.md rule "fork = read-only backup, never push" has to be repeated inside the agent start prompt itself.

## remaining

1. **Brief the external coding agent for the re-scoped WAVE-2** (see next_action below).
2. Decide whether the Herdr research should reach `ai-beavers/beaver-buddy` as a PR — it currently exists there only on `bl-figure/beaver-baby`. It stays valuable as a reference even though Herdr will not be integrated.
3. Decide the fate of fork PR #3 (close it, now that the commit is recovered?).
4. Three untracked files are still uncommitted and only backed up: `.kimi-code/mcp.json` (local MCP config — probably belongs in `.gitignore`), `BEAVER BUDDY ANIMATIONS WORKFLOW.json` (1.1 MB ComfyUI workflow), `design-assets/beaver-idle-frame.glsl`.
5. Open independently of M3: M4/P1 WAVE-2 (durable daily aggregate storage), M5 runtime waves, M2/P3 WAVE-3 (paused), 4 Dependabot PRs (#38, #74, #75, #76).

## decisions — the M3 owner gate, answered 2026-08-22

1. **Distribution → build our own detector.** Beaver Buddy must detect agent activity **without** a separate Herdr installation. Herdr is not bundled, not vendored, not a dependency, not a prerequisite. We reuse **the logic Herdr uses** — hooks registered in the coding-agent CLIs. Same precedent as M4/P1, where TokScale's logic was adopted 1:1 without adopting TokScale. **Supersedes the 2026-07-21 decision "detection via Herdr, no custom detector".** Research and implementation are delegated to an external coding agent.
2. **State language → Herdr's vocabulary 1:1:** `working`, `needs-attention`, `done`, `idle`, `unknown`. Question, approval request and decision prompt all collapse into `needs-attention`; no finer precision is claimed, prompt content is never inferred.
3. **Scope → tracer bullet.** Claude Code first, end to end until the beaver visibly reacts, with the adapter seam built so every further agent is only a new hook implementation. Codex/pi/Kimi/OpenCode follow in WAVE-3, matching M4/P1's harness list.

**Consequence:** the integration plan becomes a **reference, not a build instruction** — its WAVE-2A/2B/2C structure describes a Herdr socket adapter that will not be built. Its state vocabulary, privacy controls, animation/sound boundary and test matrix carry over unchanged.

## blockers

- None blocking. M3 is unblocked.
- **Carried into WAVE-2:** WAVE-1 never tested Windows, and Windows is the primary target platform. No coding agent was verified against a live authenticated session either — but that matters less now, since the own hooks sit inside the agent CLI rather than observing from outside.
- The hook mechanism differs per agent CLI — the tracer bullet must prove the seam before further agents are added.
- No new npm dependency without explicit maintainer approval.
- **Trust boundary improved:** Herdr would have been a *local advisory source* any same-user process could forge states into. A hook Beaver Buddy registers itself is not a foreign source, which removes part of the hardening burden originally assigned to M3/P3.
- Herdr is Apache-2.0 — reproducing concepts is unrestricted; verbatim code adoption would trigger notice/NOTICE/change-marking duties (largely moot for Rust→TypeScript).

## next_action

Brief an external coding agent for the re-scoped M3/P1 WAVE-2: research the hook mechanisms of the coding-agent CLIs (Claude Code first), then build the tracer bullet — hook → normalized event → main process → visible beaver reaction. Starting material, constraints and license notes: `.planning/Planning/Milestone-3/Phase-1/PHASE.md`. State the target remote explicitly in that prompt (see the fork lesson above).

## suggested_skills

- `/fp-resume` — restore this handoff and the live `.planning/` artifacts.
- `/fp-plan` — turn the approved gate answers into WAVE-2A/2B.
