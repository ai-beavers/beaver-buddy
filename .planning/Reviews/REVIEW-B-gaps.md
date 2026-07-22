# Review B — Gaps & Completeness (Windows-native M1)

**Branch:** `bl-item/pixijs-puppet-studio/BL-14`
**Scope:** Milestone 1 Windows-native Items #1–#6 and Round-2 parity items #46–#62; current branch also contains Puppet Studio (BL-14 / PR #28, not part of M1).
**Reviewer:** Reviewer B (Gaps & Completeness)
**Date:** 2026-07-18

---

## Summary

M1 is **technically fully implemented**: all items marked `done` have code evidence and matching tests. However, there are **several documentation gaps in `README.md`** that actively misrepresent the Windows state, and two **test gaps in central security/lifecycle modules**. These should be closed before the next merge.

---

## Gaps

### Major

#### 1. README.md falsely claims MRR mode is not available on Windows
- **Severity:** major
- **Evidence:** `README.md:40` — *"Optional MRR mode … Not available on Windows yet"*; `README.md:101` — *"MRR mode is not available on Windows yet"*
- **What is missing:** The code fully supports MRR on Windows: `src/main/mrr/secrets.ts` uses `electron.safeStorage` (DPAPI) under `win32` for encrypted key files; `src/main/main.ts` starts `MrrEngine` and allows mode switching via the tray menu/settings window; `src/main/tray.ts` only shows MRR once at least one source is connected; `src/main/mrr/settings-window.ts` stores Stripe/RevenueCat keys.
- **Recommendation:** Correct `README.md`: MRR is available on Windows as soon as a Stripe or RevenueCat key is stored; the note about the pending admin decision is obsolete (handled by #1).

#### 2. README.md falsely claims only Claude Code logs are tracked on Windows
- **Severity:** major
- **Evidence:** `README.md:36` — *"On Windows only Claude Code logs are tracked for now"*
- **What is missing:** Flight-plan item #49 is implemented: `src/main/usage/paths.ts` scans under Windows the union of all Codex candidates (`%LOCALAPPDATA%\Codex`, `%APPDATA%\Codex`, `~/.codex`) and deduplicates by relative path. `paths.test.ts` covers this.
- **Recommendation:** Rewrite the "Windows usage tracking" section: both Claude Code (XDG + Legacy) and Codex (union of all candidates) are tracked on Windows.

#### 3. `src/main/hardening.ts` has no unit tests despite P1 invariants
- **Severity:** major
- **Evidence:** `src/main/hardening.ts` (no `hardening.test.ts`); `CLAUDE.md` requires P1 review check and "Every logic module ships with a vitest test".
- **What is missing:** No automated check that `will-navigate`, `setWindowOpenHandler`, `setPermissionRequestHandler` and `will-download` actually block/deny.
- **Recommendation:** Create `hardening.test.ts` that mocks `BrowserWindow`/`session` and checks each handler for `preventDefault` / `action: deny` / `callback(false)`.

#### 4. `src/main/main.ts` has no unit tests for central app lifecycle logic
- **Severity:** major
- **Evidence:** `src/main/main.ts` (no `main.test.ts`).
- **What is missing:** Single-instance lock, `second-instance` restore/focus, flag parsing (`--quip`, `--inject-xp`, `--keychain-service`), `onProgressReset`-resync-fallback (#57) and the interaction between `XpEngine`, `UsageTracker`, `MrrEngine` and Tray are untested.
- **Recommendation:** At least extract the pure flag-parser logic into a separate file and test it; cover the single-instance and reset-resync path with sparse Electron mocks (rest remains integration/E2E).

### Minor

#### 5. README.md still calls Windows builds "currently unsigned"
- **Severity:** minor
- **Evidence:** `README.md:78` — *"currently unsigned, so Windows Defender SmartScreen may show a warning"*
- **What is missing:** Flight-plan item #4a is implemented (`electron-builder.yml` `signtoolOptions`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, CI integration, `docs/code-signing.md`). Self-signed signature is active, even though SmartScreen still warns (#4b).
- **Recommendation:** Adjust wording to "self-signed code signing is active in CI/dev builds; SmartScreen still warns until a publicly trusted certificate lands (#4b)".

#### 6. `docs/design-reviews/phase-4-windows/verdict.md` contradicts existing screenshots
- **Severity:** minor
- **Evidence:** `docs/design-reviews/phase-4-windows/verdict.md:86` — *"Screenshots: not captured in this CLI-only environment"*; in fact `idle.png`, `quip-bubble.png`, `hatch.png`, `evolution-flash.png` exist in the same directory.
- **What is missing:** Verdict was not updated after adding the screenshots.
- **Recommendation:** Link the verdict to the screenshot files and adjust or remove the sentence "provisional until real Windows screenshots can be added".

#### 7. Empty `NUL` file lies in the working tree
- **Severity:** minor
- **Evidence:** `git status` shows `?? NUL` (0 bytes, 2026-07-18).
- **What is missing:** The file is probably an artifact of a failed `> NUL` redirect on Windows and has no content.
- **Recommendation:** `rm NUL` and check `.gitignore` whether `NUL` should be explicitly excluded.

#### 8. Main overlay window still uses PNG icon on Windows instead of the ICO file
- **Severity:** minor
- **Evidence:** `src/main/main.ts:120` — `icon: appIconPath()` → `assets/beaver-buddy-icon.png`; `settings-window.ts` was switched to `icon.ico` in #59.
- **What is missing:** `createWindow()` does not use a platform-specific icon. Since `skipTaskbar: true` is set, the effect is limited, but for Task Manager/Alt-Tab `assets/icon.ico` would be more conventional.
- **Recommendation:** Use `assets/icon.ico` under `win32` analogous to `settings-window.ts`; add a test if the window icon is ever checked.

---

## Item-Coverage

| Item | Description | Status | Code evidence / Test evidence | Note |
|---|---|---|---|---|
| #1 | Windows Secret Store | done | `src/main/mrr/secrets.ts`, `secrets.test.ts` | DPAPI + `safeStorage` under `win32` |
| #2 | Auto-Hide Taskbar Robustness | done | `src/main/overlay-adapter.ts:36-50`, `overlay-adapter.test.ts` | 2-DIP inset when `workArea === bounds` |
| #3 | Professional Icon Pass | provisional | `assets/icon.ico`, `assets/tray-icon.png`, `scripts/gen-sprites/build-icons.ts` | Placeholder from sprite frame; final design pass open |
| #4a | Signing Infrastructure | done | `electron-builder.yml`, `scripts/new-dev-signing-cert.ps1`, `scripts/verify-signatures.ps1`, `docs/code-signing.md` | Self-signed CI pipeline |
| #4b | SmartScreen-Free Delivery | documented | `docs/code-signing.md` | Requires real certificate/Azure Trusted Signing (#42) |
| #5 | Installer Localization | done | `electron-builder.yml:21-22`, `installer-config.test.ts` | `en_US`, `de_DE` |
| #6 | Start Menu/Desktop Shortcut | done | `electron-builder.yml:15-19` | `createDesktopShortcut`, `createStartMenuShortcut` |
| #46 | Reset Button in Settings Window | done | `src/main/mrr/settings-window.ts`, `settings.html`, `settings-window.test.ts` | Two-click arming |
| #47 | Tray Single Click | done | `src/main/tray.ts:106-108`, `tray.test.ts` | `popUpContextMenu()` under `win32` |
| #48 | Taskbar Jump Animation | open idea | documented only | no implementation obligation |
| #49 | Unify Codex Homes on Windows | done | `src/main/usage/paths.ts:162-191`, `paths.test.ts` | Union + dedup |
| #50 | Connect Hint Platform-Neutral | done | `src/main/mrr/settings.html:63` | "on this computer" |
| #51 | Settings Window Height | done | `src/main/mrr/settings-window.ts:60-72`, `settings-window.test.ts` | 713 px, `useContentSize` |
| #52 | DPR Drift Guard in Renderer | done | `src/renderer/renderer.ts:230-238`, `renderer.test.ts` | rAF loop + resize handler |
| #53 | Claude-XDG-Union + CRLF Test | done | `src/main/usage/paths.ts:54-60`, `paths.test.ts`, `read-lines.test.ts` | `win32` checks XDG + Legacy |
| #54 | npm ci to Lockfile State | done | `package-lock.json` | locally reported |
| #55 | TS-7-Ready tsconfig | done | `tsconfig.json:6` | `moduleResolution: nodenext` |
| #56 | Couple @types/node to Node 24 | done | `package.json:32` | `^24.0.0` |
| #57 | Resync after Failed Reset | done | `src/main/main.ts:225-237` | Catch path sends `PET_CHANGED` |
| #58 | Renderer Tests for Mid-Session Reset | done | `src/renderer/renderer.test.ts:141-202` | Hatch cancels evolution + stage snap |
| #59 | Switch Windows Window Icon to ICO | done | `src/main/mrr/settings-window.ts:279`, `settings-window.test.ts` | `icon.ico` under `win32` |
| #60 | Live-Gate Renderer Visuals | done | `docs/design-reviews/phase-4-windows/*.png` | 4 screenshots available |
| #61 | Windows Behavior Docs | done | `README.md:117-128` | Occlusion + fractional DPR |
| #62 | WSL Usage Logs Docs | done | `README.md:103-111` | Override workaround |
| #63 | Bubble Outline Fractional DPR | optional | — | not implemented, owner decision open |
| #64 | Launch Tier Quip Replay | optional | — | not implemented, upstream candidate |

---

## Reviewed Files

- `PRD.md` (Product Source of Truth)
- `CLAUDE.md` (Guardrails, Definition of Done)
- `.flightplan/Reference/windows-native-flight-plan.md` (M1 item specification)
- `.flightplan/ROADMAP.md` (Milestones)
- `src/main/main.ts`
- `src/main/overlay-adapter.ts` + `.test.ts`
- `src/main/tray.ts` + `.test.ts`
- `src/main/hardening.ts`
- `src/main/preload.ts` + `.test.ts`
- `src/main/mrr/secrets.ts` + `.test.ts`
- `src/main/mrr/mrr-engine.ts` + `.test.ts`
- `src/main/mrr/settings-window.ts` + `.test.ts`
- `src/main/mrr/settings.html`
- `src/main/usage/paths.ts` + `.test.ts`
- `src/main/usage/read-lines.ts` + `.test.ts`
- `src/renderer/renderer.ts` + `.test.ts`
- `src/renderer/canvas-dpr.ts` + `.test.ts`
- `electron-builder.yml`
- `package.json`
- `tsconfig.json`
- `README.md`
- `CONTRIBUTING.md`
- `docs/code-signing.md`
- `docs/design-reviews/phase-4-windows/verdict.md` + Screenshots
- `tools/puppet-studio/README.md` (Quick check, not M1 scope)

---

## Verdict

- **M1-done justified:** **Yes** — all items covered in M1 (#1–#6, #46–#62) are either fully implemented, deliberately marked as provisional (#3, #7), or documented as open (#4b, #48, #63, #64). There are no indications of incomplete or stub implementations in items marked `done`.
- **PR-ready:** **No** — the `README.md` gaps (#1, #2, #5) and the missing tests for `hardening.ts`/`main.ts` (#3, #4) should be closed before the next merge. They are quick to fix and prevent a public branch from landing with false user promises or untested P1 invariants.
- **Recommended next steps:**
  1. Correct `README.md` Windows section (MRR, Codex, signing).
  2. Add `hardening.test.ts` and `main.test.ts` (at least the pure-logic parts).
  3. Remove `NUL` from the working tree.
  4. Update `docs/design-reviews/phase-4-windows/verdict.md` to the existing screenshots.
