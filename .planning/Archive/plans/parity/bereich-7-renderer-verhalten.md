# Area 7 — Renderer Behavior Parity: Hatch / Evolution / Roam / Pet Config

## 1. Verdict: PARITY OK

**0 gaps, 2 risks.** In the area examined, upstream brought exactly one
renderer commit (`9c8bd00`, `git log --oneline 833de1f..upstream/main -- src/renderer/`);
merge d7acaf0 took it over in full — `pet-config.ts`, `bubble.ts`,
`hatch.ts` and `evolution.ts` are **byte-identical to upstream/main** (empty
`git diff upstream/main HEAD`). Our branch delta is a pure superset
(`canvas-dpr.ts`, `onBoundsChanged`, DPR resize watcher, `clampRoamStateToBounds`,
our own adult sheet). Hatch, evolution, and roam logic are dt-based,
platform-neutral state machines without a single `process.platform` branch in
all of `src/renderer/`. 52/52 renderer tests green locally (run myself:
`npx vitest run src/renderer/`).

Interface note to the swarm: the DPR watcher gap "DPI change without a
DIP bounds change" (`src/renderer/renderer.ts:214-221`) was already reported by
**Area 4 (F1)** — deliberately not duplicated here.

## 2. Findings

### F1 — [risk] Windows-only Chromium occlusion throttling pauses the renderer loop when the overlay is fully covered

- `src/main/main.ts:144-149` — `webPreferences` does not disable
  `backgroundThrottling` (default `true`). Chromium's "native window occlusion" is a
  **Windows-only** feature: if the overlay is completely covered by other
  windows, the page can be treated as hidden → rAF stops. This occlusion
  tracking does not exist on macOS; the loop keeps running there even when covered.
- Consequence verified graceful in code: `document.hidden` skip with
  clock reset (`src/renderer/renderer.ts:368-372`) → no dt jump on
  reappearance; additionally `MAX_DT_S = 0.25` clamps every frame
  (`src/renderer/pet-config.ts:34-37`). Roam/evolution/hatch resume cleanly.
- The only behavioral difference: a quip that runs **entirely** during the
  coverage is never drawn (`quipState` expiry,
  `src/renderer/renderer.ts:447-451`). On macOS the same quip runs just as
  invisibly — user-visible difference practically zero; Windows even saves
  CPU in the process. Uncertainty: whether Electron 43 actually applies the
  occlusion feature to transparent, `ignoreMouseEvents` windows is not
  verified live (CLI environment, see F2).
