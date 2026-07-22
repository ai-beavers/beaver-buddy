# Phase-4-Plan Review — Beaver Buddy Windows Port

**Reviewed:** `.flightplan/Archive/phase-4-plan.md` (BL-WIN-8, BL-WIN-10)  
**Against references:** `WINDOWS_PORT_PLAN.md` (Phase 4 section), `src/renderer/renderer.ts`, `src/renderer/sprites.ts`, `src/renderer/roam.ts`, `src/renderer/sprites.test.ts`, `assets/STYLE.md`, `README.md`, `PRD.md`, `CLAUDE.md`  
**Reviewer:** critical review agent  
**Date:** 2026-07-15

---

## 1. Summary of the Reviewed Plan

Phase 4 is meant to make Beaver Buddy visually complete for Windows (HiDPI/scaling) and to finish the documentation plus a design gate. The plan covers two build items:

- **BL-WIN-8 (optional):** DPR-correct canvas rendering in `src/renderer/renderer.ts`, so pixel art stays sharp at 125 %/150 %/200 % Windows scaling.
- **BL-WIN-10:** Updates to `README.md`, `PRD.md`, `CLAUDE.md` and a visual/manual design gate with screenshots under `docs/design-reviews/phase-4-windows/`.

The plan is fundamentally sound: BL-WIN-8 is correctly marked as optional, includes a documented degradation path and adds no new dependencies. The consideration of the IPC bounds from Phase 2 (`state:bounds` instead of `window.innerWidth/Height`) is recognized and used in the DPR conversion.

However, the plan contains **one critical, not-yet-identified implementation error** in the clearing behavior of `draw()`, several gaps in the test strategy, and it underestimates the edge cases of pure DPR changes without a window-size change.

---

## 2. Found Problems / Gaps / Errors

| # | Problem | Severity | Rationale |
|---|---|---|---|
| 1 | **`draw()` clears the wrong area when no dirty rect exists**, if `ctx` is DPR-scaled. `src/renderer/renderer.ts:279` contains `ctx.clearRect(0, 0, canvas.width, canvas.height)`. After BL-WIN-8, `canvas.width/height` are physical pixels (e.g. 2880×1620 at 1.5× DPR), but the context is scaled by `dpr`. The call would then only clear the logical area `0..canvas.width/dpr` — i.e. not the whole canvas. | **Critical** | Visual smearing/ghosting across the entire overlay as soon as a frame is drawn without a dirty rect (first frame, resize, quip fade-out). |
| 2 | **`bounds()` must be explicitly switched to `logicalBounds`**, not just "continue to return logical pixels". Currently `bounds()` hangs on `canvas.width/height`. The plan mentions the change, but not the consequence: all callers (`createRoamState`, `clampRoamStateToBounds`, `hatchPosition`, `layoutBubble`, `tick`) would otherwise receive physical pixels and the beaver would roam outside the visible window. | **High** | Functional regression in roaming/clamping if the patch is only half applied. |
| 3 | **DPR changes without a window-size change are not reliably detected.** `onBoundsChanged` only fires on work-area changes from the main process. If the user only changes the scaling in Windows (e.g. 100 % → 125 %) without the logical window size changing, no new `state:bounds` event arrives. | **High** | The beaver stays blurry or incorrectly scaled until the window is moved/resized. |
| 4 | **No test for the regression in `draw()` and `bounds()`.** The plan optionally suggests a purely mathematical test for `configureCanvasDpr`, but ignores the actual risk: the interaction between the DPR-transformed context, `canvas.width/height` and the logical coordinates in `draw()` / `bounds()`. | **Medium** | Errors from #1 and #2 cannot be caught by existing tests. |
| 5 | **Non-integer DPR (1.25, 1.5) leads to uneven pixel doubling.** The plan names this as a risk but underestimates the visual impact: at 1.25×, 4 source pixels are distributed across 5 physical pixels, which leads to "wobbling" outlines on a slowly moving sprite. The design gate criterion "no bilinear blur" is necessary but not sufficient for a good result. | **Medium** | The acceptance criterion "125 %/150 % may only show no bilinear blur" could end as FAIL in the design gate even though it is technically implemented correctly. |
| 6 | **The design gate process underestimates the effort for synthetic screenshots.** The plan requires screenshots at 100 %, 125 %, 150 % and 200 % scaling plus the taskbar on four edges. That requires at least 16 manual screenshots (4 scalings × 4 edges), without the auto-hide variant. | **Low-Medium** | Time effort not budgeted; risk that the gate is completed incompletely. |
| 7 | **Auto-hide taskbar and HiDPI rendering are not linked.** When `workArea === bounds` with auto-hide enabled (documented limitation from Phase 2), the overlay is aligned to the full physical resolution. The design gate should check whether the beaver still looks sharp and is not clipped when the auto-hide bar slides in. | **Low-Medium** | Gap in the design gate; potentially a new FAIL that is not covered. |
| 8 | **PRD.md line references can go stale.** The plan refers to concrete line numbers (e.g. R10 at lines 108–115). Future changes to `PRD.md` shift the lines, which can confuse the implementing agent. | **Low** | Not a blocker, but maintenance-hostile; better to reference headings/IDs. |
| 9 | **"Final master icon missing" is marked as a known follow-up but not carried over into `WINDOWS_PORT_PLAN.md` as an explicit build item.** Once BL-WIN-10 closes, the icon debt stays invisible until a follow-up plan picks it up. | **Low** | Tracking risk; should be anchored in the follow-up list of `WINDOWS_PORT_PLAN.md`. |

