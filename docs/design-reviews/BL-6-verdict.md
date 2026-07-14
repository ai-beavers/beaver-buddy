# BL-6 design-review verdict — level & evolution system

Date: 2026-07-14
Verdict: **PASS**

## Live snapshots (BL-6-live-{shake,flash,teen,adult}.png)

Captured from the running overlay via CDP `Runtime.evaluate`, same method as
BL-4: the canvas's non-transparent bounding box, cropped with 16px padding
and scaled 8x nearest-neighbor (`imageSmoothingEnabled = false`).
Window-content-only, no desktop pixels.

- `BL-6-live-shake.png` — baby sprite mid-shake phase (level 15 -> 16 crossing).
- `BL-6-live-flash.png` — white silhouette blink (composite `source-in`
  fill), captured during the launch-crossing run below and composited over
  a checkerboard backdrop (like the BL-3 contact sheets) so the all-white
  frame stays legible: the silhouette matches the beaver's body+tail
  outline exactly, confirming only the sprite's opaque pixels go white.
- `BL-6-live-teen.png` — teen sprite, react/celebrate pose, right after the
  shake->flash->setStage->celebrate sequence completes.
- `BL-6-live-adult.png` — adult sprite (visibly broader/heavier than teen,
  per STYLE.md), react/celebrate pose, after the teen -> adult crossing.

## Verification method

Isolated environment, never touching the real installed app's userData:
- `--user-data-dir=<scratch tmp dir>` (native Chromium/Electron switch —
  the least invasive mechanism; zero app code needed).
- `CLAUDE_CONFIG_DIR` / `CODEX_HOME` pointed at empty scratch directories so
  the BL-5 usage tracker sees zero real tokens — the injected XP is the only
  source of accrual, keeping the level/xp timeline exact.
- `--inject-xp=N` (dev acceptance flag, shipped in the binary, routed
  through the real `XpEngine` — not a bypass).
- A throwaway Node script (not part of the repo) drove CDP over the
  Electron process's `--remote-debugging-port`, using Node 24's built-in
  `fetch`/`WebSocket` — same approach as BL-4, generalized to a
  reconnect-once burst capture to catch the ~1.8s evolution sequence.

## Observed level/xp/stage timeline

| Step | Action | Resulting xp | Level | Stage | evolvingTo |
|---|---|---|---|---|---|
| 1 | Fresh userData, `--inject-xp=1400` | 1400 | 15 | baby | — |
| 2 | Relaunch, `--inject-xp=100` (1400+100=1500) | 1500 | 16 | teen | teen (fires once) |
| 3 | Relaunch, **no** inject flag | 1500 | 16 | teen | — (persisted, no replay) |
| 4 | Relaunch, `--inject-xp=1600` (1500+1600=3100) | 3100 | 32 | adult | adult (fires once) |

`__debugPet` during step 2's evolution: 10 consecutive polls (~150ms apart)
showed `{level:16, stage:"baby", evolving:true}` (shake+flash in flight,
pre-evolution stage still displayed) before flipping in one step to
`{level:16, stage:"teen", evolving:false}`. Step 4 showed the same pattern
with `stage:"teen"` during the transition and `stage:"adult"` after.

Persisted `xp-state.json` after step 4: `{"xp":3100,"lastSeenLifetimeTokens":0}`
— `lastSeenLifetimeTokens` stayed 0 throughout, confirming `--inject-xp`
never touches the real-usage cursor.

## Launch-crossing verification (real-usage path, no injection)

The riskiest delivery path is a stage crossing caused by the tracker's
initial catch-up ingest at launch (user burned tokens while the app was
closed): the engine emits the evolution before the renderer page has
finished loading, so the live IPC send is dropped and only the
did-finish-load resend of the engine's last update can deliver it.
Exercised end-to-end:

- Fresh (second) temp userData; `CLAUDE_CONFIG_DIR` pointed at a synthetic
  fixture dir — one `projects/project-a/session-1.jsonl` with four fake
  entries (`req-synthetic-*`/`msg-synthetic-*` ids, no real content)
  totaling 160,000 tokens = 1600 XP = level 17, crossing baby -> teen on
  the very first ingest. **No** `--inject-xp` flag.
- `__debugPet` burst (~150ms apart): 10 consecutive polls of
  `{level:17, stage:"baby", evolving:true}` — the evolution animation
  played — then `{level:17, stage:"teen", evolving:false}`.
- Persisted `xp-state.json` afterwards:
  `{"xp":1600,"lastSeenLifetimeTokens":160000}` — the real-usage cursor
  moved (unlike the injection runs where it stayed 0).

## Bug found and fixed during verification

Step 4 (persisted teen state, inject straight into an adult crossing) is a
**fresh page load that starts already evolving** — the renderer's `stage`
local variable always initializes to `'baby'` on load. The first version of
`onPetChanged`'s `evolvingTo` branch started the shake/flash animation
without first syncing to the actual pre-evolution stage, so the shake
briefly played over the wrong (baby) sprite instead of teen. Fixed in
`src/renderer/renderer.ts` by syncing `stage` to `pet.stage` before calling
`startEvolution` whenever they differ. Re-verified live post-fix (frame log
above) — `stage:"teen"` now correctly precedes the flip to `"adult"`.

## Review method

8x-scaled live CDP captures of the running app, reviewed visually against
`assets/STYLE.md` sizing (adult visibly broader than teen); state
cross-checked against the renderer's read-only `__debugPet` diagnostic
surface at each capture, and against the persisted `xp-state.json` for the
no-inject relaunch (R8 "survives relaunch" acceptance).
