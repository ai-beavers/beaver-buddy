# Plan #46 — Visible "Reset progress" button in the Growth Settings window

## 1. Goal & acceptance criteria

The user can reset the beaver to the start at the push of a button in the "Growth Settings" window — while the app is running, without an app restart and without deleting the state dir.

Acceptance criteria:

- A visible, clearly separated button ("Danger zone") in `settings.html`, with two-click confirmation (no accidental reset).
- After triggering: XP = 0, Level = 1, Stage = `baby`; the hatch animation replays immediately in the overlay.
- MRR secrets (Stripe/RevenueCat keys) and growth settings (mode, connected flags) remain fully intact.
- The tray pet label shows `Lv 1 — baby (0/100)` immediately after the reset.
- No re-award of the token history: after the reset the running usage tracker must not credit the entire lifetime history as XP again.
- After an app restart the reset persists (persisted) and the hatch does NOT run again (the onboarding flag stays `hatched: true`).
- No new IPC sprawl: the new channel follows the existing settings pattern exactly (sender-frame check, handler testable without Electron).
- `npm test` (383 existing tests + new ones) green, `typecheck` and `lint` clean. No new dependencies, `package.json`/`package-lock.json` unchanged.

## 2. Reset semantics

State files in the single state dir (`app.getPath('userData')`, see `src/main/main.ts:191`):

| File / location | Content | Action on reset |
|---|---|---|
| `xp-state.json` (`src/main/xp/store.ts`) | `xp`, `lastSeenLifetimeTokens`, `lastMrrAwardDate` | `xp` → 0, `lastMrrAwardDate` → `null`. **`lastSeenLifetimeTokens` stays unchanged** — this is the tracker's forward-only durable cursor (`xp/engine.ts:89-100`); resetting it to 0 would credit the entire token history as XP again on the next tracker tick and effectively undo the reset. |
| `onboarding-state.json` (`src/main/onboarding.ts`) | `hatched` | Persist `{ hatched: true }` **before** the hatch message is sent — exactly the same exactly-once discipline as the launch path (`main.ts:197-203`): a kill in the middle of the ~6s hatch must not lead to a re-hatch on the next start. (`hatched: false` is not an option — there is no `hatch:done` back-channel, the file would never become `true` again.) |
| `growth-settings.json` (`src/main/mrr/settings-store.ts`) | `mode`, `stripeConnected`, `revenuecatConnected` | **Untouched.** |
| `secrets/<service>/*.enc` (path builder `src/main/mrr/secrets.ts:14-18`, Windows DPAPI/`safeStorage` `secrets.ts:25-35`) or macOS Keychain | Stripe/RevenueCat keys | **Untouched.** |

Resulting decisions:

- **No app restart needed.** All state owners (`XpEngine`, onboarding file, renderer hatch state) can be reset at runtime; no module caches the onboarding status after launch (it is read only once in `main.ts:195`). A restart would be worse UX with no correctness gain whatsoever.
- **MRR mode:** `lastMrrAwardDate = null` means: the next MRR poll may credit the daily MRR to the fresh beaver again. That is consistent with "restart of the pet" and does not allow a double-award of the same pet (the old pet no longer exists).
- **No evolution signal on reset:** the stage change adult/teen → baby is a regression, not an evolution. The pet update emitted by the reset carries **no** `evolvingTo` — otherwise `main.ts:297-299` fires the `evolution` quip and the renderer starts the evolution sequence (`renderer.ts:150-160`). On updates without `evolvingTo` the renderer syncs the stage directly (`renderer.ts:170-174`), which is also correct during an active hatch.
- The hidden QA flag `--reset-hatch` (`main.ts:193-196`) remains unchanged (minimal change; the button is not a replacement but the user-visible variant).

## 3. Architecture / flow

New channel: **`settings:reset-progress`** (constant `SETTINGS_RESET_PROGRESS_CHANNEL`), without payload — therefore no extension of `settings-validate.ts` is needed (nothing to validate; the renderer is still not trusted, the sender-frame check is the safeguard).

Renderer flow (settings.html):

1. User clicks "Reset beaver…" → button arms (text becomes "Sure? Click again to reset", a 5-s timeout disarms it again).
2. Second click within the window → `api.resetProgress()` → result in `#status` ("progress reset — hatch replaying" / `error: …`).

Main flow:

1. `ipcMain.handle(SETTINGS_RESET_PROGRESS_CHANNEL)` → `handlers.resetProgress(event)` (in `createSettingsHandlers`): sender-frame check (`isFromSettingsWindow`), then `await deps.onProgressReset()`, success `{ ok: true }`, exception → `{ ok: false, error: 'reset failed' }`.
2. `deps.onProgressReset` is wired in `main.ts` (`openGrowthSettings`) and does, in this order:
   1. `await saveOnboardingState(stateDir, { hatched: true })`
   2. `mainWindow?.webContents.send(HATCH_START_CHANNEL)` — hatch **before** the pet update, the same ordering invariant as `main.ts:336-340` (the renderer suppresses evolution handling during the hatch).
   3. `await xpEngine.resetProgress()` — persists `xp-state.json` and emits the update.
