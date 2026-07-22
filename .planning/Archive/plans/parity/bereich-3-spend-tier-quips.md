# Area 3 — Spend-Tier Quips (Parity Analysis macOS ↔ Windows)

Scope: `src/main/quips/detectors.ts`, `src/main/quips/quips.ts`, `src/main/quips/quip-config.ts`, `src/main/quips/detectors.test.ts` (+ data sources `src/main/usage/totals.ts`, `src/main/usage/tracker.ts`, wiring `src/main/main.ts`). State: merge `d7acaf0`.

## 1. Verdict: PARITY OK

0 gaps, 0 Windows-specific risks. The spend-tier quips (daily token-count tiers, lowercase voice) do not depend on any macOS-specific paths, date, or locale assumptions; the merge resolution of the detector↔tracker wiring is intact and byte-identical to upstream; all 66 tests in this area pass on this Windows machine.

## 2. Findings

No [gap] or [risk] findings.

**Parity-neutral observation (not a Windows gap, affects both platforms identically):** The tier announcement on the first snapshot (mid-day launch, `detectors.ts:69-80`) is in practice always swallowed: `usageTrackerInstance.start()` (`main.ts:358`) fires the first onTick synchronously before `rendererReadyForQuips = true` is set (`main.ts:400`), and `fireQuip` is a no-op before that (`main.ts:71-72`) — but the detector already marks the tier as announced (`detectors.ts:77-79`), so it does not fire again until the next tier crossing/midnight. Since the code is identical to upstream (`git show d7acaf0^2:src/main/main.ts`, lines 297-307), this is not a parity problem but an upstream design question. Fix proposal (no new dependencies, upstream-suitable): feed the first detector run only in the `did-finish-load` handler, or re-fire the launch tier event after loading, analogous to the evolution replay (`main.ts:406-408`).

## 3. Verified-OK List

- **(a) Origin of the daily token counts:** `todayTotalTokens(totals, nowMs)` reads the `daily` map from `aggregate()` (`src/main/usage/totals.ts:56-58`, `60-71`); entries are produced by the parsers via `Date.parse(ISO string)` (`claude-parser.ts:54`, `codex-parser.ts:84`); feeding into the detector per tick in `main.ts:365-374`.
- **(b) No macOS paths / TZ traps:** `localDateKey` deliberately uses local calendar days (documented: ccusage acceptance metric, `totals.ts:44-52`) — numeric `getFullYear/getMonth/getDate`, no ICU/locale dependency, identical semantics on Windows. Path discovery has explicit, tested win32 branches (`paths.ts:54-56`, `141-149`; tests `paths.test.ts:66-104`, `143-178`).
- **(c) Detector→tracker wiring intact:** merge result `main.ts:364-374` is byte-identical to upstream (`d7acaf0^2`, ll. 297-307). The tracker.ts conflict resolution keeps upstream's opt-in API (`setEnabledSources`/`getSourcesSnapshot`, `tracker.ts:74-97`) plus our async-tolerant listeners (`tracker.ts:100-114`, `207-218`); `onTick` fires on every refresh (`tracker.ts:214-218`). No `tokenSpike`/`TOKEN_SPIKE` remnant left in the code (grep over `src/` is empty).
- **Tier logic & midnight reset:** tier crossing fires only on the way up (`detectors.ts:100-107`), reset via local date key (`detectors.ts:94-99`); across midnight without new log writes, `todayTotalTokens` correctly returns 0, because the `daily` map buckets by entry timestamp, not by "now".
- **(d) Tests run on Windows:** `npx vitest run src/main/quips src/main/usage/totals.test.ts src/main/usage/tracker.test.ts` → 66/66 green on this machine. `detectors.test.ts` has no path/locale dependencies; the midnight tests (`detectors.test.ts:96-97`, `totals.test.ts:32-33`) construct both points in time in local time → timezone-independent; no test date falls on a DST transition.
- **Lowercase voice safeguarded:** copy invariants test incl. `line.toLowerCase()` check (`quips.test.ts:28-32`), platform-independent (ASCII-only pools).
- **QA flag covered:** the `--quip` trigger list is derived from `Object.keys(QUIP_POOLS)` (`main.ts:35`) and automatically includes `spendWeak/spendOk/spendCrazy`.

## 4. Proposed Flight-Plan Items

No gaps → no mandatory items. Optional (parity-neutral, possibly better upstream):

- **"Launch tier quip is swallowed"** — replay the first spend-tier event after `did-finish-load` (analogous to the evolution replay), so that the mid-day launch announcement becomes visible; affects macOS and Windows equally.