---

## 3. Concrete Improvement Suggestions

### 3.1 Critical: Adapt `draw()` to the DPR transformation
**File:** `src/renderer/renderer.ts:279`

Change the full-canvas clear so that it uses logical coordinates in the scaled context:

```ts
// Instead of:
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Better:
ctx.clearRect(0, 0, bounds().width, bounds().height);
```

Since `bounds()` must return logical pixels (see 3.2), the clear area is correctly extended to the physical canvas by the `setTransform(dpr, …)` matrix.

### 3.2 High: Explicitly switch `bounds()` to `logicalBounds`
**File:** `src/renderer/renderer.ts:92-94`

The plan mentions `logicalBounds`, but the current `bounds()` implementation reads `canvas.width/height`. This must be changed in the implementation without fail:

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };

function bounds(): Bounds {
  return logicalBounds;
}
```

And in the `onBoundsChanged` handler, `logicalBounds` must be set:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  logicalBounds = { width: next.width, height: next.height };
  configureCanvasDpr(next.width, next.height);
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

**Important:** No other code may afterwards interpret `canvas.width/height` as a logical size.

### 3.3 High: Listen separately for DPR changes
**File:** `src/renderer/renderer.ts`

Add a listener that re-invokes `configureCanvasDpr` on pure DPR changes as well:

```ts
function updateDprFromMedia(): void {
  configureCanvasDpr(logicalBounds.width, logicalBounds.height);
  needsDraw = true;
}

