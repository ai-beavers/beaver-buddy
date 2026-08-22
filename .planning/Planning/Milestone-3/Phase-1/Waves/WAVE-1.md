# WAVE-1 — Herdr Evaluation & Integration Plan

> ✅ **COMPLETE — do not execute this brief again.** Delivered 2026-07-26, recovered
> from fork PR #3 on 2026-08-22. Results: `docs/research/herdr-evaluation.md` and
> `docs/research/herdr-integration-plan.md`.
>
> Its verdict led the owner to reject a Herdr dependency on 2026-08-22 — Beaver
> Buddy builds its own hook-based detector instead. The active wave is **WAVE-2**;
> see `Waves/WAVE-2.md` and `../PHASE.md`. Kept below for provenance.

> Research wave only. Do not implement the Beaver Buddy integration in this wave.

## Goal

Determine from Herdr's official source and controlled live experiments whether and how Beaver Buddy can reliably observe which coding-agent instances are active and when an instance is working, finished, waiting for input, or asking a question. Produce an implementation-ready plan for owner review.

## Preconditions

- Run `/fp-resume` and confirm this wave is the active task.
- Read `CLAUDE.md`, `.planning/KICKOFF.md`, `.planning/ROADMAP.md`, the M3 milestone and this phase.
- Work from a fresh dedicated research branch/worktree based on fetched `origin/main`; never work directly on `main` and do not carry the current local documentation diff into the research branch.
- Herdr may be installed only in the isolated cloud-agent environment for evaluation. Do not add a package, binary, vendored source, lockfile change or runtime dependency to Beaver Buddy.

## Research tasks

1. Inspect Herdr's official repository, documentation, license, release/install model and supported platforms.
2. Install and run Herdr in the isolated environment. Record reproducible setup and teardown steps without secrets or personal paths.
3. Establish how Herdr discovers agent instances and which coding agents it identifies. Separate verified support from inferred or unsupported support.
4. Capture observable interfaces and outputs: CLI/stdout, files, local socket/API, process inspection, hooks or other mechanisms. Do not assume an interface exists.
5. Run controlled transitions and record evidence for `working`, `waiting-for-input`, `question`, `done`, and `unknown/offline`. If Herdr cannot distinguish two states, say so rather than inventing detection logic.
6. Evaluate latency, duplicates, restarts, concurrent instances, stale sessions, terminal closure and failures.
7. Evaluate privacy/security: no prompts, raw terminal content, repo paths, usernames or account identifiers may reach app logs, renderer payloads, fixtures or screenshots.

## Required design output

Propose a deep main-process module with a small normalized interface. Herdr is an adapter behind the seam; animation and sound code must not know Herdr details. Evaluate at minimum:

```ts
type AgentKind = 'claude-code' | 'codex' | 'pi' | 'kimi-code' | 'opencode' | 'unknown';
type AgentState = 'working' | 'waiting-for-input' | 'question' | 'done' | 'unknown';

interface AgentStatusEvent {
  readonly instanceId: string;
  readonly agentKind: AgentKind;
  readonly state: AgentState;
  readonly observedAt: number;
}
```

The research may recommend a different interface when supported by evidence. Keep animation/sound selection downstream as a mapping from normalized events to configurable identifiers.

## Deliverables

- `docs/research/herdr-evaluation.md` — sourced facts, experiments, support matrix, observed interfaces/states, license/dependency implications, privacy findings and unknowns.
- `docs/research/herdr-integration-plan.md` — modules, interface/seam, adapter strategy, files likely to change, tests, rollback, risks, phased tasks and done-when criteria.
- A concise handoff stating whether WAVE-2 is build-ready or blocked on an owner/dependency decision.

## Done when

- Every capability claim is linked to official source/docs or a reproducible experiment.
- Verified versus inferred agent support is explicit.
- Multiple active agents and state transitions can reach Beaver Buddy without sensitive terminal content.
- Animation and sound remain replaceable downstream mappings.
- No project dependency or production code has been added.
- The owner can approve, revise or reject WAVE-2.

## Stop conditions

- Herdr requires a project dependency, bundled executable, network service, elevated privileges or incompatible license: document it and stop for maintainer approval.
- Herdr cannot reliably expose the required states: report evidence and alternatives; do not silently build a custom detector.
