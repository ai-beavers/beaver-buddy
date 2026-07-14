// Canned quip pools (CLAUDE.md: "No telemetry. No LLM/OpenAI calls anywhere
// in the MVP. Quips are static strings.") — one array per trigger. No user
// data is interpolated into any of these except the evolution pool, whose
// entries may contain a single `{stage}` placeholder that scheduler.ts fills
// in with the pet's new stage name.

export type QuipTrigger = 'appStart' | 'codingSession' | 'tokenSpike' | 'idle' | 'evolution';

export const APP_START_QUIPS: readonly string[] = [
  'Back already? I was mid-nap.',
  "Morning. Dam's still standing, don't worry.",
  "You're here. I'm here. Let's build something.",
  'Booted up. No rebuilding required today.',
  "Ready when you are. I've been ready for hours.",
];

export const CODING_SESSION_QUIPS: readonly string[] = [
  'Still going? Respect the grind.',
  'Look at you, chewing through this like timber.',
  'Solid session. I timed it. I have nothing else to do.',
  "You've been at this a while. Hydrate.",
  'This is a proper work session. I approve.',
];

export const TOKEN_SPIKE_QUIPS: readonly string[] = [
  "You're burning tokens like crazy — nice.",
  'Whoa, token furnace. Feed it.',
  "That's a lot of tokens. Also, a lot of context.",
  'Tokens flying. I can practically hear the API bill.',
  "Someone's really going for it right now.",
];

export const IDLE_QUIPS: readonly string[] = [
  "Quiet. Too quiet. I'll just sit here.",
  "Taking a break? I'll hold down the desktop.",
  'No tokens, no problem. I like the silence.',
  'Idle hands, idle beaver. We match.',
  "Nothing's moving. Neither am I. Zen.",
];

export const EVOLUTION_QUIPS: readonly string[] = [
  'Leveled up to {stage}. Wood you look at that.',
  'New stage: {stage}. Same beaver energy.',
  'Evolved to {stage}. I earned this.',
  'Behold: {stage} form. Slightly bigger, still smug.',
  '{stage} now. Onward and upward.',
];

export const QUIP_POOLS: Readonly<Record<QuipTrigger, readonly string[]>> = {
  appStart: APP_START_QUIPS,
  codingSession: CODING_SESSION_QUIPS,
  tokenSpike: TOKEN_SPIKE_QUIPS,
  idle: IDLE_QUIPS,
  evolution: EVOLUTION_QUIPS,
};
