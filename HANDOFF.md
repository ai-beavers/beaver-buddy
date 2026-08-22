# Session Handoff — 2026-07-26

> This handoff is authoritative. Beaver Buddy stores live Flightplan state under `.planning/`, so `/fp-resume` must read `.planning/STATE.md`, `.planning/ROADMAP.md`, the active phase and wave after this file.

## current_state

- **Active work:** M3/P1 WAVE-1 — Herdr evaluation and integration planning for Jurij's cloud agent.
- **Scope:** research Herdr's real behavior, supported coding agents and observable states; install it only in the isolated cloud environment; produce evaluation and integration-plan documents. Do not implement the Beaver Buddy adapter in this wave.
- **Architecture direction:** a deep main-process agent-status module exposes normalized, privacy-safe events. Herdr is an adapter behind that seam. Animation and sound are downstream mappings to configurable identifiers.
- **Git:** fetched `origin/main` is `40d9420`; local `main` is `3417d19`, three commits behind. The current documentation synchronization is uncommitted. Use a fresh research branch/worktree from `origin/main` and do not carry this dirty documentation diff into research commits.

## completed

- Synchronized `PRD.md`, `README.md`, `.planning/STATE.md`, `ROADMAP.md`, `HANDOFF.md`, `NOTE.md` and affected M3/M4/M5 files with merged reality; matching local `.flightplan/` sources were updated.
- Corrected PR #52/M4/P2, M4/P1 WAVE-1, Pi parser PR #57 and M5/P9/P10 asset-wave status.
- Owner selected M3 Herdr as the next focus.
- Expanded M3/P1 WAVE-1 as a research-only brief at `.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md` and updated Jurij's start prompt.

## remaining

1. In the cloud session, run `/fp-resume` and confirm M3/P1 WAVE-1 is active.
2. Create a fresh dedicated research branch/worktree from fetched `origin/main`.
3. Execute the Herdr source review, isolated installation and controlled experiments.
4. Write `docs/research/herdr-evaluation.md` and `docs/research/herdr-integration-plan.md`.
5. Stop for owner review. Only an approved WAVE-2 may implement the Beaver Buddy adapter.

## decisions

- Owner direction (faithful English translation): "Proceed with Jurij's next tasks: analyze Herdr, then integrate it so the app recognizes when a coding-agent terminal is finished, needs new input, asks questions, and which coding agents are currently working or used."
- Owner direction: first capture the work cleanly in Flightplan; the cloud agent installs and analyzes Herdr in its own environment, then creates the concrete integration plan.
- Owner direction: later character animations or sounds must be selectable as configuration/variables from normalized agent events.
- No custom detector is to be built silently. Herdr capability claims must come from official source/docs or reproducible experiments.
- Installing Herdr in the isolated cloud environment is approved; adding a Beaver Buddy dependency, bundled executable or vendored code is not approved.

## blockers

- None for WAVE-1 research.
- WAVE-2 is blocked until Herdr's integration mechanism, license, supported-agent matrix and state fidelity are evidenced and reviewed.
- Any new project dependency, bundled executable, network service or privileged process requires explicit maintainer approval.

## next_action

Run `/fp-resume`, then execute `.planning/Planning/Milestone-3/Phase-1/Waves/WAVE-1.md` on a fresh research branch/worktree from fetched `origin/main`.

## suggested_skills

- `/fp-resume` — restore this handoff and the live `.planning/` artifacts.
- `research` — use official Herdr source/docs and record precise evidence.
- `/fp-plan` — only after the evaluation, to turn the evidence-backed integration proposal into WAVE-2.
