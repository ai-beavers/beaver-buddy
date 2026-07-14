// Narrow IPC channels, shared by main and preload so each string literal
// exists in exactly one place (preload carries a hand-synced copy of each —
// see preload.ts's top comment for why it can't import this module).
export const PAUSE_CHANGED_CHANNEL = 'state:paused';
export const PET_CHANGED_CHANNEL = 'state:pet';
// One-way main -> renderer only; no renderer -> main channel exists.
export const HATCH_START_CHANNEL = 'state:hatch';
