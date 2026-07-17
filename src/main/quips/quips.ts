// Canned quip pools (CLAUDE.md: "No telemetry. No LLM/OpenAI calls anywhere
// in the MVP. Quips are static strings.") — one array per trigger. No user
// data is interpolated into any of these except the evolution pool, whose
// entries may contain a single `{stage}` placeholder that scheduler.ts fills
// in with the pet's new stage name.
//
// Voice invariant: every line is all-lowercase. The beaver never capitalizes.

export type QuipTrigger =
  | 'appStart'
  | 'codingSession'
  | 'spendWeak'
  | 'spendOk'
  | 'spendCrazy'
  | 'idle'
  | 'evolution';

export const APP_START_QUIPS: readonly string[] = [
  'back already? i was mid-nap.',
  "morning. dam's still standing, don't worry.",
  "you're here. i'm here. let's build something.",
  'booted up. no rebuilding required today.',
  "ready when you are. i've been ready for hours.",
];

export const CODING_SESSION_QUIPS: readonly string[] = [
  'still going? respect the grind.',
  'look at you, chewing through this like timber.',
  'solid session. i timed it. i have nothing else to do.',
  "you've been at this a while. hydrate.",
  'this is a proper work session. i approve.',
];

export const SPEND_WEAK_QUIPS: readonly string[] = [
  'low token burn today, huh?',
  'quiet day. soft launch energy.',
  'barely cooking. cap.',
  'touch grass mode. respect.',
  'chill pace. dam.',
];

export const SPEND_OK_QUIPS: readonly string[] = [
  "yo, you're shipping today.",
  'valid grind. keep going.',
  'main character hours.',
  'built different today.',
  'cooking. no notes.',
];

export const SPEND_CRAZY_QUIPS: readonly string[] = [
  'bro is cooking. dam.',
  "you're shipping hard today.",
  'absolute unit energy.',
  'sending it. no chill.',
  'context window go brrr.',
];

export const IDLE_QUIPS: readonly string[] = [
  "quiet. too quiet. i'll just sit here.",
  "taking a break? i'll hold down the desktop.",
  'no tokens, no problem. i like the silence.',
  'idle hands, idle beaver. we match.',
  "nothing's moving. neither am i. zen.",
];

export const EVOLUTION_QUIPS: readonly string[] = [
  'leveled up to {stage}. wood you look at that.',
  'new stage: {stage}. same beaver energy.',
  'evolved to {stage}. i earned this.',
  'behold: {stage} form. slightly bigger, still smug.',
  '{stage} now. onward and upward.',
];

export const QUIP_POOLS: Readonly<Record<QuipTrigger, readonly string[]>> = {
  appStart: APP_START_QUIPS,
  codingSession: CODING_SESSION_QUIPS,
  spendWeak: SPEND_WEAK_QUIPS,
  spendOk: SPEND_OK_QUIPS,
  spendCrazy: SPEND_CRAZY_QUIPS,
  idle: IDLE_QUIPS,
  evolution: EVOLUTION_QUIPS,
};
