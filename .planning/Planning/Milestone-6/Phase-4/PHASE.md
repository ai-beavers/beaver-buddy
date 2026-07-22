# Phase 4 — Release Pipeline & Distribution (#42–#45) → Z1 Exit

> Part of Milestone 6. Done when: the release pipeline (#42) ships version 0.2.0 (#43)
> with changelog (#44) and update mechanism (#45); downloads are counted;
> Cycle 1 exit criteria are measurable. **Multi-platform (team decision 2026-07-21):
> installers for Windows AND macOS built natively from one codebase.**

**Status:** not-started (Stub — detailed definition at phase start with Rodgi)

**Accountable:** Rodgi · **Agent:** pi
**Cycle:** Cycle 1
**Blocked by:** none (pipeline) — for the real release, sensible after M6/P3
**Blocks:** — (final step to Z1 exit)
**Duration (rough):** ~1 week

## Waves
- [ ] WAVE-1 — Release pipeline + versioning 0.2.0 + changelog (#42–#44)
  - electron-builder targets: **Windows (NSIS) + macOS (dmg/zip, arm64+x64)**
  - macOS signing + notarization (Apple Developer certificate — budget decision analogous to #4b; document unsigned fallback)
  - macOS runner in CI (builds + tests the Mac build)
- [ ] WAVE-2 — Update mechanism (#45) + download tracking (GitHub Releases or similar)

## Notes
- Z1 exit: ① app downloadable ② 100 downloads ③ 7 contributors.
- #4b (SmartScreen-free signature) remains an owner decision with budget — not exit-blocking.
