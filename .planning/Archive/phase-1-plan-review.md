# Critical Review: Phase 1 Plan (Foundation)

**Reviewed Files:**
- `.flightplan/Archive/WINDOWS_PORT_PLAN.md` (main plan)
- `.flightplan/Archive/phase-1-plan.md` (plan under review)
- `package.json`
- `electron-builder.yml`
- `.github/workflows/ci.yml`
- `assets/` (incl. `assets/STYLE.md`)
- `scripts/`

**Review Date:** 2026-07-15

---

## 1. Summary of the Reviewed Plan

The Phase 1 plan covers the three Foundation build items: a platform-independent build script (BL-WIN-1), Windows packaging incl. icon assets (BL-WIN-2), and the CI extension to `windows-latest` (BL-WIN-9). The order is logical, the acceptance criteria are mostly measurable, and the plan deliberately avoids new dependencies as well as changes to the app logic. Overall the plan is implementable, but it contains several gaps, inconsistencies with the main plan, and Windows-specific pitfalls that are not yet sufficiently addressed.

---

## 2. Found Problems / Gaps / Errors

| # | Topic | Severity | Description |
|---|-------|----------|-------------|
| 1 | **Inconsistency: according to the main plan, BL-WIN-9 depends on BL-WIN-5** | Medium | `WINDOWS_PORT_PLAN.md` (section 4, line 236) lists as dependencies for BL-WIN-9: BL-WIN-1, BL-WIN-2, BL-WIN-5. But BL-WIN-5 is Phase 3 ("Windows Integrations"). The Phase 1 plan acknowledges this (section 2.9) and says CI must still go green without implementing BL-WIN-5. That is the right reading, but the main plan is inconsistent here. |
| 2 | **Node version discrepancy is not addressed operationally** | Medium | The project requires Node 24.x (`package.json:8`); the local environment runs 22.x. The plan mentions this as a risk but gives no concrete instruction for Phase 1 (e.g. whether Phase 1 is developed CI-driven, whether `engines.node` should be temporarily relaxed, or whether a Node manager switch is recommended). |
| 3 | **Scaling the sprite asset to 256×256 for `.ico` is problematic** | Medium | The existing beaver sprites are 96×96 px (`assets/STYLE.md:41`). Scaling to 256×256 is not an integer multiple (96 × 2.666…). With nearest-neighbor this produces a distorted, blurry icon. The plan proposes 256×256 without addressing the padding/canvas problem. Better: scale 2× to 192×192 and center on a 256×256 canvas with a transparent border. |
| 4 | **NSIS/portable output names are phrased too specifically** | Low | The plan claims `electron-builder --win` produces exactly `Beaver Buddy Setup.exe` and `Beaver Buddy.exe`. In reality the file names depend on `productName`, version, and electron-builder defaults; portable is often `${productName} ${version}.exe` or similar. This creates wrong expectations in the smoke test. |
| 5 | **Missing check of `src/renderer/tsconfig.json` / `outDir`** | Medium | BL-WIN-1 assumes that `tsc -p src/renderer/tsconfig.json` outputs files to `dist/renderer/`. The plan does not check the `tsconfig.json`. If `outDir` is missing or configured differently, `fs.cpSync` to `dist/renderer/...` fails. |
| 6 | **No mention of the Windows path-length limit** | Low-Medium | In projects with nested `node_modules`, the 260-character limit on Windows can cause build/packaging errors. The plan does not mention this classic Windows pitfall. |
| 7 | **Antivirus/Defender can block the build and installer** | Low-Medium | SmartScreen is mentioned, but not that Windows Defender (or other AV) can quarantine the unsigned installer or even the portable `.exe` in CI/locally. This can block smoke tests. |
| 8 | **`tray-icon.png` in Phase 1 is out of scope for BL-WIN-2** | Low | The plan wants to produce `assets/tray-icon.png` already in BL-WIN-2, even though it is only used in BL-WIN-4 (tray adapter). That is not wrong, but it obscures that BL-WIN-2 actually only needs `assets/icon.ico`. |
| 9 | **Risk of confusion between build scripts** | Low | `scripts/gen-sprites/build.ts` already exists (invoked via `npm run assets:build`). The new `scripts/build-assets.js` has a similar-sounding name. Not blocking, but worth documenting. |
| 10 | **Acceptance criterion "icon is displayed correctly" is not automatable** | Low | BL-WIN-2 requires the icon to be "displayed correctly in the installer, in Explorer, and in Task Manager". That is a manual visual test. The plan should mark this as a manual smoke-test criterion. |
| 11 | **No statement on `nsis.installerIcon` / uninstaller icon** | Low | For a complete Windows installer impression, it should be checked whether `nsis.installerIcon` and possibly `nsis.uninstallerIcon` are set. The plan reduces this to `win.icon`, which suffices for the app/Explorer but does not necessarily style the installer dialog itself. |
| 12 | **Missing fallback strategy if tests run red on Windows** | Medium | The plan says to "check before merge" and possibly schedule test fixes in Phase 1 or Phase 3. That is reactive. For a clean Phase 1 completion, a test run on Windows should be planned before the CI extension, or at least a clear escalation rule defined. |
| 13 | **`description` in `package.json` remains macOS-only** | Low | `package.json:5` still reads "Pixel-art desktop beaver overlay for macOS". The plan marks the update as optional, but this description can become visible in the Windows installer/Explorer and should therefore be adjusted at the latest in BL-WIN-2. |
| 14 | **No clarification on how `assets:build` is interacted with** | Low | `npm run build` only copies existing `assets/sprites/*.png`. If `assets/sprites` must be regenerated before the build via `npm run assets:build`, that is not part of BL-WIN-1. The plan assumes `assets/sprites` are already committed, which is currently true. |

