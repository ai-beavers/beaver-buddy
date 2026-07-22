# Milestone 3 — Recording Agent & Notifications

> Why it matters: **Core Cycle-1 feature** (Meeting 2026-07-21): The beaver detects
> when a coding agent has finished its work or needs input, and shows that
> visually — the actual benefit of the desktop pet for developers.

**Status:** not-started

**Accountable:** Jurij · **Agent:** Claude Code · **Duration (rough):** 2–3 weeks

## Architecture rules (owner decision from meeting + 2026-07-21)
- **Detection via Herdr (owner decision 2026-07-21):** For agent status detection
  we use **Herdr** — an open-source terminal overview tool for managing multiple
  coding agents in parallel. Herdr provides the detection/notification logic for
  which coding agent is done or needs input. We do **not build our own
  detection logic**; we integrate Herdr as the event source.
- **Strict separation:** One module monitors external agents (Herdr integration),
  a separate module controls the character animation. No mixing.
- **Security mechanism:** Animations must not be manually triggered by users
  without authorization (cheat protection for later XP/achievement relevance).
- Display starts with the existing Bubble/Quip system; dedicated animations
  (e.g. holding up a sign) follow from M5.

## Phases
- [ ] Phase 1 — Event detection via Herdr: evaluate + integrate Herdr (agent done / input needed), state model · **Blocked by:** none
- [ ] Phase 2 — Notification display: Bubble/Sign UX on events, non-invasive · **Blocked by:** M3/P1
- [ ] Phase 3 — Security gate & hardening: prevent manual triggering, document + test the Event↔Animation contract · **Blocked by:** M3/P1

## Success
- Beaver reliably reports "agent done" / "input needed" in live operation; events
  and animation are separate modules; no manual trigger path for users.

## Dependencies
- **Blocked by:** none (M1 ✅)
- **Blocks:** M5 sign/event animations (display), M6/P1 (contributor docs document the event/animation contract)

## Notes
- Source: `.flightplan/Meetings/2026-07-21-planung/summary.md` (Recording Agent 02:01:30,
  notifications 02:02:01, separation 02:05:22, Herdr 02:06:13, security mechanism).
