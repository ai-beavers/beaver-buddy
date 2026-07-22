# Beaver Buddy — Phase 4: Polish & Release-Readiness

**Status:** Planning document (contains no source changes).  
**Build-Items:** BL-WIN-8, BL-WIN-10  
**Goal:** Ensure visual quality on Windows HiDPI displays, bring icons and documentation to a release-ready state, complete the design gate for Windows.

---

## 1. Phase Summary

Phase 4 is the final implementation phase before the deferred follow-up tasks (BL-WIN-6, BL-WIN-7, Codex tracking). It covers two build items:

1. **BL-WIN-8 — Renderer HiDPI / Scaling (optional):** The transparent canvas overlay should stay sharp on Windows displays with 125 %/150 %/200 % scaling, without the pixel art being blurred by bilinear scaling.
2. **BL-WIN-10 — Documentation & Design-Gate:** README, PRD and CLAUDE.md are reviewed against the current Windows status and updated. A visual design gate evaluates the Windows tray icon, application icon and HiDPI rendering; screenshots and the verdict are stored in `docs/design-reviews/`.

The phase introduces **no new features**, changes no business logic and adds **no new dependencies**.

---

## 2. Dependencies on Previous Phases

| Build-Item | Requires completed | Rationale |
|---|---|---|
| BL-WIN-8 | BL-WIN-3 (Overlay adapter) | The canvas size is controlled via `state:bounds` from the main process. HiDPI adjustments must conform to this bounds interface without breaking the taskbar logic. |
| BL-WIN-10 | BL-WIN-2 (Windows installer/icon), BL-WIN-4 (Tray icon), BL-WIN-8 (HiDPI) | The design gate only evaluates all visual endpoints once packaging, tray and HiDPI are in place. |

**Not blocking, but relevant:** BL-WIN-5 (Usage paths) is already completed; Windows Codex tracking remains deferred and should stay documented in BL-WIN-10.

---

## 3. BL-WIN-8: Renderer HiDPI / Scaling (optional)

### 3.1 Context

Current state in `src/renderer/renderer.ts:82-83`:

```ts
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
```

The canvas operates in **logical pixels**. On Windows with 125 %/150 %/200 % scaling, `window.innerWidth/Height` still returns logical pixels, while Chromium internally uses a `devicePixelRatio` (DPR) of 1.25/1.5/2.0. When the canvas element is scaled to the window size via CSS, the small logical canvas is upscaled to the physical area → bilinear blurring of the pixel art, even though `ctx.imageSmoothingEnabled = false` is set.

### 3.2 Goal

- The overlay stays visually sharp at Windows scalings of 125 %, 150 % and 200 %.
- Pixel art is drawn with nearest-neighbor (no bilinear interpolation).
- Sprite scalings stay as integer as possible; no half source pixels.
- Behavior on macOS and Linux must not regress.

### 3.3 Concrete Steps

#### Step 1: Couple physical canvas size to DPR

**File:** `src/renderer/renderer.ts`

Introduce a helper function that adapts the canvas element to the physical resolution and scales the context by the DPR. Logical bounds for `roam.ts` are tracked separately.

```ts
function configureCanvasDpr(logicalWidth: number, logicalHeight: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
```

Note: `ctx.setTransform` instead of `ctx.scale`, so that a DPR change (monitor switch, scaling change) does not accumulate.

#### Step 2: Keep the bounds interface

**File:** `src/renderer/renderer.ts`

`bounds()` must continue to return logical pixels so that `roam.ts`, `bubble.ts`, `hatch.ts` and the dirty-rect calculations can remain unchanged.

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };

