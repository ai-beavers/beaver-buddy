# WAVE-2 — Agent-Hook Detection (Claude Code tracer bullet)

> **Status:** ready to dispatch, not started. Delegated to an external coding agent.
> **The executable brief is the prompt** in `.planning/KICKOFF-AGENT-PROMPTS.md`
> ("Prompt for the external coding agent — M3/P1 WAVE-2"). This file is the
> Flightplan-side summary; the prompt is the source of truth for the agent.

## Goal

Beaver Buddy reacts visibly when a coding agent starts working, finishes, or needs
attention — through **its own hook-based detector**, not through a Herdr
dependency. Prove the whole path with one agent before adding more.

## Why this replaced the original WAVE-2

WAVE-1 evaluated Herdr and found it usable, but only for users who install it
separately and run their agents inside its panes. The owner rejected that
trade-off on 2026-08-22 and decided to reuse **the logic Herdr uses** — hooks
registered in the coding-agent CLIs — while Herdr itself stays out of the project
entirely. Rationale and the full owner gate: `../PHASE.md`.

The recovered `docs/research/herdr-integration-plan.md` is therefore a
**reference, not a build instruction**: its Herdr socket adapter does not apply,
but its state vocabulary, privacy controls, animation/sound boundary and test
matrix do.

## Binding constraints

- **States:** `working` · `needs-attention` · `done` · `idle` · `unknown`. Question,
  approval request and decision prompt all collapse into `needs-attention`. Never
  infer or read prompt content.
- **Scope:** Claude Code only. The seam must make every further agent a new hook
  implementation, never a new architecture.
- **No Herdr** as dependency, prerequisite, bundled binary or `package.json` entry.
- **No new npm dependency** without maintainer approval; prefer Node built-ins.
- **No runtime network.** The detector is purely local.
- **Privacy:** no prompts, terminal content, paths, usernames, account identifiers
  or tokens in logs, renderer payloads, fixtures or screenshots.
- Reuse the canonical agent naming in `src/main/usage/` (M4/P1) — do not create a
  second, diverging agent list.
- **Windows is the primary target and was never tested in WAVE-1.**

## Deliverables

1. `docs/research/agent-hook-detection.md` — mechanism per event, state mapping
   with evidence, verified versus documented-but-untested, Windows findings,
   install/uninstall model, limitations.
2. Tracer-bullet implementation with tests; `npm test` and `npm run lint` green.
3. Handoff stating whether WAVE-3 (further agents) is ready or blocked.

## Done when

- Every capability claim links to official docs or a reproducible experiment.
- Starting a Claude Code session makes the beaver react; finishing one makes it
  react differently — observed, not theorised.
- Two concurrent sessions do not confuse the detector.
- The app behaves correctly with no hook installed.
- Animations remain a replaceable downstream mapping.

## Stop conditions

- The mechanism needs a new dependency, elevated privileges, a network service or
  a background daemon.
- Claude Code cannot expose the states reliably — report evidence and
  alternatives; do **not** silently fall back to polling, log-scraping or
  process-inspection heuristics.
- Windows behaves fundamentally differently from Unix.

## Dispatch notes

- A cloud agent cannot see local files. To let it study Herdr's finished Codex
  hook as a concrete example, paste `~/.codex/herdr-agent-state.ps1` (1.5 KB)
  alongside the prompt.
- The prompt reads `docs/research/*` off `bl-figure/beaver-baby` via `git show`,
  because those files are not on `main` yet. If that branch is ever merged and
  deleted the reference breaks — consider a small PR bringing `docs/research/` to
  `main` first.
- State the target remote explicitly. WAVE-1 was delivered into the fork and went
  unnoticed for four weeks.