- **Fix (no new dependencies):** No code fix needed — the behavior is correct
  and resource-friendly. Optionally record it as known Windows behavior in the
  Windows docs/README ("when the overlay is fully covered, the animation
  pauses by design"). Not a Flight-Plan blocker.

### F2 — [risk] The new 12 px bold quip bubble (9c8bd00) is verified on Windows neither live nor metrically

- The merge brought the bubble metric bumps: `BUBBLE_FONT_PX 8→12`,
  `BUBBLE_CHAR_WIDTH_PX 5→7`, `MAX_CHARS 24→28`, `LINE_HEIGHT 10→15`,
  `PADDING 4→8`, `TAIL 3→5`, `OFFSET 6→8` (`src/renderer/pet-config.ts:98-108`)
  plus the `bold` font and rounded glyph origins (`src/renderer/bubble.ts:116-126`).
  Tuned on macOS/Retina (commit message: "Sized for Retina overlays").
- Metric check against Windows: `monospace` resolves to
  **Consolas** under Windows Chromium (advance ≈ 0.55 em → ≈ 6.6 px at 12 px) — the 7 px approximation
  (`pet-config.ts:101`) is generous there; text is guaranteed to stay within the
  computed bubble width (worst case 28 characters: 28×6.6 ≈ 185 px ≪
  28×7+16 = 212 px). Even the macOS case (Menlo ≈ 7.22 px → ≈ 202 px) stays
  within the padding. No clipping (canvas does not clip), no smear (the dirty rect covers
  bubble + tail + 1, `src/renderer/renderer.ts:348-360`). So functionally
  **safe** on Windows.
- But: the Windows design gate is provisional and dates from **before** the
  merge — "Screenshots: not captured in this CLI-only environment"
  (`docs/design-reviews/phase-4-windows/verdict.md:49-51`). Bold 12 px Consolas
  in the 96 px pixel-art context (bubble max. 212 px wide vs. pet tile 96 px) has
  never been rendered and reviewed on Windows; nor has the wrap appearance at 28
  instead of 24 characters per line.
- **Fix (no new dependencies):** catch up on the Windows live gate with
  built-in means: `npm start -- --quip <trigger>` (QA flag,
  `src/main/main.ts:32,84-93,410-413`) for a long quip +
  `scripts/cdp-screenshot.mjs <port> <out.png>` for the screenshot; at
  100%/125%/150%/200% scaling; filed under
  `docs/design-reviews/phase-4-windows/`. No code change expected —
  pure verification.

## 3. Verified-OK List

- **pet-config.ts identical to upstream** (empty diff): all timing
  constants (SPRITE_FPS 8, MAX_DT_S 0.25, IDLE/CLIMB windows, evolution/
  hatch durations) are platform-neutral; `MAX_DT_S` explicitly covers
  sleep/throttle stalls (`src/renderer/pet-config.ts:34-37`).
- **roam.ts:** pure state machine; bounds come from the main process
  (workArea incl. auto-hide inset, `src/main/overlay-adapter.ts:36-52`) →
  taskbar bottom/top/left/right and auto-hide are automatically correct
  for roam/hatch/bubble. Branch addition `clampRoamStateToBounds`
  (`src/renderer/roam.ts:153-163`) clamps the state live when the taskbar
  moves (call site `src/renderer/renderer.ts:208`).
- **Adult sheet still loads:** `assets/sprites/beaver-adult.png/.json`
  (96 px tile, rows idle/walk — consistent with `BEAVER_TILE_PX = 96`,
  `pet-config.ts:16`) is loaded stage-keyed (`src/renderer/sprites.ts:43-50`,
  `Stage` incl. `'adult'`, sprites.ts:6), copied by `npm run build` to
  `dist/renderer/assets/sprites/` (`scripts/build-assets.js:38-46`,
  verified: files are in dist/) and included in the package
  (`electron-builder.yml:5-8`). Upstream's teen fallback was deliberately
  replaced by our real sheet (94ace5c).
- **Hatch placement Windows-safe:** `hatchPosition()` computes in
  window-local coordinates (`src/renderer/renderer.ts:228-230`); the window
  sits at the workArea origin → lodge/baby land above the taskbar
  or correctly with the 2-DIP auto-hide inset. Handoff to roam without a sprite pop
  (renderer.ts:437-444).
- **Evolution cancel on reset hatch** from 9c8bd00 taken over exactly once
  (renderer.ts:185-199) — prevents a stage fallback after a settings reset;
  the main-side chain persist → HATCH_START → XP reset confirmed
  (merge-verification #5/#8, `src/main/main.ts:284-295`).
- **Windows ~3 px DWM window inflation without renderer impact:** the renderer uses
  main-supplied bounds instead of `window.innerWidth` (renderer.ts:201-209,
  `src/main/main.ts:380-386`); the initial innerWidth fallback heals itself on the
  first `BOUNDS_CHANGED` via the clamp. Smoke tolerance documented
  (`src/main/main.ts:180-192`).
- **No render-Hz assumption:** movement/animation fully dt-based
  (header renderer.ts:1-8; frame accumulator renderer.ts:398-407) — 120/144 Hz
  Windows displays and 60 Hz ProMotion run equally fast; the `moved` check
  on rounded pixels (renderer.ts:391-396) keeps CPU discipline even at
  high refresh rates.
- **Evolution flash under DPR transform correct:** `source-in` composite and
  dirty-rect pad (jitter + rotation √2, renderer.ts:327-343) work in
  logical coordinates — platform- and scaling-independent.
- **Bounds wiring complete on the Windows side:** `display-metrics-changed`
  etc. subscribed (`src/main/overlay-adapter.ts:121-131`), initial send after
  `did-finish-load` (`src/main/main.ts:380-386`), initial fit before loading
  (main.ts:222-223).
- **Tests:** 52/52 renderer tests green (`npx vitest run src/renderer/`, run
  myself): roam (8), hatch (13), evolution (11), bubble (9), sprites (5),
  canvas-dpr (3, incl. dpr 1.25/1.5 = Windows scalings), renderer (3, incl.
  DPR change path and logical clearRect).

## 4. Proposed Flight-Plan Items

1. **Windows live gate renderer visuals (hatch/evolution/quip bubble)** —
   real Windows screenshots of the post-merge visuals (12 px bold bubble,
   hatch sequence, evolution flash) at 100/125/150/200% scaling via
   `--quip`/`--inject-xp`/`--reset-hatch` + `scripts/cdp-screenshot.mjs`;
   filed in `docs/design-reviews/phase-4-windows/` (resolves the provisional
   gate still open there). Covers F2.
2. **(Optional) Document the occlusion behavior** — one sentence in the
   Windows docs: when the overlay is fully covered, the animation pauses by
   design (Chromium occlusion, Windows-only). No code. Covers F1.
