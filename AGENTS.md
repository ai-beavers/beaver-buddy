# AGENTS.md — Beaver Buddy

Entry point for coding agents (Codex, Kimi Code, and others). The project
guardrails live in [`CLAUDE.md`](CLAUDE.md) — read it first, every session. It
covers the locked stack, Electron hardening invariants, security/privacy rules,
code style, the definition of done, and the git/PR workflow.

The product source of truth is [`PRD.md`](PRD.md); contributions are governed by
[`CONTRIBUTING.md`](CONTRIBUTING.md).

Hard-won gotchas — skim before touching the sprite pipeline, the grab/parachute
interaction, or generating animation art:
[`docs/dev-guardrails.md`](docs/dev-guardrails.md).

## Git remotes — `origin` IS ai-beavers (we are contributors)

**There is no fork in this workflow.** Remote layout (decided 2026-07-22):

- **`origin` = `https://github.com/ai-beavers/beaver-buddy.git`** — the main repo.
  We are contributors (maintain role). Always: branch from `origin/main`, push
  branches directly to `origin`, open PRs against `ai-beavers/main`.
  Branch protection requires a review approval (auto-merge is disabled);
  reviewers: Gw3i (Vlady), jurij.
- **`fork` = `https://github.com/rodgi040/beaver-buddy.git`** — the old fork,
  kept as read-only backup. **Never push there, never open PRs from it.**

## Project planning docs — `.planning/` (committed)

**In this project, the planning/tracking docs live in `.planning/`, NOT in a
Flightplan directory.** Read these first when working on planned features:

- `.planning/KICKOFF.md` — team onboarding (Zyklus 1, roles, conventions) — **start here**
- `.planning/STATE.md` — current status (Now/Next/Blockers)
- `.planning/ROADMAP.md` — milestones M1–M6, phases, dependency overview
- `.planning/Planning/Milestone-N/...` — milestone/phase/wave detail (each phase has
  `Accountable`, `Blocked by:`, waves)
- `.planning/Planning/Milestone-4/Phase-2/XP-LEVEL-MODEL.md` — XP/level spec
- `.planning/Meetings/`, `.planning/Reference/`, `.planning/Archive/` — sources & item specs

Rules: one accountable owner per phase (see ROADMAP team matrix); check a phase's
`Blocked by:` before starting; never edit `.planning/` planning state yourself —
updates flow through Rodgi (the local Flightplan master `.flightplan/` is gitignored
and synced into `.planning/` by him).