function bounds(): Bounds {
  return logicalBounds;
}
```

In the `onBoundsChanged` handler (line 189 ff.), the logical size is stored and the canvas is reconfigured:

```ts
window.beaverBuddy.onBoundsChanged((next) => {
  logicalBounds = { width: next.width, height: next.height };
  configureCanvasDpr(next.width, next.height);
  needsDraw = true;
  roamState = clampRoamStateToBounds(roamState, bounds());
});
```

#### Step 3: Adjust initialization

**File:** `src/renderer/renderer.ts`

The direct assignment `canvas.width = window.innerWidth` is removed. Instead:

```ts
let logicalBounds: Bounds = { width: window.innerWidth, height: window.innerHeight };
configureCanvasDpr(logicalBounds.width, logicalBounds.height);
```

The `createRoamState` initialization (`renderer.ts:99`) continues to use `bounds()`.

#### Step 4: Do not touch the drawing logic

- `drawFrame` in `src/renderer/sprites.ts` remains unchanged.
- `PET_SCALE` and `LODGE_SCALE` in `src/renderer/pet-config.ts` remain integers.
- All coordinates in `draw()`, `drawHatch()` and `bubble.ts` remain logical pixels; the DPR scaling happens implicitly through the transformed context.

#### Step 5: Add test coverage

**File:** `src/renderer/renderer.test.ts` (create new if not present) or extend an existing renderer test.

Since `renderer.ts` relies heavily on DOM/API side effects, a clean unit test for the DPR math is preferred over mocking the entire renderer. If such a test is not practicable, the HiDPI path is verified manually in the design gate.

Recommended test idea (optional):

```ts
// Example: Extract configureCanvasDpr into a pure helper function
// configureCanvas(logicalWidth, logicalHeight, dpr) -> { canvasWidth, canvasHeight, styleWidth, styleHeight }
expect(configureCanvas(1920, 1080, 1.5)).toEqual({
  canvasWidth: 2880,
  canvasHeight: 1620,
  styleWidth: '1920px',
  styleHeight: '1080px',
});
```

If no extraction takes place, a manual verification step in the design gate is sufficient.

### 3.4 Risks and Degradation (optional character)

| Risk | Impact | Mitigation |
|---|---|---|
| Non-integer DPR (1.25, 1.5) leads to uneven pixel doubling. | Pixel art flickers slightly or looks "wobbly". | Acceptance criterion: at 200 % (DPR=2) it must be perfectly integer; at 125 %/150 % it must not be bilinearly blurred. If 125 %/150 % look unsatisfactory, document the limitation and flag it for the design gate/assets. |
| `window.devicePixelRatio` changes during runtime (monitor switch, scaling change). | Canvas is drawn with the wrong DPR. | Call `configureCanvasDpr` again on every `onBoundsChanged` invocation; optionally also listen to `window.matchMedia` for DPR changes. |
| Regression on macOS/Linux. | Beaver becomes too large/too small or blurry. | Explicit visual smoke test on macOS; CI cannot replace this. |
| Additional complexity outweighs the benefit. | Time loss, code becomes harder to maintain. | BL-WIN-8 is optional. If the implementation cannot be done within a small, isolated diff, it is documented as switched off (see 3.5). |

### 3.5 Documented Deactivation / Degradation

If BL-WIN-8 is judged too risky or too costly during the implementation run, **degradation** is permitted:

1. The changes in `src/renderer/renderer.ts` are reverted or never committed.
2. A note is added to `README.md` and `CLAUDE.md`:
   > "On Windows displays with non-100 % scaling the beaver is rendered at the logical resolution. A future update will add per-display DPR scaling to keep pixel art perfectly crisp at 125 %/150 %/200 %."
3. BL-WIN-8 is marked as "optional — deferred" in `.flightplan/Archive/WINDOWS_PORT_PLAN.md`.
4. The BL-WIN-10 design gate documents the current state and evaluates the acceptance of the blurriness.

---

## 4. BL-WIN-10: Documentation & Design-Gate

### 4.1 Goal

- README.md, PRD.md and CLAUDE.md consistently reflect the Windows status.
- A visual/manual design gate evaluates Windows icons and HiDPI rendering.
- Design gate results (screenshots + verdict) are stored in `docs/design-reviews/`.

### 4.2 Files and Changes

#### `README.md`

**Sections to review/finalize:**

- Line 37: "Supported on macOS 14+ and Windows 10/11." — already correct.
- Line 39-41: Scope note on the Windows focus — keep.
- Line 73-80: Windows overlay & tray behavior — keep, optionally add a HiDPI note after BL-WIN-8.
- Line 82-96: Windows usage tracking — keep, leave Codex tracking status documented.
- Line 109-125: Troubleshooting — update after BL-WIN-8:
  - Auto-hide limitation remains.
  - Tray icon contrast: reference the design gate result.
  - If BL-WIN-8 is implemented: add a HiDPI note.
  - If BL-WIN-8 is deactivated: note the known blurriness under scaling.

**Possible addition after BL-WIN-8:**

```md
### HiDPI / display scaling

