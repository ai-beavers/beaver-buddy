// Pure launch-flag parsers, unit-testable in isolation.
// Single-instance lock / app lifecycle remains integration territory.

import { isValidKeychainService } from './mrr/keychain';
import { DEFAULT_KEYCHAIN_SERVICE } from './mrr/mrr-config';
import { QUIP_POOLS, type QuipTrigger } from './quips/quips';

export const INJECT_XP_FLAG_PREFIX = '--inject-xp=';
export const QUIP_FLAG = '--quip';
export const KEYCHAIN_SERVICE_FLAG = '--keychain-service';
export const MRR_POLL_NOW_FLAG = '--mrr-poll-now';

const QUIP_TRIGGERS = Object.keys(QUIP_POOLS) as readonly QuipTrigger[];

function isQuipTrigger(value: string | undefined): value is QuipTrigger {
  return QUIP_TRIGGERS.includes(value as QuipTrigger);
}

// Dev acceptance flag: --quip <trigger> [--quip <trigger> ...] fires each
// named trigger through the real scheduler after window load — the
// scriptable acceptance mechanism, mirroring --inject-xp. Multiple
// occurrences let a single launch demonstrate the cooldown suppressing a
// second trigger fired immediately after the first.
export function parseQuipFlags(argv: readonly string[]): QuipTrigger[] {
  const triggers: QuipTrigger[] = [];
  argv.forEach((arg, i) => {
    if (arg === QUIP_FLAG && isQuipTrigger(argv[i + 1])) {
      triggers.push(argv[i + 1] as QuipTrigger);
    }
  });
  return triggers;
}

// Dev acceptance flag: --inject-xp=N adds N XP once at launch, through
// the real engine (see xp/engine.ts injectXp) — not a bypass.
// Stays in the shipped binary: harmless, local-only, no security surface.
export function parseInjectXp(argv: readonly string[]): number | null {
  const arg = argv.find((a) => a.startsWith(INJECT_XP_FLAG_PREFIX));
  if (!arg) return null;
  const value = Number(arg.slice(INJECT_XP_FLAG_PREFIX.length));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Dev flag: --keychain-service <name> overrides the Keychain service name
// (space-separated, like --quip) so QA never touches the real entries.
// A name failing isValidKeychainService (leading '-', stray charset,
// oversize) falls back to the default rather than reaching `security` argv.
export function parseKeychainService(argv: readonly string[]): string {
  const i = argv.indexOf(KEYCHAIN_SERVICE_FLAG);
  const value = i !== -1 ? argv[i + 1] : undefined;
  return value && isValidKeychainService(value) ? value : DEFAULT_KEYCHAIN_SERVICE;
}

export function hasMrrPollNowFlag(argv: readonly string[]): boolean {
  return argv.includes(MRR_POLL_NOW_FLAG);
}