3. Overlay and tray notification run **automatically** via the existing `xpEngine.onUpdate` wiring (`main.ts:294-300`): `tray.refresh()` + `PET_CHANGED_CHANNEL` send. No new code needed.
4. The renderer (`renderer.ts:183-192` / `148-176`) already processes `onHatchStart` and the pet update correctly at runtime (hatch state is set anew, the lodge sheet is reloaded if needed, the stage syncs directly to `baby`). **Only renderer change (one-line fix, orchestrator decision on verification finding 1):** in `onHatchStart`, `evolutionState = null;` is set — otherwise the direct-sync branch guarded by `!evolutionState` (`renderer.ts:170`) would discard the reset pet update if an evolution happens to be active (~2-s window), and the renderer would be stuck on teen/adult until the next pet update/restart. The premise "no renderer change" is thereby narrowed down to exactly this one line.

Handler signature (following the `SettingsHandlers` pattern):

```ts
resetProgress(event: IpcMainInvokeEvent): Promise<unknown>;
```

New dep in `SettingsWindowDeps`:

```ts
readonly onProgressReset: () => Promise<void>;
```

## 4. Concrete change list per file

### `src/main/ipc-channels.ts`
- New constant in the settings block: `export const SETTINGS_RESET_PROGRESS_CHANNEL = 'settings:reset-progress';`

### `src/main/mrr/settings-window.ts`
- `SettingsWindowDeps`: add field `onProgressReset: () => Promise<void>`.
- `SettingsHandlers`: add method `resetProgress(event): Promise<unknown>`.
- `createSettingsHandlers`: implement `resetProgress` — `if (!isAuthorized(event)) return { ok: false, error: 'unauthorized' };`, then `try { await deps.onProgressReset(); return { ok: true }; } catch { return { ok: false, error: 'reset failed' }; }`. Comment in the style of the file: reset orchestration (XP, onboarding, hatch send) lives with the dep caller in main.ts, not here.
- `registerHandlers`: `ipcMain.handle(SETTINGS_RESET_PROGRESS_CHANNEL, (event) => handlers.resetProgress(event));` + import of the constant.
- `openSettingsWindow`: window height `480` → `540` (the new danger-zone fieldset needs ~60 px; the window is `resizable: false`, so the height must grow with it). Width 420 stays.

### `src/main/mrr/settings-preload.ts`
- Hand-synced literal: `const SETTINGS_RESET_PROGRESS_CHANNEL = 'settings:reset-progress'; // must match src/main/ipc-channels.ts`
- In `contextBridge.exposeInMainWorld('beaverBuddySettings', …)`: `resetProgress: (): Promise<unknown> => ipcRenderer.invoke(SETTINGS_RESET_PROGRESS_CHANNEL),`
- Update the top comment ("exposes exactly the three settings calls") to four calls.

### `src/renderer/renderer.ts`
- One-line fix in `onHatchStart` (`renderer.ts:183-192`): `evolutionState = null;` right after `hatchState = startHatch();`. Fixes verification finding 1: an evolution that happens to be running at reset time would discard the stage direct-sync of the reset pet update (`renderer.ts:170` is guarded by `!evolutionState`) and flip back to teen/adult at evolution end (`renderer.ts:406-412`) — a persistent stage mismatch until the next pet update/restart. With the fix, a `HATCH_START` immediately terminates any running evolution; the update arriving afterwards syncs the stage directly to `baby`.

### `src/main/mrr/settings.html`
- New fieldset **below** "Growth source", before `#status`:
  ```html
  <fieldset>
    <legend>Reset</legend>
    <div class="row">
      <button id="resetProgress" type="button">Reset beaver (XP &amp; hatch)</button>
    </div>
  </fieldset>
  ```
  (No separate CSS needed; optional minimal inline style for the arming color, the existing style is sufficient.)
- Inline JS (plain, no framework, no dependency — `confirm()` is deliberately NOT used; the two-click pattern is deterministic and guaranteed available in the sandboxed renderer):
  - Click 1: button arms — text `Sure? Click again to reset`, `setTimeout` (5 s) disarms (text back, flag false).
  - Click 2 (armed): disarm + `const result = await api.resetProgress(); setStatus(result && result.ok ? 'progress reset — hatch replaying' : \`error: ${result && result.error}\`);`
  - No `refresh()` needed after reset (settings values do not change).
- **Don't forget the rebuild (verification finding 3):** `settings.html` reaches `dist/main/mrr/settings.html` exclusively via `npm run build` (`scripts/build-assets.js`); `settings-window.ts` loads only the dist copy. Vitest does not cover dist — a stale dist state does not show up in tests. So after the HTML change, running `npm run build` is mandatory (before visual check/smoke).

