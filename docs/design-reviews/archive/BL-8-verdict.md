# BL-8 design-review verdict — quips

Date: 2026-07-14
Verdict: **pending final copy-tone / visual verdict** (orchestrator reviews the quip list and captures below)

> **Superseded in part by [BL-13](BL-13-verdict.md):** the `tokenSpike` trigger
> and rate-based detector were replaced by daily spend tiers
> (`spendWeak` / `spendOk` / `spendCrazy`) and all-lowercase voice. Quip list
> below is the BL-8-era snapshot kept for historical evidence.

## Full quip list (copy-tone review)

Static strings only (CLAUDE.md: no LLM/telemetry). All ≤60 chars, no emoji, no
exclamation marks. `{stage}` in the evolution pool is the one permitted
substitution (filled with the pet's new stage name); every other pool is
fully static. Max one beaver/dam/wood pun per pool.

**appStart**
1. Back already? I was mid-nap.
2. Morning. Dam's still standing, don't worry.
3. You're here. I'm here. Let's build something.
4. Booted up. No rebuilding required today.
5. Ready when you are. I've been ready for hours.

**codingSession**
1. Still going? Respect the grind.
2. Look at you, chewing through this like timber.
3. Solid session. I timed it. I have nothing else to do.
4. You've been at this a while. Hydrate.
5. This is a proper work session. I approve.

**tokenSpike**
1. You're burning tokens like crazy — nice.
2. Whoa, token furnace. Feed it.
3. That's a lot of tokens. Also, a lot of context.
4. Tokens flying. I can practically hear the API bill.
5. Someone's really going for it right now.

**idle**
1. Quiet. Too quiet. I'll just sit here.
2. Taking a break? I'll hold down the desktop.
3. No tokens, no problem. I like the silence.
4. Idle hands, idle beaver. We match.
5. Nothing's moving. Neither am I. Zen.

**evolution** (`{stage}` filled with the new stage: teen/adult)
1. Leveled up to {stage}. Wood you look at that.
2. New stage: {stage}. Same beaver energy.
3. Evolved to {stage}. I earned this.
4. Behold: {stage} form. Slightly bigger, still smug.
5. {stage} now. Onward and upward.

## Architecture summary

- `src/main/quips/quips.ts` — the five pools above, static data only.
- `src/main/quips/quip-config.ts` — cooldown (10 min), display duration
  (6s), token-spike rate threshold (2000 tok/min), coding-session length
  (20 min), idle length (15 min). No separate detector-poll-cadence
  constant: detectors ride the usage tracker's own refresh cadence (see
  Deviations below), so there's no second number to tune.
