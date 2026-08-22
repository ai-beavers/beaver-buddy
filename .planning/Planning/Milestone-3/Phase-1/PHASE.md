# Phase 1 — Event Detection via Herdr

> Part of Milestone 3. Done when: The app reliably detects the states "coding
> agent done" and "agent waiting for input" — **via Herdr** (open-source terminal
> overview tool for managing multiple coding agents in parallel) as the event
> source, as a standalone module, tested and without coupling to the animation
> layer.

**Status:** WAVE-1 ready-to-start (owner-approved 2026-07-26) — research and integration planning only; no Beaver Buddy implementation before review.

**Accountable:** Jurij · **Agent:** Claude Code
**Cycle:** Cycle 1
**Blocked by:** none — **can start immediately**
**Blocks:** M3/P2, M3/P3
**Duration (rough):** ~1–1.5 weeks

## Waves
- [ ] WAVE-1 — Evaluate Herdr in an isolated cloud-agent environment, identify supported coding agents and observable states, then produce an evidence-backed integration plan; see `Waves/WAVE-1.md`
- [ ] WAVE-2 — After owner approval, implement a Herdr adapter behind a normalized agent-state interface, with tests and no animation-layer coupling

## Notes
- Owner decision 2026-07-21: detection via Herdr, NO custom detection logic.
- Architecture rule: event detection and character animation are strictly separate modules.
- The normalized interface must identify active coding-agent instances and expose only states supported by Herdr evidence, including `working`, `waiting-for-input`, `question`, `done`, or `unknown` where distinguishable.
- Animation and sound selection are downstream configuration values; they are not part of Herdr detection.
- Installing Herdr in the cloud research environment is approved. Adding it to `package.json`, vendoring it, or shipping a binary remains forbidden without separate maintainer approval.
- Source: `Meetings/2026-07-21-planung/summary.md` (Recording Agent, Herdr 02:06:13).
