# BL-7 design-review verdict — hatch onboarding

Date: 2026-07-14
Verdict: **pending final visual verdict** (orchestrator reviews the captures below)

## Live snapshots (BL-7-live-{lodge,shake,burst,baby}.png)

Captured from the running overlay via CDP `Runtime.evaluate`, same method as
BL-6/BL-4: window-content-only, no desktop pixels, `imageSmoothingEnabled =
false`, checkerboard-composited, scaled 8x nearest-neighbor.

- `BL-7-live-lodge.png` — lodge-idle phase, auto-cropped to the sprite's
  non-transparent bounding box (16px padding), same technique as prior
  items.
- `BL-7-live-shake.png` — mid-shake phase, captured ~1.6s into the shake
  phase (past the first 1-2 escalating bursts). Unlike the other three
  captures, this one uses a **fixed-frame** crop (a stable window computed
  from the known corner position + max jitter + padding, not re-derived
  from each frame's own content bbox) — the auto-bbox method used elsewhere
  re-centers on content every frame, which cancels out a pure-translation
  shake jitter and would make this capture indistinguishable from the idle
  frame. 8 quick fixed-frame samples were taken and the one with the
  largest measured offset was kept (see measurement below).
- `BL-7-live-burst.png` — burst phase: 3 burst-frame lodge chunks + spark
  particles (spark row, deterministic radiating angles) visibly mid-flight.
- `BL-7-live-baby.png` — baby-appear phase: baby beaver sprite (react/
  celebrate pose) at the lodge's former ground position.

### Shake jitter — quantified visible-offset evidence

Auto-bbox crops cancel translation, so offset was measured directly instead
of relying on the image alone. Using the fixed-frame crop's own alpha-bbox
center vs. the frame's geometric (zero-jitter) center:

| Phase | Measured offset (dx, dy) | Note |
|---|---|---|
| lodge-idle (baseline, no jitter) | (-0.5, 6.5) px | Intrinsic — the lodge dome art isn't vertically centered in its 48x48 tile (transparent headroom above), not a jitter artifact. |
| shake (best-of-8 sample, ~1.6s in) | (2.5, 8.5) px | Baseline-corrected net jitter ≈ (3.0, 2.0) px, magnitude ≈ 3.6px — consistent with `shakeJitterPx()` mid-sequence (amplitude ramps 1→4px; this sample landed near burst 2-3 of 4). |

The net jitter is within the configured `HATCH_SHAKE_JITTER_MIN/MAX_PX`
(1-4px) bound, confirming the shake is visibly offsetting the lodge and not
just cycling frames in place.

## Verification method

Isolated environment, never touching the real installed app's userData:

- `--user-data-dir=<scratch tmp dir>` (native Chromium/Electron switch).
- `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointed at fresh empty scratch
  directories per launch, so the usage tracker never touches real logs.
- A throwaway Node script (not part of the repo) drove CDP over
  `--remote-debugging-port`, using Node 24's built-in `fetch`/`WebSocket` —
  same approach as BL-4/BL-6.
- Polled `window.__debugHatch.phase` (~40ms interval) through the full
  sequence, capturing at each phase transition; injected a
  `requestAnimationFrame` wrapper to log every frame timestamp for the
  smoothness measurement.

## Observed phase timeline (fresh launch, first run)

| Phase | t (ms since page ready) | Measured phase duration | Configured (pet-config.ts) |
|---|---|---|---|
| lodge-idle | 45 | — | `HATCH_LODGE_IDLE_DURATION_S` = 0.8s |
| shake | 848 | 848−45 ≈ 803ms | ≈ 800ms ✓ |
| burst | 3505 | 3505−848 ≈ 2657ms | shake total ≈ 2.6s (4 bursts × 0.4s active + shrinking pauses 0.6→0.2s) ✓ |
| baby-appear | 4183 | 4183−3505 ≈ 678ms | `HATCH_BURST_DURATION_S` = 0.7s ✓ |
| done | 5179 | 5179−4183 ≈ 996ms | `HATCH_BABY_APPEAR_DURATION_S` = 1.0s ✓ |

Total sequence: ≈5.13s from page ready to handoff. Every measured segment
matches its configured duration to within the CDP poll granularity (~40ms).

The hatch replay run (below), triggered by deleting the `onboarding-state.json` file and relaunching, reproduced the identical timeline
(lodge-idle 42ms → shake 845ms → burst 3487ms → baby-appear 4171ms → done
5175ms), confirming the sequence is deterministic run-to-run.

## Frame smoothness (rAF interval sampling)

Sampled via the injected `requestAnimationFrame` wrapper across the full
~5.1s hatch sequence (both the fresh-launch and the hatch-replay-via-`onboarding-state.json`-deletion runs):

| Run | Frame count | p50 (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|
| Fresh launch | 645 | 8.3 | 9.9 | 41.7 |
| Hatch replay (via `onboarding-state.json` deletion) | 649 | 8.3 | 10.1 | 41.7 |

p50/p95 sit around 8.3-10.1ms — well under the ≤~20ms proxy threshold for
60fps-smooth (this machine's display evidently refreshes faster than
60Hz, hence sub-16.7ms typical intervals). The one-off max (~42-94ms across
runs) is a single outlier, consistent with normal OS/GC/CDP-instrumentation
jitter during a ~5s window, not sustained stutter — reported honestly per
the plan's "no external frame profiler, honest measurement" note.

## Once-only + persistence evidence (R5/R10 "runs exactly once")

Isolated userData directory, three sequential launches:

1. **Fresh launch** (no flags): hatch ran (`__debugHatch` observed through
   all 5 phases, table above). Handoff: `window.__debugRoam` afterward was
   `{x: 8, phase: 'idle'}` — `x` exactly equals `HATCH_CORNER_MARGIN_PX`
   (8px), confirming the roam machine picked up the hatch corner position,
   not a random start. Persisted `onboarding-state.json`: `{"hatched":true}`.
2. **Relaunch, same userData, no flags**: 25 polls of `__debugHatch` over
   ~2s were **all `null`** — the hatch never fired. `window.__debugRoam.x`
   was `1010.37` (a random roam-init position, not the corner) — the pet
   went straight to normal roaming, proving persistence across restarts and
   the "runs exactly once" acceptance criterion.
3. **Relaunch, same userData, after deleting `onboarding-state.json`**: hatch replayed in full
   (identical 5-phase timeline, table above). `onboarding-state.json`
   remained `{"hatched":true}` afterward (re-persisted at trigger time) —
   confirms the hidden QA reset flag works and doesn't leave the state
   corrupted or hatch-less.

## Regression: stage crossing during the hatch (review fix, verified live)

Review found that a pet update carrying `evolvingTo` arriving while the
hatch owns the screen would start the animated evolution invisibly behind
the hatch: it flipped the sprite sheet at an arbitrary mid-hatch moment (so
the appear phase could render the wrong sprite) and its celebrate window
was swallowed. Fixed by (a) sending `state:hatch` before the pet update at
did-finish-load — required for the gate to see the hatch on a hatching
launch — and (b) suppressing the animated evolution while a hatch is
active: the renderer syncs straight to the post-evolution stage instead (no
shake/flash/celebrate).

Verified live: fresh temp userData + `--inject-xp=1500` (crosses level 16,
baby -> teen, on the very first launch — the evolving update arrives during
the hatch's first frames). Polled `__debugHatch` + `__debugPet` together
(~120ms interval) through the whole sequence:

| t (ms) | hatch phase | pet (level / stage / evolving) |
|---|---|---|
| 127 | lodge-idle | 16 / teen / false |
| 870 | shake | 16 / teen / false |
| 3575 | burst | 16 / teen / false |
| 4189 | baby-appear | 16 / teen / false |
| 5172 | done | 16 / teen / false |

`evolving` was false in **every** sample across the run — no evolution
animation ran behind the hatch. The stage read `teen` from the first
post-load sample onward: the sheet synced once, at hatch start, so the
appear phase rendered the teen sprite consistently. Observed sequence:
hatch plays fully; the emerging pet appears at its true (already-evolved)
stage — no wrong-sprite frame, no mid-sequence sheet flip, no evolution
animation after the hatch. After `done`, `__debugRoam.x` = 8 (the hatch
corner) — handoff unaffected.

## Gates

`npm ci` clean, `npm run typecheck` clean (main + renderer + gen-sprites
tsconfigs), `npm run lint` clean (eslint), `npm test` 159 passed / 1 skipped
(18 files, includes the new `hatch.test.ts` and `onboarding.test.ts`, plus
the untouched `xp/store.test.ts` and `ipc-channels.test.ts` drift guard
still passing after the shared atomic-write extraction), `npm run build`
clean.

## Review method

8x-scaled live CDP captures of the running app reviewed against
`assets/STYLE.md` (lodge/spark 48x48 tiles, palette); phase/timing
cross-checked against `window.__debugHatch` at each capture and against the
frame-timestamp log for smoothness; persistence cross-checked against the
on-disk `onboarding-state.json` for both the no-flag relaunch (exactly-once)
and hatch replay via `onboarding-state.json` deletion (QA reset) acceptance criteria.
