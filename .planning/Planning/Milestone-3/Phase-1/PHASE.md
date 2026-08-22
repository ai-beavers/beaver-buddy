# Phase 1 — Event Detection via Agent Hooks

> Part of Milestone 3. Done when: The app reliably detects the states "coding
> agent done" and "agent needs attention" — through **Beaver Buddy's own hook-based
> detector**, as a standalone module, tested and without coupling to the animation
> layer.

**Status:** WAVE-1 ✅ complete (Herdr evaluation, 2026-07-26 / recovered 2026-08-22). Owner gate **decided 2026-08-22**: Beaver Buddy builds its **own** detector using Herdr's hook logic — Herdr itself is neither a dependency nor a prerequisite. WAVE-2 is being re-scoped accordingly and delegated to an external coding agent.

**Accountable:** Jurij · **Agent:** external coding agent (research + implementation)
**Cycle:** Cycle 1
**Blocked by:** none
**Blocks:** M3/P2, M3/P3
**Duration (rough):** ~1–1.5 weeks

## Waves
- [x] WAVE-1 — Evaluate Herdr as an event source. Delivered: `docs/research/herdr-evaluation.md`, `docs/research/herdr-integration-plan.md`. Outcome: Herdr works, but only as an *optional* source for agents running inside Herdr panes — which does not meet the product goal. See the owner decision below.
- [ ] WAVE-2 — **Re-scoped:** research the hook mechanisms of the coding-agent CLIs themselves (starting with Claude Code) and implement a tracer-bullet detector: hook → normalized event → main process → visible beaver reaction. Delegated externally.
- [ ] WAVE-3 — Extend the detector to further agents behind the same seam (Codex, pi, Kimi Code, OpenCode — matching M4/P1's harness list).

## Owner decisions — 2026-08-22

The three gate questions from the integration plan were answered as follows:

1. **Distribution → build our own detector.** Beaver Buddy must detect agent
   activity **without** requiring a separate Herdr installation. Herdr is not
   bundled, not vendored, not a dependency and not a prerequisite. Instead we
   reuse **the logic Herdr itself uses**: hooks registered in the coding-agent
   CLIs. This mirrors the existing M4/P1 precedent, where TokScale's *logic* was
   adopted 1:1 while TokScale itself was never added to the project.
   This supersedes the 2026-07-21 decision "detection via Herdr, no custom
   detector".
2. **State language → adopt Herdr's vocabulary 1:1:** `working`,
   `needs-attention`, `done`, `idle`, `unknown`. Question, approval request and
   decision prompt all collapse into `needs-attention`; Beaver Buddy does not
   claim finer precision and never infers prompt content.
3. **Scope → one agent as a tracer bullet.** Claude Code first, end to end, until
   the beaver visibly reacts. The adapter seam is built so that every further
   agent is only a new hook implementation, not a new architecture. Remaining
   agents follow in WAVE-3.

## What WAVE-1 still contributes

The integration plan is now a **reference, not a build instruction** — its
WAVE-2A/2B/2C structure describes a Herdr socket adapter that will not be built.
These parts carry over unchanged to an own detector:

- the state vocabulary (decision 2 above)
- the privacy controls: allowlist extraction, never log raw envelopes, terminal
  content, prompts, paths, titles or tokens
- the animation/sound boundary: normalized events map to configurable
  identifiers downstream; detection code knows nothing about animations
- the test matrix: concurrent instances, duplicate/out-of-order events,
  restart, stale sessions, terminal closure, malformed input, bounded shutdown

**Trust boundary — improved by this decision.** Herdr would have been a *local
advisory source*: any same-user process with socket access could forge states. A
hook that Beaver Buddy registers itself in the agent CLI is not a foreign source,
which removes part of the hardening burden originally assigned to M3/P3.

## Starting material for the external agent

- `docs/research/herdr-evaluation.md` + `docs/research/herdr-integration-plan.md`
- Herdr's own Codex hook, present on the owner's machine:
  `~/.codex/herdr-agent-state.ps1` (`HERDR_INTEGRATION_ID=codex`) — the logic in
  executable form for one agent type
- Herdr source (Rust): `~/CODING/AGENT-HARNESS-MODIFIKATIONEN/herdr-modifikationen/herdr-fork/`
- M4/P1's existing multi-harness recognition (`src/main/usage/`, incl.
  `codex-parser.ts`) — reuse its canonical agent naming instead of establishing a
  second, diverging agent list
- **License:** Herdr is Apache-2.0. Reproducing concepts and mechanics is
  unrestricted. Verbatim code adoption would trigger license-notice, NOTICE and
  change-marking obligations — Rust to TypeScript makes this largely moot, but
  the rule stands.

## Notes
- Architecture rule: event detection and character animation are strictly separate modules.
- Animation and sound selection are downstream configuration values.
- No new npm dependency without explicit maintainer approval.
- Herdr must not be launched, installed, bundled or added to `package.json`.
- Source of the original decision: `Meetings/2026-07-21-planung/summary.md` (Recording Agent, Herdr 02:06:13).

## Delivery note — why WAVE-1 sat unnoticed for four weeks

The Codex cloud agent delivered on 2026-07-26 into the **fork**
`rodgi040/beaver-buddy` (PR #3, branch
`codex/analyze-fp-resume-skill-documentation`, commit `2acdfaa`), as a
fork-internal PR that never pointed at `ai-beavers/beaver-buddy`. Nothing of it
existed in the team repository, so this phase read as "not started" until
2026-08-22, when the commit was cherry-picked onto `bl-figure/beaver-baby`.
The fork PR remains open and unmerged.