- `src/main/quips/scheduler.ts` — pure `(state, trigger, nowMs, rng,
  evolvedStage?) -> {state, text|null}`. One global cooldown across all
  triggers; per-trigger no-immediate-repeat tracked by pool index (robust to
  the evolution pool's `{stage}` substitution).
- `src/main/quips/detectors.ts` — pure `(state, {nowMs, lifetimeTokens}) ->
  {state, events}`. Emits `tokenSpike` on throughput above threshold,
  `codingSession` once per sustained nonzero-delta streak, `idle` once per
  sustained zero-delta streak. Tolerates arbitrary poll gaps (rate is
  measured over the actual elapsed interval, never assumed fixed).
- `src/renderer/bubble.ts` — pure `wrapText`/`layoutBubble` (char-count-based
  wrap + workArea clamp, unit-tested) plus a thin `drawBubble` canvas glue
  function (untested, sprites.ts's frameRect/drawFrame split).
- IPC: one new channel (`state:quip`, `QUIP_CHANGED_CHANNEL`), one new
  preload listener (`onQuip`), one new `__debugQuip` mirror. Still strictly
  one-way main → renderer.
- `--quip <trigger>` dev flag, repeatable, fires each named trigger through
  the real scheduler after did-finish-load — used below to demonstrate
  cooldown suppression within a single launch.

## Verification method

Same CDP method as BL-6/BL-7/BL-4: isolated `--user-data-dir=<scratch tmp
dir>`, `CLAUDE_CONFIG_DIR`/`CODEX_HOME` pointed at fresh empty scratch dirs
(never the operator's real logs/config), a throwaway Node 24 script (not
part of the repo) driving CDP over `--remote-debugging-port` with built-in
`fetch`/`WebSocket`. Screenshots: `Page.captureScreenshot` (window-content
only, real alpha, no desktop pixels), auto-cropped to the non-transparent
bounding box (16px padding), checkerboard-composited to make transparency
visible, scaled 8x nearest-neighbor. PNG decode/encode was hand-rolled with
`node:zlib` only (same no-image-dependency technique as
`scripts/gen-sprites/png.ts`), since the capture needs a decoder and the
existing encoder is indexed-color only.

## Evidence 1 — appStart quip on a non-hatch launch

Fresh temp userData, `onboarding-state.json` pre-seeded with
`{"hatched":true}` so the hatch is skipped and did-finish-load's natural
`appStart` trigger fires instead (per the plan's launch script: "hatched
state pre-seeded so appStart fires instead of hatch").

| t (ms since poll start) | `__debugQuip` |
|---|---|
| 0 | `null` |
| 41 | `"Back already? I was mid-nap."` |

Quip appeared on the very first poll after launch (well inside a single
did-finish-load tick) — matches "no more than one quip per cooldown window"
trivially (first quip of a fresh scheduler always fires) and confirms the
natural (non-flag) appStart path works end-to-end: main.ts's
did-finish-load handler → `state:quip` IPC → renderer `onQuip` → bubble
draw.

Capture: `BL-8-live-bubble.png` — 8x-scaled, checkerboard-composited,
auto-cropped to the bubble+pet non-transparent region (crop origin
(1875, 1877), size 240×155 pre-scale). Shows the pixel speech bubble (1px
slate outline, off-white fill, small monospace text, 3px downward tail)
sitting directly above the idle baby-stage pet.

## Evidence 2 — `--quip tokenSpike --quip idle`: cooldown suppression + bubble follows the pet

Fresh temp userData (also hatch-pre-seeded), launched with
`--quip tokenSpike --quip idle`. Both flags are processed in the same
did-finish-load tick — the second fires immediately after the first, well
inside the 10-minute cooldown — so this single launch exercises both "a
trigger fires through the real scheduler" and "a second trigger inside the
cooldown window is suppressed" per the plan's verify step.

`__debugQuip` polled every 150ms for 7.5s, alongside `__debugRoam.x`:

| t (ms) | `__debugQuip` | `__debugRoam.x` |
|---|---|---|
| 155 | `"Tokens flying. I can practically hear the API bill."` | 501.23 |
| 2631–3883 | same text, unchanged | 501.23 (pet was mid-idle-pause) |
| 4037 | same text, unchanged | 497.98 (walk begins) |
| 4824–5903 | same text, unchanged | 479.03 → 453.19 (steadily decreasing) |
| 6058 | `null` | 449.39 |
| 6210–7440 | `null` | continues decreasing (pet still walking) |

Findings:
- The shown text is `"Tokens flying. I can practically hear the API bill."`
  — a `tokenSpike`-pool line — confirming `--quip tokenSpike` fired through
  the real scheduler.
- Across all 39 samples where `__debugQuip` was non-null, the text is
  **identical** every time — it never became an `idle`-pool line. The
  immediately-following `--quip idle` call was suppressed by the cooldown,
  exactly as scheduled (`schedule()`'s `lastShownAtMs` gate).
- The quip disappeared at t=6058ms, ≈58ms after the configured
  `QUIP_DISPLAY_DURATION_MS` (6000ms) — the overshoot is exactly the 150ms
  poll interval's granularity, not a timing bug (renderer's own
  `showUntilMs` check runs every rAF frame, independent of this poll).
- `__debugRoam.x` changed continuously (501.23 → 453.19) while
  `__debugQuip` stayed set to the same text — the bubble followed the pet
  while walking, confirmed live (not just by code inspection: `bubble.ts`'s
  `layoutBubble` is recomputed from the pet's current draw position on
  every `draw()` call, so a moving pet with an active quip necessarily
  redraws the bubble at the new position).

Capture: `BL-8-live-walking.png` — same method, taken at the first sample
where `__debugRoam.x` had visibly moved while the same quip text was still
showing (crop origin (883, 1857), size 290×175 pre-scale). Shows the bubble
correctly repositioned above the pet at its new (walking) location, facing
the opposite direction from evidence 1's capture.

## Evidence 3 — launch-time evolution quip (review fix, verified live)

Review found that a quip fired before did-finish-load (e.g. the evolution
trigger from launch-time XP accrual) was dropped by `webContents.send` yet
still burned the scheduler cooldown — which then suppressed the appStart
quip too: a silent zero-quip launch. Fixed by making `fireQuip` a full
no-op until the page has loaded and replaying the launch-time evolution
inside the did-finish-load handler from the engine's `getLastUpdate()` —
the same resend pattern already used for PET_CHANGED. Live evolutions
after load still flow through `xpEngine.onUpdate`; no double-fire is
possible because the pre-load emission never reaches the scheduler and the
replay reads `getLastUpdate()` exactly once, synchronously, inside the
same handler that flips the gate.

Verified live: fresh temp userData, `onboarding-state.json` pre-seeded
`{"hatched":true}`, launched with `--inject-xp=1500` (crosses level 16,
baby → teen, before the page loads — the evolving update is emitted during
launch-time accrual, exactly the broken scenario). `__debugQuip` +
`__debugPet` polled every 200ms for 8s:

| t (ms) | `__debugQuip` | `__debugPet` |
|---|---|---|
| 213 | `"Behold: teen form. Slightly bigger, still smug."` | level 16, stage baby, evolving: true |
| 213–5920 | same text, unchanged (29 consecutive samples) | evolution animation in flight |
| 6124 | `null` | — |

Findings:
- The evolution quip **appeared** after load (previously it would have
  been silently dropped), with `{stage}` correctly filled with `teen`.
- It was the **only** quip text seen in the whole window — no
  appStart-pool line ever showed. appStart being suppressed by the
  cooldown the evolution quip burned is the expected one-quip-per-window
  behavior (one quip on screen, never zero and never two).
- Quip cleared between 5920 and 6124ms — the 6000ms display duration,
  within the 200ms poll granularity.
- Covered at the unit level by the new scheduler test "launch sequence
  (evolution then appStart in the same tick)".

## Gates

`npm ci` clean, `npm run typecheck` clean (main + renderer + gen-sprites
tsconfigs), `npm run lint` clean (eslint, 0 errors/warnings), `npm test`
**202 passed / 1 skipped** (22 files — 5 new: `quips/scheduler.test.ts`,
`quips/detectors.test.ts`, `quips/quips.test.ts`, `renderer/bubble.test.ts`,
plus the extended `usage/tracker.test.ts` and `ipc-channels.test.ts` drift
guard, all still passing), `npm run build` clean.

## Review method

8x-scaled live CDP captures reviewed against `assets/STYLE.md` (bubble uses
palette keys `8` off-white fill / `k` slate outline+text, matching every
sprite's 1px-outline rule); quip text cross-checked against
`window.__debugQuip` at each capture; cooldown/no-repeat behavior
cross-checked against the scheduler's own unit tests and the live timeline
above; bubble-follows-pet cross-checked against `window.__debugRoam.x`
moving continuously under an unchanged `__debugQuip`.

One honest observation for the copy/visual gate: the canvas monospace font
renders with light anti-aliasing when scaled 8x (visible softness on glyph
edges in both captures) — unlike the hand-authored pixel sprites, which are
crisp at any integer scale. This is the plan's own auto-decision ("small
monospace canvas font, not a custom bitmap font... design gate judges the
result") — flagging it explicitly rather than silently calling it
equivalent to the sprite art's crispness.

## Deviations from the plan (with rationale)

1. **No separate `QUIP_DETECTOR_POLL_MS` constant in `quip-config.ts`.**
   The plan lists "detector poll cadence" among the config module's tuning
   values, but its own Auto-decisions section says "Detectors ride the
   tracker's existing refresh cadence — no second polling system." A
   constant that just re-names `usage/config.ts`'s `USAGE_REFRESH_MS`
   would be a second name for the same number, not a tuning knob — skipped
   per YAGNI, documented instead as a comment in `quip-config.ts` and
   `usage/tracker.ts`.
2. **`UsageTracker` extended with `onTick`, distinct from `onChange`.**
   Idle detection needs a snapshot even when nothing changed (that's the
   definition of idle), but the existing `onChange` only fires on an actual
   file-content change. Added `onTick` (fires every refresh, changed or
   not) sharing the tracker's one existing `setInterval` — no second timer,
   consistent with the plan's "no new timers beyond one poll interval if
   needed."
3. **`dirtyRect` generalized from `{x,y,size}` (square) to
   `{x,y,width,height}` (rect).** The bubble is wider than it is tall and
   needs to union with the pet's square dirty rect; a square-only type
   couldn't express that. All existing call sites (hatch draw's three
   assignments, the pet-only draw path) were mechanically updated to the
   new shape with no behavior change (`width === height` everywhere except
   when a bubble is showing).
4. **`--quip` accepts multiple occurrences** (`--quip tokenSpike --quip
   idle`), not just one. The plan describes the flag singular
   (`--quip <trigger>`), but the verify step itself needs to demonstrate
   cooldown suppression "in the same window" from one running process —
   in-memory scheduler state doesn't survive a relaunch, so a second
   process can't be used to test the cooldown. Repeatable flags, fired in
   argv order inside the same did-finish-load tick, is the smallest change
   that makes the plan's own acceptance script runnable.
5. **Evolution quips are not suppressed during a hatch launch.** The plan's
   wiring section only says "evolution event from the existing xp engine
   update (evolvingTo set)" — no hatch-specific gating is specified, and
   none was added. In practice this is a non-issue: `renderer.ts`'s
   `draw()` early-returns to `drawHatch()` while a hatch is active, so a
   quip fired mid-hatch simply cannot render until the hatch sequence ends
   (or silently expires first) — the existing draw-branch structure handles
   it for free, no extra code needed.

## Test coverage added

- `src/main/quips/scheduler.test.ts` — cooldown window (suppression +
  release), no-immediate-repeat under an adversarial rng, determinism,
  evolution `{stage}` substitution.
- `src/main/quips/detectors.test.ts` — spike-threshold edge (exactly at
  vs. just above), sustained coding-session boundary, idle fires once per
  stretch (and again after a fresh stretch), poll-gap tolerance (huge gaps
  measured correctly for both spike rate and idle).
- `src/main/quips/quips.test.ts` — data invariants (≤60 chars including
  worst-case `{stage}` substitution, no emoji/`!`, ≥2 lines per pool).
- `src/renderer/bubble.test.ts` — word-wrap at the char limit, box sizing
  from wrapped lines, centering above the pet, x/y clamping at all four
  workArea edges, tail-tip containment.
- `src/main/usage/tracker.test.ts` — new `onTick` case (fires on every
  refresh vs. `onChange`'s change-only firing).
- `src/main/ipc-channels.test.ts` — extended drift guard for
  `QUIP_CHANGED_CHANNEL`.
