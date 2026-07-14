# BL-4 design-review verdict — sprite animation & roaming

Date: 2026-07-14
Verdict: **PASS**

## Live snapshots (BL-4-live-1/2/3.png)

Captured from the running overlay via CDP `Runtime.evaluate`: the canvas's
non-transparent bounding box, cropped with 16px padding and scaled 8x
nearest-neighbor (`imageSmoothingEnabled = false`). Window-content-only —
no desktop pixels, redaction-safe.

- Crisp pixels throughout: no anti-aliasing, no sub-pixel smearing, palette
  and outline per `assets/STYLE.md`.
- Mirrored left-facing walk renders correctly (frames are authored
  right-facing; renderer mirrors) with distinct leg poses per shot.
- ~290px traversal across the three shots (~6s apart), no trails or
  clear-rect artifacts.

| Shot | File | {x, y} | anim | facing |
|---|---|---|---|---|
| 1 | BL-4-live-1.png | 905, 984 | walk | left |
| 2 | BL-4-live-2.png | 760, 984 | walk | left |
| 3 | BL-4-live-3.png | 614, 984 | walk | left |

## CPU (main + renderer, `ps -o %cpu`, 1 sample/s)

- First measurement exposed a perf bug: walking cost 17–23% per sample —
  sub-pixel movement every ~120Hz rAF tick counted as a draw, and each draw
  full-canvas-cleared the 1728x1016 transparent surface. Fixed by rounding
  draw positions to whole pixels (gates redraws at speed-px/s) and clearing
  only a sprite-sized dirty rect.
- Post-fix, continuously walking (worst case): min 5.0 / avg 8.05 / max 9.4%.
- Post-fix, pet idle: **min 1.9 / avg 4.60 / max 6.0%** over 30 idle-phase
  samples — meets the <5% idle average budget. Idle pauses are 2–6s and
  never span a contiguous 30s window, so samples were phase-tagged via the
  `__debugRoam` CDP hook: a sample counts only after 3+ consecutive seconds
  of idle/sleep (lets ps's decaying %cpu shed walk residue); collected over
  a ~7-minute run (anim distribution: walk 304s, idle 62s, run 40s).

## Review method

8x-scaled live CDP captures of the running app, reviewed visually by the
orchestrating model; positions/anims cross-checked against the renderer's
read-only `__debugRoam` diagnostic surface at the moment of each capture.