---

## 3. Concrete Improvement Suggestions

### 3.1 Correct the Main Plan Dependency
In `WINDOWS_PORT_PLAN.md` section 4 (build items), the dependency of BL-WIN-9 on BL-WIN-5 should be removed. Correct is:

```text
BL-WIN-9: CI-Windows-Runner
Dependencies: BL-WIN-1, BL-WIN-2
```

BL-WIN-5 is Phase 3 and must not be a Phase 1 dependency.

### 3.2 Address the Node Version Discrepancy Concretely
Add to the Phase 1 plan, section 5 (risks):

> For Phase 1 the following applies: CI runs explicitly with Node 24.x. Local development on Node 22.x is acceptable as long as `npm run build` and `npx electron-builder --win` work with it. If `engines.node: "24.x"` causes an `npm ci` error, `engines.node: ">=22.x <=24.x"` or `.npmrc` with `engine-strict=false` can be used temporarily — but this must be documented in a separate ADR/commit.

### 3.3 Clarify the Icon Generation Instructions
In BL-WIN-2, section 2.7:

- Instead of "scale to 256×256 px" it should say:
  - Choose a 96×96 source sprite.
  - Scale to 192×192 px with nearest-neighbor (exactly 2×).
  - Place the 192×192 image on a 256×256 canvas with a transparent border (e.g. centered at the bottom).
  - Export as `.ico` with the resolutions 16, 32, 48, 128, 256 px, where the 256×256 version contains the padded image.
  - For `tray-icon.png` (32×32), likewise 2× scaling to 192×192 and downsampling to 32×32 with nearest-neighbor.

Alternatively: mark icon generation in Phase 1 as "functional, not visually final" and make BL-WIN-10 a binding design gate.

### 3.4 Relativize Output Names in Acceptance Criteria
In BL-WIN-2, section 2.8:

> Instead of checking exact file names:
> - In the `release/` directory there exists **one** `*.exe` installer (NSIS) and **one** portable `*.exe`.
> - Optionally: fix file names via `artifactName` in `electron-builder.yml`, e.g. `${productName}-${version}-Setup.${ext}` and `${productName}-${version}-Portable.${ext}`.