### `src/main/xp/engine.ts`
- New method `async resetProgress(): Promise<void>`:
  - Sets `this.state = { ...this.state, xp: 0, lastMrrAwardDate: null }` (the cursor `lastSeenLifetimeTokens` stays!), `await saveState(this.stateDir, this.state)`.
  - Emits **without** `applyState` (there `evolvingTo` would be set on stage regression): `const update: PetUpdate = { level: 1, stage: 'baby' };` (or derived from `getState()`), `this.lastUpdate = update`, notify listeners.
  - Comment: why no `evolvingTo` (a reset is not an evolution — no evolution quip, no evolution sequence; the renderer syncs the stage directly) and why the cursor stays (forward-only invariant, no re-award of the history).

### `src/main/main.ts`
- In `openGrowthSettings()`, pass the new dep to the `openSettingsWindow({...})` call:
  ```ts
  onProgressReset: async () => {
    // Persist before send: same exactly-once discipline as the launch hatch
    // path — a kill mid-hatch must not re-hatch on next launch.
    await saveOnboardingState(stateDir, { hatched: true });
    // Hatch before the pet update, same ordering invariant as did-finish-load.
    mainWindow?.webContents.send(HATCH_START_CHANNEL);
    await xpEngine.resetProgress(); // onUpdate wiring does tray.refresh() + PET_CHANGED
  },
  ```
- No further changes (tray refresh, PET_CHANGED run via `xpEngine.onUpdate`; `HATCH_START_CHANNEL`/`saveOnboardingState` are already imported).

### Do not touch
- `src/main/mrr/settings-validate.ts` — the channel has no payload.
- `src/renderer/*` except the one-line fix in `renderer.ts` mentioned above (`evolutionState = null;` in `onHatchStart`) — re-hatch and stage sync already work at runtime.
- `scripts/build-assets.js` — already copies `settings.html` to `dist/main/mrr/`; build path unchanged (but: run `npm run build` after the HTML change, see above).
- `package.json` / `package-lock.json` — no new dependencies.

## 5. Test plan

### `src/main/xp/engine.test.ts` (extend, following the existing describe blocks)
- `resetProgress` sets XP/level/stage to 0/1/`baby` and persists (`loadState(stateDir)` then yields `xp: 0`, `lastMrrAwardDate: null`).
- `resetProgress` **preserves** `lastSeenLifetimeTokens` (set the cursor to N beforehand via `ingestLifetimeTokens`; still N after the reset; a repeated `ingestLifetimeTokens(N)` awards nothing again — the central no-re-award test).
- `resetProgress` emits exactly one update `{ level: 1, stage: 'baby' }` **without** `evolvingTo` (listener spy) and updates `getLastUpdate()`.

### `src/main/mrr/settings-window.test.ts` (extend)
- Extend the existing unauthorized test ("rejected on all three handlers") to four handlers: `resetProgress` returns `{ ok: false, error: 'unauthorized' }` and does not call the dep.
- Success path: authorized → dep is called exactly once, returns `{ ok: true }`.
- Error path: dep throws → `{ ok: false, error: 'reset failed' }`.
- Add `onProgressReset: vi.fn().mockResolvedValue(undefined)` to `deps()` in the test.

### `src/main/ipc-channels.test.ts` (extend)
- Drift-guard case: the `settings-preload.ts` literal `SETTINGS_RESET_PROGRESS_CHANNEL` matches the constant (exactly the regex pattern of the three existing settings cases).

### Manual / design gate
- Run `npm run build` before the visual check/smoke so that `dist/main/mrr/settings.html` is current (verification finding 3; `npm start` builds implicitly, but the visual check against dist must follow the change).
- One-time visual check of the settings window (420x540): no overflow, danger zone visible, two-click arming readable. The settings window is a visible UI change → screenshot + short verdict under `docs/design-reviews/` (convention from CLAUDE.md).
- Smoke: start the app, inject XP (`--inject-xp`), open settings, trigger reset → hatch plays, tray shows `Lv 1`, `xp-state.json` has `xp: 0` with unchanged cursor, `growth-settings.json` and `secrets/` unchanged.

## 6. Risks / open questions

- **Window height 480 → 540:** estimated, not measured; check during the visual check whether 540 is enough or leaves too much empty space, fine-tune if needed.
- **Reset during a running evolution in the renderer (corrected per verification finding 1):** the direct-sync branch (`renderer.ts:170`) is guarded by `!evolutionState` — if the reset pet update arrives while an evolution (~2 s) is active, the stage sync is discarded and `renderer.ts:406-412` resets to teen/adult at evolution end: a persistent stage mismatch until the next pet update/restart (not a "parallel continuation"). **Decision (orchestrator):** the one-line fix is implemented — `evolutionState = null;` in `onHatchStart` (see §4 `src/renderer/renderer.ts`). A reset during a running *hatch* is uncritical: `hatchState` is simply set anew on the new `HATCH_START`.
- **`lastMrrAwardDate = null`:** in MRR mode the next poll may credit the daily MRR to the fresh beaver again (intended, see §2). If the owner does not want that, preserve `lastMrrAwardDate` instead — a one-line change to `resetProgress()`.
- **No `hatch:done` back-channel:** as with the launch path — a kill during the re-hatch → no hatch on the next start. Accepted as acceptable (existing invariant).
- Open (low): whether the reset button should also be linked in the tray — deliberately NOT included in the plan (scope #46: settings window).
