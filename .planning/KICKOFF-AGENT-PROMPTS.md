# Agent Start Prompts — Team Kickoff Cycle 1

> Ready-to-paste prompts for Vlady's and Jurij's Claude Code sessions.
> As of: 2026-07-21. Prerequisite: repo clone at the state of PR #40
> (`.planning/` must be present in the checkout).

> ⚠️ **Lesson from 2026-07-26 (recorded 2026-08-22):** the Codex cloud agent ran the
> M3/P1 Herdr research correctly but delivered it into the **fork**
> (`rodgi040/beaver-buddy` PR #3, fork-internal), where nobody saw it for four weeks.
> Cloud agents inherit whatever remote configuration they find in the clone. Every
> prompt below therefore states the remote rule explicitly — keep it there, and check
> the agent's target repository before it starts work.

## Prompt for Vlady (Claude Code) — M5 Animations

```
You are working on the Beaver Buddy project (Electron desktop pet, pixel-art beaver).
Read FIRST, in this order:
1. CLAUDE.md (project rules, non-negotiable)
2. .planning/KICKOFF.md (Cycle 1, team, conventions)
3. .planning/ROADMAP.md (milestones + dependency overview)
4. .planning/Planning/Milestone-5/MILESTONE.md + Milestone-5/Phase-1/PHASE.md

Your role: You are Vlady's coding agent for MILESTONE 5 (sprite animations).
You are the only agent with Comfy Cloud MCP — ALL asset work runs through you.
Convention: one animation per phase, WAVE-1 = assets (you), WAVE-2 = runtime (pi/Rodgi).

Your first task: M5/Phase-1 (planting & watering a tree, #15) — WAVE-1 assets:
gap analysis (what exists in assets-src/parts/ and tools/puppet-studio/rigs/tree.json?),
generate missing frames via ComfyUI workflow, bake them through the Puppet Studio,
smoke test. References: assets-src/reference/, .planning/Reference/windows-native-flight-plan.md (#15).
Blocked by: nothing — can start immediately. Align the detailed definition with Rodgi before you start.
Never edit .planning/ files yourself; status updates go through Rodgi.
```

## Prompt for Jurij (Claude Code) — M3 Recording Agent — ⚠️ SUPERSEDED

> **Do not dispatch this.** It sends an agent to run M3/P1 WAVE-1 (the Herdr
> evaluation), which is complete — see `Milestone-3/Phase-1/PHASE.md`. The owner
> gate of 2026-08-22 also reversed its premise: Beaver Buddy builds its own
> hook-based detector rather than integrating Herdr. Use the WAVE-2 prompt below
> instead. Kept for provenance.

```
You are working on the Beaver Buddy project (Electron desktop pet, pixel-art beaver).
Read FIRST, in this order:
1. CLAUDE.md (project rules, non-negotiable)
2. .planning/KICKOFF.md (Cycle 1, team, conventions)
3. .planning/ROADMAP.md (milestones + dependency overview)
4. .planning/Planning/Milestone-3/MILESTONE.md + Milestone-3/Phase-1/PHASE.md

Your role: You are Jurij's coding agent for MILESTONE 3 (Recording Agent &
notifications) — the central Cycle-1 feature.

Run `/fp-resume`, then execute M3/Phase-1 WAVE-1 from
`.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md`.
This is research and integration planning only: inspect Herdr's official source,
install it only in the isolated cloud environment, run controlled experiments,
identify supported coding agents and observable states, and write the required
evaluation and integration-plan documents. Do not implement Beaver Buddy integration
yet and do not add Herdr as a project dependency. Work on a fresh dedicated
branch/worktree from `origin/main`, never directly on main.
**Remote rule — repeat this, do not assume the agent reads AGENTS.md:** push and
open the PR ONLY against `ai-beavers/beaver-buddy` (`origin`). The fork
`rodgi040/beaver-buddy` is a read-only backup — never push to it, never open a
PR there. If `git remote -v` shows anything else, stop and report it.
Never edit .planning/ files yourself; status updates go through Rodgi.
```

## Prompt for the external coding agent — M3/P1 WAVE-2 (agent-hook detection)

> Added 2026-08-22 after the owner gate. Supersedes the Herdr-adapter direction.
> Note for whoever dispatches this: a cloud agent cannot see local files. If you
> want it to study Herdr's finished Codex hook as a concrete example, paste
> `~/.codex/herdr-agent-state.ps1` (1.5 KB) in alongside the prompt.

```
You are working on Beaver Buddy (Electron desktop pet, pixel-art beaver) for the
ai-beavers organisation.

READ FIRST, in this order:
1. CLAUDE.md — project rules, non-negotiable
2. AGENTS.md if present — additional working rules
3. .planning/KICKOFF.md — Cycle 1, team, conventions
4. .planning/ROADMAP.md — milestones and dependencies
5. .planning/Planning/Milestone-3/MILESTONE.md and Milestone-3/Phase-1/PHASE.md

The two reference documents you need are not on main yet. Read them with:
  git show origin/bl-figure/beaver-baby:docs/research/herdr-evaluation.md
  git show origin/bl-figure/beaver-baby:docs/research/herdr-integration-plan.md

YOUR TASK — M3/Phase 1, WAVE 2 (re-scoped 2026-08-22)

Beaver Buddy must react visibly when a coding agent starts working, finishes, or
needs the user's attention. Phase 1 previously evaluated the terminal multiplexer
Herdr as the event source. That evaluation is complete and its verdict was: Herdr
works, but only for users who install it separately and run their agents inside
its panes. The owner rejected that trade-off.

The decision instead: build our OWN detector, reusing the same mechanism Herdr
uses — hooks registered in the coding-agent CLIs themselves. Herdr is never
installed, launched, bundled, vendored, or added to package.json. It is a source
of knowledge, not a dependency. This mirrors what M4/P1 already did with
TokScale: adopt the logic 1:1, never adopt the tool.

BINDING OWNER DECISIONS — do not revisit these, build on them:

1. Distribution: own hook-based detector. No Herdr dependency, no prerequisite,
   no bundled binary. Beaver Buddy must work out of the box.
2. State language: adopt Herdr's vocabulary 1:1 —
   working | needs-attention | done | idle | unknown
   Questions, approval requests and decision prompts ALL collapse into
   needs-attention. Do not claim finer precision. Never infer or read prompt
   content.
3. Scope: Claude Code first, as a tracer bullet — one agent, end to end, until
   the beaver visibly reacts. Build the seam so every further agent is only a new
   hook implementation, never a new architecture. Codex, pi, Kimi Code and
   OpenCode follow in WAVE-3.

PART A — RESEARCH (do this first, and write it down)

Determine how Claude Code exposes agent lifecycle to external observers. Work
from official documentation and reproducible experiments only — never from
assumption. Expect a settings-based hook system with events fired around session
start/end, prompt submission, tool use, completion and notifications; verify the
actual event names, trigger conditions, payload shape and delivery mechanism
against current official docs rather than trusting that description.

For each state in the vocabulary above, establish which hook event proves it, and
say explicitly where the mapping is uncertain. If two states cannot be
distinguished, say so — do not invent a heuristic to paper over it.

Also study how Herdr solves the same problem, as a cross-check on your design:
  https://github.com/ogulcancelik/herdr  (Apache-2.0)
Its per-agent integration hooks are the relevant part. Reproducing concepts and
mechanics is unrestricted. Do NOT copy source verbatim — that would trigger
license-notice, NOTICE and change-marking obligations we do not want to carry.

Record: how hooks are installed, whether installation is idempotent, what happens
on uninstall, how concurrent sessions are distinguished, what happens when a
session dies without a closing event, and what the latency looks like.

PART B — IMPLEMENT THE TRACER BULLET

A thin but COMPLETE path through every layer:
  Claude Code hook → normalized event → main process module → visible beaver
  reaction in the renderer.

Do not build layer by layer. Build the one path end to end, prove it works, then
stop. A working thin path is worth more than three polished layers that have
never met.

Architecture requirements:
- A deep main-process module with a small normalized interface. The hook
  integration is an adapter behind that seam.
- Detection code must know NOTHING about animations or sounds. Downstream those
  are configurable mappings from normalized events to identifiers.
- Beaver Buddy must stay fully functional when no hook is installed and no agent
  is running.
- Reuse the canonical agent naming already present in src/main/usage/ (M4/P1's
  multi-harness usage reader, including codex-parser.ts). Do not create a second,
  diverging agent list in this codebase.

The recovered integration plan contains a proposed contract, privacy controls,
an animation/sound boundary and a test matrix. Its Herdr socket transport does
NOT apply to you — everything else does. Use it.

HARD CONSTRAINTS

- No new npm dependency without explicit maintainer approval. Ask before adding
  anything; prefer Node built-ins.
- Privacy: no prompts, no terminal content, no repository paths, no usernames, no
  account identifiers and no tokens may ever reach app logs, renderer payloads,
  test fixtures or screenshots. Extract an allowlisted subset and discard raw
  payloads immediately.
- No runtime network calls. The detector is purely local.
- Never edit .planning/ files yourself — status updates go through Rodgi.
- Windows is the primary target platform and was NEVER tested in WAVE-1. If your
  mechanism behaves differently on Windows, that is a finding, not a footnote.

REMOTE RULE — READ THIS TWICE

Push and open the pull request ONLY against ai-beavers/beaver-buddy (origin).
The fork rodgi040/beaver-buddy is a READ-ONLY BACKUP — never push to it, never
open a PR there. Run `git remote -v` before your first push and confirm the
target. If anything looks different from the above, STOP and report it.

This is not boilerplate. In July 2026 a cloud agent completed this phase's WAVE-1
correctly and delivered it into the fork as a fork-internal PR. Nobody saw it for
four weeks and the work was presumed never started.

Branch from origin/main, never work directly on main. Name the branch
m3-p1/agent-hook-detection.

DELIVERABLES

1. docs/research/agent-hook-detection.md — the research: mechanism per event,
   state mapping with evidence, what is verified versus documented-but-untested,
   Windows findings, install/uninstall model, limitations and unknowns.
2. The tracer-bullet implementation with tests, following the repo's existing
   patterns and passing `npm test` and `npm run lint`.
3. A short handoff stating whether WAVE-3 (further agents) is ready to start or
   blocked, and on what.

DONE WHEN

- Every capability claim links to official documentation or a reproducible
  experiment.
- Verified support is explicitly separated from inferred support.
- Starting a Claude Code session makes the beaver react, and finishing one makes
  it react differently — observed, not theorised.
- Two concurrent sessions do not confuse the detector.
- No sensitive content appears anywhere in logs, payloads or fixtures.
- The app behaves correctly with no hook installed.
- Animations remain a replaceable downstream mapping.

STOP CONDITIONS — report and stop rather than improvising

- The hook mechanism requires a new dependency, elevated privileges, a network
  service or a background daemon.
- Claude Code cannot expose the states reliably. Report the evidence and the
  alternatives; do NOT silently fall back to polling, log-scraping or
  process-inspection heuristics.
- Windows behaves fundamentally differently from Unix.
- The work would require changing anything under .planning/.
```

## Prompt for Rodgi (pi) — M4 Level/XP (reference)

```
/fp-resume → read .planning/Planning/Milestone-4/Phase-1/PHASE.md +
Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md (spec).
Task M4/P1: log reader following TokScale logic — find + parse local token logs of all harnesses
(Claude Code, Codex, pi); ONLY real input/output tokens
(strictly filter out cache creation + cache read); daily aggregate per model;
storage via atomic file; tests against fixture logs.
```
