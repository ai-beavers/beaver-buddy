# Milestone 6 — Contribution Readiness & Release (Cycle 1 Exit)

> Why it matters: Cycle 1 only ends once the app is publicly downloadable and new
> contributors can get productive (Meeting 2026-07-21: "Prioritization starting
> with the preparation for external contributions").

**Status:** not-started

**Accountable:** Rodgi (everyone reviews along) · **Agent:** pi · **Duration (rough):** ~2 weeks

## Cycle 1 Exit Criteria
1. Working, downloadable app (Windows installer via release pipeline)
2. 100 downloads
3. 7 contributors (currently 3: Rodgi, Vlady, Jurij)

## Phases
- [ ] Phase 1 — Contributor docs & API/Asset-Builder docs: workflow docs (Asset-Builder,
  PixiJS skills), Event/Animation contract, Character-Map reference · **Blocked by:** M3, M4 (documents their architecture)
- [ ] Phase 2 — Settings & Tray: settings window (#33), tray menu (#34), persistent settings (#35), autostart (#36) · **Blocked by:** none
- [ ] Phase 3 — QA & Design Gates: HiDPI screenshots (#37), design gates (#38), performance (#39), E2E (#40), manual acceptance (#41) · **Blocked by:** M5 Z1 scope (P1–P5)
- [ ] Phase 4 — Release Pipeline & Distribution: pipeline (#42), version 0.2.0 (#43), changelog (#44), update mechanism (#45), download tracking · **Blocked by:** none → **Z1 Exit**
  - **Multi-platform (team decision 2026-07-21):** installers for **Windows AND macOS** built natively from one codebase (electron-builder); macOS signing/notarization (Apple Developer certificate, budget decision) + macOS CI runner

## Success
Release 0.2.0 publicly downloadable; an external contributor can get started using
only the docs; download counting is running.

## Dependencies
- **Blocked by:** M3 + M4 (P1), M5 Z1 scope (P3) — P2/P4 can start anytime
- **Blocks:** Cycle 1 exit

## Notes
- Post-Z1 (carried over from old M4): overlay & window behavior #28–#32.
- Item specs: `.flightplan/Reference/windows-native-flight-plan.md` (#28–#45).