The overlay renders at the native device pixel ratio on Windows, so the beaver
stays crisp at 100 %, 125 %, 150 % and 200 % display scaling. Pixel art is
drawn with nearest-neighbor scaling; at 125 %/150 % the pixel grid may show
minor unevenness, but no bilinear blur.
```

#### `PRD.md`

- Scope note (line 18-20) — keep.
- Extend R10 (Design QA gate, line 108-115) with Windows coverage: screenshots must be taken on a Windows synthetic desktop.
- If BL-WIN-8 is deactivated: record HiDPI as a known limitation under "Explicitly OUT of scope (MVP)" or as a footnote to R3/R10.

#### `CLAUDE.md`

- Usage log path section (line 59-70) is already Windows-compatible; check whether the Codex status is still current.
- Overlay etiquette (line 72-83) — keep; optionally add a note: "HiDPI scaling must not break click-through or pixel-grid discipline".
- Definition of done (line 103-107) — extend: for visible Windows changes, a design gate screenshot is part of "demonstrably hold".

### 4.3 Design Gate Criteria

The design gate is **visual/manual**. There is no final master icon; the evaluation is made against the provisional assets.

| Checkpoint | Criterion | Verdict |
|---|---|---|
| **App icon** (`assets/icon.ico`) | Displays correctly in Explorer, installer and Task Manager; no visible scaling artifacts from 16×16 to 256×256. | PASS / FAIL with size note |
| **Tray icon** (`assets/tray-icon.png`) | Recognizable on light and dark Windows taskbar backgrounds; not too small or too large; edges not frayed. | PASS / FAIL |
| **HiDPI rendering** | At 100 %, 125 %, 150 %, 200 % scaling: sprite edges are sharp, no bilinear blurring; pixel art does not look smeared. | PASS / FAIL per scaling |
| **Overlay edge** | Beaver stays within the work area; no clipping at the taskbar (bottom/top/left/right). | PASS / FAIL per position |
| **Consistency** | Colors and style of icon and sprite match; no visual break between sprite palette and app icon. | PASS / FAIL |

### 4.4 Design Gate Process

1. **Preparation:**
   - Windows test machine with at least two scaling levels (e.g. 100 % and 200 %).
   - Clean/synthetic desktop background (no personal windows, file names or notifications).
2. **Take screenshots:**
   - App icon in Explorer (small/medium/large view).
   - Installer window with icon.
   - Task Manager process icon.
   - Tray icon on light and dark taskbar backgrounds.
   - Overlay with beaver in idle and walk animation at 100 %, 125 %, 150 %, 200 %.
3. **Storage:**
   - Screenshots under `docs/design-reviews/phase-4-windows/`.
   - Markdown verdict `docs/design-reviews/phase-4-windows/verdict.md` with the table from 4.3.
4. **On FAIL:**
   - Document the blocker.
   - If it is a minor issue (e.g. tray icon contrast on a dark background), a short follow-up fix can happen within BL-WIN-10 (e.g. contrast adjustment on the provisional PNG).
   - If a final master icon is needed, it is marked as a known follow-up (no new build item in Phase 4).

---

## 5. Acceptance Criteria for the Entire Phase

### BL-WIN-8 (optional)

- [ ] At 200 % Windows scaling, the overlay rendering is sharp (integer pixel doubling).
- [ ] `ctx.imageSmoothingEnabled = false` remains active.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` stay green.
- [ ] Behavior on macOS/Linux is visually unchanged (no regression).
- [ ] If deactivated: the limitation is documented in README.md, CLAUDE.md and WINDOWS_PORT_PLAN.md.

### BL-WIN-10

- [ ] README.md, PRD.md and CLAUDE.md are consistent and reflect macOS + Windows.
- [ ] Windows scope note, usage tracking limitation and Codex status are current.
- [ ] Design gate verdict is stored in `docs/design-reviews/phase-4-windows/verdict.md`.
- [ ] Screenshots are clean/synthetic and show app icon, tray icon and overlay at the relevant scalings.
- [ ] All FAILs are either fixed or documented as known limitations.

