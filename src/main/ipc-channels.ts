// Narrow IPC channels, shared by main and preload so each string literal
// exists in exactly one place (preload carries a hand-synced copy of each —
// see preload.ts's top comment for why it can't import this module).
export const PAUSE_CHANGED_CHANNEL = 'state:paused';
export const PET_CHANGED_CHANNEL = 'state:pet';
// One-way main -> renderer only; no renderer -> main channel exists.
export const HATCH_START_CHANNEL = 'state:hatch';
// One-way main -> renderer only; carries a canned quip line + how long the
// renderer should keep it on screen.
export const QUIP_CHANGED_CHANNEL = 'state:quip';

// Settings-window-only, renderer -> main invoke/response channels (the
// app's first renderer-originated IPC). Never reachable from the pet
// overlay window/preload — only settings-preload.ts exposes them.
export const SETTINGS_SAVE_CHANNEL = 'settings:save';
export const SETTINGS_READ_STATUS_CHANNEL = 'settings:read-status';
export const SETTINGS_DISCONNECT_CHANNEL = 'settings:disconnect';
// Settings-window-only: wipe pet XP back to level 1 / baby (token cursor kept).
export const SETTINGS_RESET_PET_CHANNEL = 'settings:reset-pet';
// Settings-window-only: re-scan local Claude Code / Codex usage logs
// (booleans only — never paths). "Connect" = detect logs on this Mac.
export const SETTINGS_CONNECT_USAGE_CHANNEL = 'settings:connect-usage';
