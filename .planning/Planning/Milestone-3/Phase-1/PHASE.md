# Phase 1 — Event Detection via Herdr

> Part of Milestone 3. Done when: The app reliably detects the states "coding
> agent done" and "agent waiting for input" — **via Herdr** (open-source terminal
> overview tool for managing multiple coding agents in parallel) as the event
> source, as a standalone module, tested and without coupling to the animation
> layer.

**Status:** WAVE-1 ✅ complete (delivered 2026-07-26, recovered 2026-08-22) — WAVE-2 **blocked on three owner decisions** (see Owner gate below).

**Accountable:** Jurij · **Agent:** Claude Code
**Cycle:** Cycle 1
**Blocked by:** none for research — WAVE-2 blocked on owner gate
**Blocks:** M3/P2, M3/P3
**Duration (rough):** ~1–1.5 weeks

## Waves
- [x] WAVE-1 — Evaluate Herdr in an isolated cloud-agent environment, identify supported coding agents and observable states, then produce an evidence-backed integration plan; see `Waves/WAVE-1.md`. Deliverables: `docs/research/herdr-evaluation.md`, `docs/research/herdr-integration-plan.md`
- [ ] WAVE-2 — After owner approval, implement a Herdr adapter behind a normalized agent-state interface, with tests and no animation-layer coupling. Split into WAVE-2A (contract + protocol), WAVE-2B (transport + reconciliation), WAVE-2C (main-process lifecycle + Windows QA)

## WAVE-1 result summary

Evaluated Herdr **0.7.5, protocol 17**, upstream revision `e536bd8`, **Apache-2.0**.

**Verdict:** Herdr is usable as an **optional external event source** when coding
agents run inside Herdr panes. It is not a drop-in answer to the phase goal.

**Three findings that change the phase contract:**

1. **`question` does not exist in Herdr.** Herdr exposes `working`, `blocked`,
   `done`, `idle`, `unknown`. A question, an approval request and a decision
   prompt all collapse into `blocked`. The plan therefore proposes
   `blocked → needs-attention` instead of the separate `waiting-for-input` and
   `question` states this phase originally specified. Beaver Buddy must not claim
   more precision than the source provides, and must not infer prompt content.
2. **No coding agent was verified against a live authenticated session.** Only the
   socket protocol itself was exercised, synthetically. Claude Code and Codex rest
   on Herdr's documentation alone. **Windows was not tested at all** — and Windows
   is our primary target platform.
3. **No npm dependency needed** (Node built-in `net` over a local Unix socket /
   Windows named pipe), but Herdr performs update/manifest checks against
   `herdr.dev` by default. That collides with our no-runtime-network invariant and
   must be disabled via `[update].manifest_check = false` and verified.

**Privacy:** snapshot records carry raw paths (`cwd`, `foreground_cwd`) — the
adapter must extract an allowlist subset and discard raw envelopes immediately.
The status events themselves are clean (agent label, status, Herdr resource IDs).
Trust boundary: any same-user process with socket access can report forged states;
Herdr counts as a **local advisory source**, not an authenticated authority.
Hardening belongs to M3/P3.

## Owner gate — WAVE-2 stays blocked until all three are decided

1. **Distribution:** Herdr is a separately installed and already-running
   prerequisite; Beaver Buddy neither installs nor bundles it. If the app must
   work without a separate Herdr installation, the plan needs revision and
   explicit dependency approval.
2. **State language:** `blocked` becomes a generic `needs-attention`; no separate
   `question` claim.
3. **Scope:** default Herdr session only; agents must run inside Herdr panes.

Once approved, WAVE-2A and WAVE-2B are technically ready with no new npm
dependency. WAVE-2C stays gated on successful Windows beta verification.

## Delivery note — why this sat unnoticed for four weeks

The Codex cloud agent delivered on 2026-07-26 into the **fork**
`rodgi040/beaver-buddy` (PR #3, branch
`codex/analyze-fp-resume-skill-documentation`, commit `2acdfaa`), as a
fork-internal PR that never pointed at `ai-beavers/beaver-buddy`. Nothing of it
existed in the team repository, so this phase read as "not started" until
2026-08-22, when the commit was cherry-picked onto `bl-figure/beaver-baby`.
The fork PR remains open and unmerged.

## Notes
- Owner decision 2026-07-21: detection via Herdr, NO custom detection logic.
- Architecture rule: event detection and character animation are strictly separate modules.
- The normalized interface exposes only states supported by Herdr evidence — see the `needs-attention` finding above, which supersedes the original `waiting-for-input`/`question` split.
- Animation and sound selection are downstream configuration values; they are not part of Herdr detection.
- Installing Herdr in the cloud research environment is approved. Adding it to `package.json`, vendoring it, or shipping a binary remains forbidden without separate maintainer approval.
- Source: `Meetings/2026-07-21-planung/summary.md` (Recording Agent, Herdr 02:06:13).