### 3.5 Check `src/renderer/tsconfig.json` Before BL-WIN-1
Recommended prerequisite for BL-WIN-1:

```bash
npx tsc -p src/renderer/tsconfig.json --showConfig | grep outDir
```

If `outDir` is not `dist/renderer`, `scripts/build-assets.js` must be adjusted or the `tsconfig.json` corrected.

### 3.6 Add Windows Pitfalls
Add to section 5 (risks):

| Risk | Impact | Mitigation |
|------|--------|------------|
| Windows path-length limit (260 characters) | `node_modules` or `release/` paths get truncated. | Check `LongPathsEnabled` in CI; locally use the `\\?\` prefix or shorter paths if needed. |
| Antivirus/Windows Defender blocks unsigned `.exe` | Smoke test or CI artifact download fails. | Exception for the `release/` folder; pack artifacts as ZIP if needed. |
| `tsc` output paths not as expected | `build-assets.js` copies into non-existent `dist/` paths. | Validate `tsconfig.json` beforehand (see 3.5). |

### 3.7 Configure the Installer Icon Separately
Add to `electron-builder.yml`:

```yaml
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
  publisherName: AI Beavers
nsis:
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
```

This improves the visual impression in the setup dialog.

### 3.8 Adjust `description` in `package.json`
In BL-WIN-1 or BL-WIN-2:

```json
"description": "Pixel-art desktop beaver overlay for macOS and Windows"
```

### 3.9 Test Run on Windows Before the CI Matrix Extension
Before BL-WIN-9, an explicit step "check test platform neutrality" should be introduced:

> Before `windows-latest` is added to the matrix, run `npm test` locally on Windows (or in a temporary Windows runner). If tests are red, either make them minimally platform-neutral or document why they are excluded on Windows for now.

---

## 4. GO / NO-GO Recommendation

**Recommendation: GO — with preconditions.**

The plan is fundamentally solid and implementable. The three build items are sensibly ordered, the acceptance criteria are predominantly measurable, and avoiding new dependencies as well as app-logic changes is correct. However, the gaps mentioned above (in particular the main-plan inconsistency for BL-WIN-9, the Node version discrepancy, and the icon scaling) should be fixed before or in parallel with implementation.

---

## 5. Important Notes for the Implementation Agent

1. **Strictly follow the order:** BL-WIN-1 must run before BL-WIN-2, BL-WIN-2 before BL-WIN-9. Do the local Windows verification step by step.
2. **Check `src/renderer/tsconfig.json` beforehand:** Make sure `tsc -p src/renderer/tsconfig.json` actually writes the files to `dist/renderer/` before `scripts/build-assets.js` copies.
3. **Don't overlook icon generation:** `assets/icon.ico` and `assets/tray-icon.png` do not exist yet. For Phase 1, a functional interim solution from sprite assets suffices, but the scaling must be integer (e.g. 96→192 on a 256 canvas) or visually checked.
4. **Mind the Node version:** The local environment has Node 22.x; the project requires 24.x. CI runs with 24.x — use CI as the source of truth for Phase 1.
5. **Run tests on Windows before the CI extension:** If `npm test` fails on Windows, do not simply extend the CI matrix to Windows. Decide: fix minimally or document a test exclusion.
6. **Keep Windows pitfalls in mind:** path lengths, Defender/AV, SmartScreen. If problems occur, upload artifacts as ZIP or configure exceptions.
7. **Don't touch source files:** Phase 1 is limited to `package.json`, `scripts/build-assets.js`, `electron-builder.yml`, `assets/*`, and `.github/workflows/ci.yml`.
8. **Follow up on documentation:** README/PRD/CLAUDE are finalized in BL-WIN-10, but `assets/STYLE.md` should receive a note about temporary Windows icons at the latest when the new icons are added.
