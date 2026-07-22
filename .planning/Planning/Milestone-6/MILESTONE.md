# Milestone 6 — Contribution-Readiness & Release (Zyklus-1-Exit)

> Why it matters: Zyklus 1 endet erst, wenn die App öffentlich downloadbar ist und neue
> Contributors produktiv einsteigen können (Meeting 2026-07-21: „Priorisierung beginnend
> mit der Vorbereitung für externe Contributions").

**Status:** not-started

**Accountable:** Rodgi (alle reviewen mit) · **Agent:** pi · **Dauer (grob):** ~2 Wochen

## Zyklus-1-Exit-Kriterien
1. Funktionierende, herunterladbare App (Windows-Installer via Release-Pipeline)
2. 100 Downloads
3. 7 Contributors (aktuell 3: Rodgi, Vlady, Jurij)

## Phases
- [ ] Phase 1 — Contributor-Doku & API/Asset-Builder-Doku: Workflow-Doku (Asset-Builder,
  PixiJS-Skills), Event/Animation-Contract, Character-Map-Referenz · **Blocked by:** M3, M4 (dokumentiert deren Architektur)
- [ ] Phase 2 — Einstellungen & Tray: Settings-Fenster (#33), Tray-Menü (#34), persistente Einstellungen (#35), Autostart (#36) · **Blocked by:** none
- [ ] Phase 3 — QA & Design-Gates: HiDPI-Screenshots (#37), Design-Gates (#38), Performance (#39), E2E (#40), manuelle Akzeptanz (#41) · **Blocked by:** M5 Z1-Umfang (P1–P5)
- [ ] Phase 4 — Release-Pipeline & Distribution: Pipeline (#42), Version 0.2.0 (#43), Changelog (#44), Update-Mechanismus (#45), Download-Tracking · **Blocked by:** none → **Z1-Exit**
  - **Multiplattform (Teambeschluss 2026-07-21):** Installer für **Windows UND macOS** nativ aus einer Codebasis (electron-builder); macOS-Signing/Notarisierung (Apple-Developer-Zertifikat, Budget-Entscheid) + macOS-CI-Runner

## Success
Release 0.2.0 öffentlich downloadbar; ein externer Contributor schafft den Einstieg nur
mit der Doku; Download-Zählung läuft.

## Dependencies
- **Blocked by:** M3 + M4 (P1), M5 Z1-Umfang (P3) — P2/P4 jederzeit startbar
- **Blocks:** Zyklus-1-Exit

## Notes
- Post-Z1 (aus altem M4 übernommen): Overlay & Fensterverhalten #28–#32.
- Item-Specs: `.flightplan/Reference/windows-native-flight-plan.md` (#28–#45).
