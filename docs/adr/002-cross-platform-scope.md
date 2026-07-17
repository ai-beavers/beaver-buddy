# ADR 002: Cross-platform scope — macOS and Windows

## Status

Accepted

## Date

2026-07-15

## Context

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

## Decision

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

## Consequences

- `PRD.md`, `CLAUDE.md`, and `README.md` are updated to reflect macOS + Windows
  support and the current Windows focus.
- New build items are tracked in `.fp-new-projekt/WINDOWS_PORT_PLAN.md` (or a
  successor planning document).
- The existing macOS code paths are not removed; they are wrapped behind
  adapters so both platforms build from the same source.
- A Windows CI runner is added to catch platform-specific regressions early.
- An ADR is required because the decision is cross-cutting (affects shell,
  security, build, packaging, and documentation) and hard to reverse once
  Windows users have installs in the wild.