window.matchMedia('screen and (resolution: 1dppx)').addEventListener('change', updateDprFromMedia);
// Note: matchMedia for DPR changes is a known pattern, but it does not work
// reliably on all platforms. Alternatively, one can check on the resize event
// whether devicePixelRatio has changed.
```

Even more robust: on the `window.resize` event, check whether `window.devicePixelRatio` has jumped compared to the last known value, and reconfigure if needed. This should be carried in the plan as a **mandatory step** (not "optionally"), because Windows users frequently change the scaling without a window resize.

### 3.4 Medium: Extend the renderer test strategy
**Files:** `src/renderer/renderer.test.ts` (new) or `src/renderer/sprites.test.ts`

The plan suggests a mathematical test for `configureCanvasDpr`. That is sensible but not sufficient. Additionally recommended:

1. **Unit test for DPR math:**
   ```ts
   expect(configureCanvas(1920, 1080, 1.5)).toEqual({
     canvasWidth: 2880,
     canvasHeight: 1620,
     styleWidth: '1920px',
     styleHeight: '1080px',
   });
   ```

2. **Regression test for `bounds()` after the DPR switch:** Ensure that `bounds()` still returns `{ width: 1920, height: 1080 }` after `configureCanvasDpr(1920, 1080, 2)`, even though `canvas.width === 3840`.

3. **Integration test for the `draw()` clear area:** If possible, verify that after a full-canvas clear at DPR=2, the clear rect passes logical 1920×1080 (not physical 3840×2160) to `clearRect`. This prevents error #1.

Since `renderer.ts` is heavily DOM side-effect-laden, point 3 can be expensive. At minimum, points 1 and 2 should be implemented before BL-WIN-8 counts as completed.

### 3.5 Medium: Make design gate criteria for non-integer DPR more precise
**File:** `.flightplan/Archive/phase-4-plan.md` section 4.3

Extend the HiDPI criterion:

> "At 200 %: sprite edges are sharp and pixel doubling is integer (no half pixels).  
> At 125 %/150 %: no bilinear blur; slight unevenness in the pixel grid is acceptable as long as the silhouette does not noticeably flicker while standing/walking."

If visible flickering occurs at 125 %/150 %, the verdict should be explicitly documented as **CONDITIONAL PASS** (not FAIL), because this is a fundamental limit of nearest-neighbor at non-integer DPR.

### 3.6 Medium: Include auto-hide in the design gate
**File:** `.flightplan/Archive/phase-4-plan.md` section 4.3

Add a checkpoint:

| Checkpoint | Criterion |
|---|---|
| **Auto-hide taskbar** | With the auto-hide taskbar enabled, the beaver is not permanently covered; when the bar slides in, he stays sharp and fully visible. |

### 3.7 Low: Anchor icon debt as an explicit follow-up
**File:** `.flightplan/Archive/WINDOWS_PORT_PLAN.md` section 8

Add under "Deferred tasks" or as a new Phase 5 item:

> **Final master icon / design pass** — Delivery of a professional app icon and tray icon by design; replaces the provisional sprite-generated `assets/icon.ico` and `assets/tray-icon.png`.

### 3.8 Low: Replace line references in the plan with semantic references
**File:** `.flightplan/Archive/phase-4-plan.md` section 4.2

Instead of "lines 108–115", better: "PRD.md, section R10 (Design QA gate)".

---

## 4. GO / NO-GO Recommendation

**Recommendation: GO — with preconditions.**

The Phase 4 plan is implementable, but not in its current form. Before implementation starts, points #1, #2 and #3 from section 2 must be incorporated into the plan, otherwise the implementing agent risks a critical rendering bug and a DPR-change regression.

BL-WIN-10 (Documentation & Design-Gate) is realistically achievable, even without a final master icon, as long as the gate is clearly communicated as an evaluation against **provisional** assets.

---

## 5. Notes for the Implementing Agent

When you implement BL-WIN-8, please pay special attention to:

1. **Never use `canvas.width/height` as a logical size** after DPR is enabled. All roaming, hatch, bubble and dirty-rect calculations must go through `bounds()`, which returns `logicalBounds`.

2. **Fix the full-canvas clear in `src/renderer/renderer.ts:279`**: `ctx.clearRect(0, 0, bounds().width, bounds().height)` instead of `canvas.width/height`.

3. **Listen for DPR changes**, not just `onBoundsChanged`. A `window.resize` handler that compares `window.devicePixelRatio` with a stored value is the most robust approach without new dependencies.

4. **Keep `PET_SCALE`/`LODGE_SCALE` integer** (`src/renderer/pet-config.ts`). Do not change them to fractional values, to avoid half pixels.

5. **`drawFrame` in `src/renderer/sprites.ts` stays unchanged**, but verify that the passed `ctx` carries the DPR transformation and that `x`, `y`, `scale` remain logical values.

6. **After the switch, run a visual test at 100 %, 125 %, 150 % and 200 %.** Look not only for "not blurry" but also for flickering/wobbling outlines during slow movement.

7. **Test the auto-hide taskbar separately.** When the taskbar slides in, the beaver must not be clipped and the rendering must not be re-initialized/reset.

8. **For BL-WIN-10:** Use a neutral desktop background for screenshots and remove personal windows/file names. Save the verdict as `docs/design-reviews/phase-4-windows/verdict.md`.

9. **If BL-WIN-8 is deactivated:** Document the limitation in `README.md`, `CLAUDE.md` **and** `WINDOWS_PORT_PLAN.md`, as provided in the plan. Make sure the degradation really reverts all DPR changes in `renderer.ts`.

10. **Before closing:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npx electron-builder --win --publish never` must be green. Add at least one unit test for the DPR math.