---

## 6. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| BL-WIN-8 causes regressions on macOS/Linux. | Visual quality suffers on non-Windows platforms. | Keep changes minimal and encapsulated behind a DPR helper function; visually smoke-test on macOS; deactivate BL-WIN-8 if regression risk arises. |
| 125 %/150 % DPR does not look perfect despite `imageSmoothingEnabled = false`. | Design gate FAIL for HiDPI. | Differentiate acceptance criteria: 200 % must be perfect; 125 %/150 % may only show "no bilinear blur". |
| No Windows hardware available for the design gate. | Design gate cannot be performed. | A CI Windows runner can check packaging, but not visuals. Fallback: perform the design gate on a Windows VM screenshot or document it as "pending on real hardware". |
| Final master icon still missing. | Design gate can only evaluate provisional assets. | Design gate documents that the evaluation is against sprite-generated icons; mark the final icon as a known follow-up. |
| Documentation drifts apart (README/PRD/CLAUDE). | Inconsistent statements. | Review shared sections (usage tracking, scope note, HiDPI) in all three files in sync. |

---

## 7. Test and Verification Steps

1. **Automated checks (local and CI):**
   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   npm run build
   npx electron-builder --win --publish never
   ```
2. **Manual HiDPI check (Windows):**
   - Set display scaling to 100 %, 125 %, 150 %, 200 %.
   - Start the app (`npm start`).
   - Visually check the beaver for sharpness (idle + walk).
   - Take one screenshot per scaling.
3. **Manual overlay check (Windows):**
   - Position the taskbar on all four edges; the beaver must not be covered.
   - Test click-through: clicks on the beaver pass through to the window underneath.
4. **Icon check (Windows):**
   - Run `release/Beaver Buddy Setup 0.1.0.exe`; check the installer icon.
   - Check the installed app in the Start menu/Explorer.
   - Check the tray icon on light and dark taskbar backgrounds.
5. **Design gate:**
   - Store screenshots in `docs/design-reviews/phase-4-windows/`.
   - Create `verdict.md` with a PASS/FAIL table.
6. **Regression check (macOS, if hardware available):**
   - `npm run build` and app start; visual smoke test for overlay sharpness and tray.

---

## 8. No New Dependencies

- BL-WIN-8 uses only browser APIs (`devicePixelRatio`, `CanvasRenderingContext2D.setTransform`).
- BL-WIN-10 uses no new tools; screenshots can be taken with the native Windows screenshot tool or Snipping Tool.
- If special image-comparison tools are desired for the design gate, they must be used **outside the repo**.

---

## 9. Open Points and Follow-ups

- **Final master icon:** Not part of Phase 4. The design gate delivers a verdict against the provisional sprite-generated icons. A real master icon is a separate design follow-up.
- **BL-WIN-6 (Keychain/MRR) and BL-WIN-7 (atomic writes):** Remain deferred and are not touched in Phase 4.
- **Codex tracking on Windows:** Remains deferred; update the README/CLAUDE documentation if the status changes.

---

## 10. Summary of Files to Touch

| Build-Item | File | Type of change |
|---|---|---|
| BL-WIN-8 | `src/renderer/renderer.ts` | Canvas DPR configuration, separate logical bounds |
| BL-WIN-8 | `src/renderer/renderer.test.ts` (optional/new) | Unit test for DPR math, if extracted |
| BL-WIN-10 | `README.md` | HiDPI note, update troubleshooting |
| BL-WIN-10 | `PRD.md` | R10 Windows note, possibly HiDPI limitation |
| BL-WIN-10 | `CLAUDE.md` | Extend definition of done with design gate, HiDPI note |
| BL-WIN-10 | `docs/design-reviews/phase-4-windows/verdict.md` (new) | Design gate verdict |
| BL-WIN-10 | `docs/design-reviews/phase-4-windows/*.png` (new) | Screenshots |
| Both | `.flightplan/Archive/WINDOWS_PORT_PLAN.md` | Update status of BL-WIN-8/BL-WIN-10 |
