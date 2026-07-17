# BL-13 design-review verdict — tiered spend quips + voice

Date: 2026-07-16
Verdict: **PASS** (copy-tone)

## What changed

Replaces BL-8's binary rate-based `tokenSpike` trigger with three **daily
token-count** spend tiers. Quip voice locked to **all-lowercase**.

| Tier | Today's cumulative tokens | Trigger |
| --- | --- | --- |
| weak | 1 – 1,999,999 | `spendWeak` |
| ok | 2,000,000 – 19,999,999 | `spendOk` |
| crazy | ≥ 20,000,000 | `spendCrazy` |

Each tier fires **once per local calendar day** on the first upward crossing;
resets at midnight. Tokens only — no USD / cost model. Thresholds calibrated
from HN / community / Anthropic-docs research (see plan research notes).

## Learnings (copy)

- Readers don't always know this is about tokens — don't explain the dam
  metaphor or lecture the burn amount. React to the vibe.
- Avoid the fixed "sentence. Sentence." pattern on every line; vary rhythm.
- "dam" = beaver expression (like "damn"), not a literal dam-overflow bit.
- All-lowercase is non-negotiable for beaver voice (enforced in
  `quips.test.ts`).

## Full spend quip list (current)

Static strings, ≤60 chars, no emoji, no `!`, all-lowercase.

**spendWeak**
1. low token burn today, huh?
2. quiet day. soft launch energy.
3. barely cooking. cap.
4. touch grass mode. respect.
5. chill pace. dam.

**spendOk**
1. yo, you're shipping today.
2. valid grind. keep going.
3. main character hours.
4. built different today.
5. cooking. no notes.

**spendCrazy**
1. bro is cooking. dam.
2. you're shipping hard today.
3. absolute unit energy.
4. sending it. no chill.
5. context window go brrr.

(Other pools — `appStart`, `codingSession`, `idle`, `evolution` — were also
lowercased in this item so the beaver never mixes case. See
`src/main/quips/quips.ts`.)

## Smoke

```bash
npm start -- --quip spendWeak
npm start -- --quip spendOk
npm start -- --quip spendCrazy
```

## Settings: Connect (Claude Code / Codex)

Tray → **Connect…** opens the same Settings window as Growth → Settings….
Claude Code / Codex are **opt-in**: nothing is connected until you click
Connect (local logs alone never auto-connect). When connected, the UI shows
today + lifetime token counts per source. Disconnect opts out again.

## Supersedes

BL-8's `tokenSpike` pool and `TOKEN_SPIKE_RATE_PER_MIN` detector path. The
BL-8 verdict doc remains historical evidence for the original quip system.
