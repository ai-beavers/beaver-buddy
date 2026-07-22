# Phase 4 — Release-Pipeline & Distribution (#42–#45) → Z1-Exit

> Part of Milestone 6. Done when: Release-Pipeline (#42) Version 0.2.0 (#43) mit Changelog
> (#44) und Update-Mechanismus (#45) ausliefert; Downloads werden gezählt;
> Zyklus-1-Exit-Kriterien sind messbar. **Multiplattform (Teambeschluss 2026-07-21):
> Installer für Windows UND macOS nativ aus einer Codebasis.**

**Status:** not-started (Stub — Detail-Definition zu Phasenbeginn mit Rodgi)

**Accountable:** Rodgi · **Agent:** pi
**Zyklus:** Zyklus 1
**Blocked by:** none (Pipeline) — für den echten Release sinnvoll nach M6/P3
**Blocks:** — (letzter Schritt zu Z1-Exit)
**Dauer (grob):** ~1 Woche

## Waves
- [ ] WAVE-1 — Release-Pipeline + Versionierung 0.2.0 + Changelog (#42–#44)
  - electron-builder-Targets: **Windows (NSIS) + macOS (dmg/zip, arm64+x64)**
  - macOS-Signing + Notarisierung (Apple-Developer-Zertifikat — Budget-Entscheid analog #4b; unsigned Fallback dokumentieren)
  - macOS-Runner in CI (baut + testet den Mac-Build)
- [ ] WAVE-2 — Update-Mechanismus (#45) + Download-Tracking (GitHub Releases o. ä.)

## Notes
- Z1-Exit: ① App downloadbar ② 100 Downloads ③ 7 Contributors.
- #4b (SmartScreen-freie Signatur) bleibt Owner-Entscheid mit Budget — nicht exit-blockierend.
