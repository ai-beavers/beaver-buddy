# Milestone 1 — Windows-native App

> Why it matters: Beaver Buddy runs fully on Windows 10/11 — overlay, tray, secret store, installer, parity with the upstream (`ai-beavers/beaver-buddy`).

**Status:** done (2026-07-17)

## Phases
- [x] Phase 1 — Windows infrastructure: Secret Store (#1), auto-hide taskbar (#2), icon placeholder (#3), signing infra (#4a), installer localization (#5), shortcuts (#6)
- [x] Phase 2 — Round 2 parity & polish (#46–#62, incl. upstream merge `d7acaf0`)

## Success
- Windows build green: typecheck / lint / 441+ tests / electron-builder ✅
- `upstream/main` semantically merged, parity items #49–#62 completed

## Open remaining items (deliberately deferred)
- #3 Final designer icon pass (placeholder: programmatically generated from sprite)
- #4b SmartScreen-free signature (documented, paid certificate — owner decision)
- #63/#64 optional, owner decision pending

## Evidence
- Detail plan & processing status: `.flightplan/Reference/windows-native-flight-plan.md`
- Phase logs round 1: `.flightplan/Archive/phase-{1..5}-{plan,implementation-log,verification-report,completion}.md`
- Parity reports: `.flightplan/Archive/plans/parity/`
- Design gates: `docs/design-reviews/`

---

## Decision record — Cross-platform scope (formerly ADR 002)

> Migrated here from the public repo (2026-07-18): the decision doc lives in
> local planning; the outcome is publicly documented in README/CLAUDE.md/
> CONTRIBUTING.md (scope notes, platform notes).
> Original file: `docs/adr/002-cross-platform-scope.md` (removed).

**Status:** Accepted · **Date:** 2026-07-15
**Update 2026-07-21 (team meeting):** macOS is upgraded from "preserved, not
actively extended" to **actively shipped** — Beaver Buddy ships as a
**multi-platform app native for Windows AND macOS** (Electron makes the same
codebase possible on both OSes). Consequence: the release pipeline (M6/P4)
builds + signs both platforms; macOS signing/notarization needs an Apple
Developer certificate (budget decision analogous to #4b).

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
- Build items were tracked in `.flightplan/Archive/WINDOWS_PORT_PLAN.md` — later
  replaced by `.flightplan/Reference/windows-native-flight-plan.md`; current planning lives in
  `.flightplan/`.
- The existing macOS code paths are not removed; they are wrapped behind
  adapters so both platforms build from the same source.
- A Windows CI runner was added to catch platform-specific regressions early.
- An ADR was required because the decision is cross-cutting (affects shell,
  security, build, packaging, and documentation) and hard to reverse once
  Windows users have installs in the wild.
