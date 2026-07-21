# Milestone 1 — Windows-native App

> Why it matters: Beaver Buddy läuft unter Windows 10/11 vollwertig — Overlay, Tray, Secret Store, Installer, Parität mit dem Upstream (`ai-beavers/beaver-buddy`).

**Status:** done (2026-07-17)

## Phases
- [x] Phase 1 — Windows-Infrastruktur: Secret Store (#1), Auto-Hide-Taskbar (#2), Icon-Provisorium (#3), Signing-Infra (#4a), Installer-Lokalisierung (#5), Shortcuts (#6)
- [x] Phase 2 — Runde 2 Parität & Feinschliff (#46–#62, inkl. Upstream-Merge `d7acaf0`)

## Success
- Windows-Build grün: typecheck / lint / 441+ Tests / electron-builder ✅
- `upstream/main` semantisch gemergt, Paritäts-Items #49–#62 abgeschlossen

## Offene Restpunkte (bewusst verschoben)
- #3 Finaler Designer-Icon-Pass (Provisorium: programmatisch aus Sprite generiert)
- #4b SmartScreen-freie Signatur (dokumentiert, kostenpflichtiges Zertifikat — Owner-Entscheidung)
- #63/#64 optional, Owner-Entscheidung ausstehend

## Belege
- Detailplan & Abarbeitungsstand: `.flightplan/Reference/windows-native-flight-plan.md`
- Phasen-Logs Runde 1: `.flightplan/Archive/phase-{1..5}-{plan,implementation-log,verification-report,completion}.md`
- Paritäts-Berichte: `.flightplan/Archive/plans/parity/`
- Design-Gates: `docs/design-reviews/`

---

## Decision record — Cross-platform scope (ehemals ADR 002)

> Aus dem öffentlichen Repo hierher migriert (2026-07-18): Die Entscheidungs-Doku
> lebt in der lokalen Planung; das Ergebnis ist öffentlich in README/CLAUDE.md/
> CONTRIBUTING.md dokumentiert (Scope-Notes, Plattform-Hinweise).
> Original-Datei: `docs/adr/002-cross-platform-scope.md` (entfernt).

**Status:** Accepted · **Date:** 2026-07-15
**Update 2026-07-21 (Teambesprechung):** macOS wird von „preserved, not actively
extended" auf **aktiv ausgeliefert** hochgestuft — Beaver Buddy wird als
**Multiplattform-App nativ für Windows UND macOS** ausgeliefert (Electron macht
dieselbe Codebasis auf beiden OS möglich). Konsequenz: Release-Pipeline (M6/P4)
baut + signiert beide Plattformen; macOS-Signing/Notarisierung braucht Apple-
Developer-Zertifikat (Budget-Entscheid analog #4b).

### Context

Beaver Buddy was originally scoped as a macOS-only desktop pet (PRD.md
explicitly listed "No Windows/Linux" and CLAUDE.md described it as "a pixel-art
desktop beaver for macOS"). The codebase was built on Electron + TypeScript with
macOS-specific assumptions in four areas:

1. Overlay window level (`setAlwaysOnTop(true, 'floating')`).
2. Tray icon template image (`nativeImage.setTemplateImage`).
3. Secret storage (`security` CLI / macOS Keychain).
4. Usage-log path discovery (`~/.claude`, `~/.config/claude`, `~/.codex`).

The product goal has expanded: the app should run natively on **macOS and
Windows**, managed from a single codebase. The current development focus is on
building out the Windows implementation; macOS support is preserved but not
actively extended.

### Decision

We will keep one repository and one Electron codebase, but introduce small,
platform-specific adapters where macOS-only behavior exists. The app will:

- Continue to launch on macOS 14+ without regression.
- Launch on Windows 10/11 with feature parity for the MVP overlay, tray,
  usage-log tracking, XP/evolution, and optional MRR mode.
- Use Electron's cross-platform APIs where possible and narrow platform
  branches only where necessary (overlay level, tray icon, secret store, log
  paths).

### Platform-specific adapters

| Concern | macOS | Windows |
|---|---|---|
| Overlay always-on-top level | `'floating'` (kept below menu bar/Dock) | `'pop-up-menu'` or higher (kept above Taskbar) |
| Tray icon | Template PNG via `setTemplateImage(true)` | Colored `.ico` or PNG |
| Secret storage | `security` CLI / Keychain | Platform secure store (Credential Manager or `safeStorage`) |
| Usage-log defaults | `~/.claude`, `~/.config/claude`, `~/.codex` | `%USERPROFILE%\.claude`, `%USERPROFILE%\.codex`, plus Windows-specific defaults if documented |
| Build scripts | Unix shell chain | Node.js-based cross-platform script |
| Packaging | `dmg` target | `nsis` + `portable` targets |

### Consequences

- `PRD.md`, `CLAUDE.md`, and `README.md` were updated to reflect macOS + Windows
  support and the current Windows focus.
- Build items were tracked in `.flightplan/Archive/WINDOWS_PORT_PLAN.md` — später
  ersetzt durch `.flightplan/Reference/windows-native-flight-plan.md`; aktuelle Planung lebt in
  `.flightplan/`.
- The existing macOS code paths are not removed; they are wrapped behind
  adapters so both platforms build from the same source.
- A Windows CI runner was added to catch platform-specific regressions early.
- An ADR was required because the decision is cross-cutting (affects shell,
  security, build, packaging, and documentation) and hard to reverse once
  Windows users have installs in the wild.
