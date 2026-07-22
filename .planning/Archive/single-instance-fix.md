# Single-Instance Protection for Beaver Buddy

**Date:** 2026-07-15  
**Trigger:** During manual testing of the Windows app, two beaver instances were displayed at the same time. The user has decided that only one app instance may run at a time.

---

## Problem

Beaver Buddy uses Electron. Without explicit protection, every call to `npm start` (or every click on the `.exe`) launches another, complete Electron main-process instance. This leads to:

- Multiple overlay windows with beavers stacked on top of each other.
- Multiple tray icons.
- Duplicate token-tracking, XP, and MRR processes.
- Inconsistent app state, because multiple processes write to the same `userData`.

## Solution

An Electron single-instance lock was added at the very beginning of the main process in `src/main/main.ts`:

```ts
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});
```

### Behavior

- **First launch:** Acquires the lock, the window is created, the app runs normally.
- **Second launch:** Does not get the lock and exits immediately with exit code `0`. No second window, no second tray icon, no second tracking process appears.
- **Focus restoration:** If the existing instance is ever minimized, the window is restored and brought to the foreground.

## Affected Files

- `src/main/main.ts` — added: `app.requestSingleInstanceLock()`, `app.on('second-instance', ...)`.

## Tests / Verification

- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (341 passed, 6 skipped)
- `npm start` (first launch) shows the beaver.
- `npm start` (second launch) exits immediately without opening a second window.

## Notes / Limitations

- The lock applies per user profile (Electron uses the app name as the lock name). Other Windows users can still start their own instance — that is the expected behavior.
- If Beaver Buddy should ever intentionally run in parallel with separate profiles (e.g. `--user-data-dir`), the lock mechanism must be extended accordingly.
- The `second-instance` handler brings the window to the foreground. Since the overlay window is `focusable: false` and `alwaysOnTop: true`, the click-through behavior is preserved.
