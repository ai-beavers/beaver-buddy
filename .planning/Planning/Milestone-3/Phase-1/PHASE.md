# Phase 1 — Event Detection via Herdr

> Part of Milestone 3. Done when: The app reliably detects the states "coding
> agent done" and "agent waiting for input" — **via Herdr** (open-source terminal
> overview tool for managing multiple coding agents in parallel) as the event
> source, as a standalone module, tested and without coupling to the animation
> layer.

**Status:** not-started (stub — detailed definition at phase start with Jurij)

**Accountable:** Jurij · **Agent:** Claude Code
**Cycle:** Cycle 1
**Blocked by:** none — **can start immediately**
**Blocks:** M3/P2, M3/P3
**Duration (rough):** ~1–1.5 weeks

## Waves
- [ ] WAVE-1 — Evaluate Herdr (install/output/API: how does Herdr report agent
  status?), integration design, state model (done / input needed / running)
- [ ] WAVE-2 — Implement Herdr adapter + define event API/contract (events,
  payloads, separation from the animation layer documented), tests

## Notes
- Owner decision 2026-07-21: detection via Herdr, NO custom detection logic.
- Architecture rule: event detection and character animation are strictly separate modules.
- Source: `Meetings/2026-07-21-planung/summary.md` (Recording Agent, Herdr 02:06:13).
