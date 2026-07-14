import path from 'node:path';
import { app, BrowserWindow, powerMonitor, screen } from 'electron';
import { applySessionHardening, applyWindowHardening } from './hardening';
import { HATCH_START_CHANNEL, PAUSE_CHANGED_CHANNEL, PET_CHANGED_CHANNEL } from './ipc-channels';
import { loadOnboardingState, saveOnboardingState } from './onboarding';
import { createPauseState, isPaused, setSystemPause, toggleManualPause, type PauseState } from './pause-state';
import { createTray, formatPetLabel } from './tray';
import { XpEngine, type PetUpdate } from './xp/engine';
import { UsageTracker } from './usage/tracker';

const SMOKE_DELAY_MS = 3000;
const INJECT_XP_FLAG_PREFIX = '--inject-xp=';
// Only corner supported (plan Auto-decisions: no configurable corner — no
// requirement for one).
const HATCH_CORNER = 'bottom-left';

let pauseState: PauseState = createPauseState();
let mainWindow: BrowserWindow | null = null;
// Electron has no getter for ignoreMouseEvents, so we track what we set.
let ignoresMouseEvents = false;

function broadcastPaused(): void {
  mainWindow?.webContents.send(PAUSE_CHANGED_CHANNEL, isPaused(pauseState));
}

// Dev acceptance flag: --inject-xp=N adds N XP once at launch, through
// the real engine (see xp/engine.ts injectXp) — not a bypass.
// Stays in the shipped binary: harmless, local-only, no security surface.
function parseInjectXp(argv: readonly string[]): number | null {
  const arg = argv.find((a) => a.startsWith(INJECT_XP_FLAG_PREFIX));
  if (!arg) return null;
  const value = Number(arg.slice(INJECT_XP_FLAG_PREFIX.length));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true);
  ignoresMouseEvents = true;

  applyWindowHardening(win);

  win.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html')).catch((error: unknown) => {
    console.error('Failed to load renderer:', error);
    app.exit(1);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function printSmokeResultAndExit(win: BrowserWindow): void {
  setTimeout(() => {
    const result = {
      windowCreated: !win.isDestroyed(),
      alwaysOnTop: win.isAlwaysOnTop(),
      ignoresMouse: ignoresMouseEvents,
      // Like ignoreMouseEvents, transparency has no Electron getter — it is
      // set once at window construction and cannot change afterwards.
      transparent: true,
      paused: isPaused(pauseState),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    app.exit(0);
  }, SMOKE_DELAY_MS);
}

app.whenReady().then(() => {
  applySessionHardening();

  const stateDir = app.getPath('userData');

  // --reset-hatch is the hidden QA reset: it bypasses the stored flag so the
  // hatch replays immediately, without a separate clear-then-relaunch step.
  const onboarding = loadOnboardingState(stateDir);
  const shouldHatch = process.argv.includes('--reset-hatch') || !onboarding.hatched;
  if (shouldHatch) {
    // Persisted at trigger time, not sequence completion: guarantees
    // exactly-once even if the app is killed mid-sequence (~6s window) —
    // acceptable for a one-shot cosmetic onboarding, and --reset-hatch
    // recovers it. Avoids adding a hatch:done renderer -> main channel.
    saveOnboardingState(stateDir, { hatched: true });
  }

  mainWindow = createWindow();

  const xpEngine = new XpEngine(stateDir);

  const tray = createTray({
    isPaused: () => isPaused(pauseState),
    onTogglePause: () => {
      pauseState = toggleManualPause(pauseState);
      broadcastPaused();
    },
    getPetLabel: () => formatPetLabel(xpEngine.getState()),
  });

  // Registered before any accrual (--inject-xp, tracker attach) so every
  // update — including a launch-time stage crossing — flows through here
  // and lands in the engine's getLastUpdate() for the resend below.
  xpEngine.onUpdate((update: PetUpdate) => {
    tray.refresh();
    mainWindow?.webContents.send(PET_CHANGED_CHANNEL, update);
  });

  const injectXpAmount = parseInjectXp(process.argv);
  if (injectXpAmount !== null) {
    xpEngine.injectXp(injectXpAmount);
  }

  const usageTracker = new UsageTracker();
  usageTracker.start();
  xpEngine.attachTracker(usageTracker);

  // webContents.send before the renderer has finished loading (and
  // attached its onPetChanged listener) is silently dropped, so the latest
  // engine update — including any evolution launch-time accrual already
  // triggered — is (re-)sent once the page is ready to receive it.
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.webContents.send(PET_CHANGED_CHANNEL, xpEngine.getLastUpdate());
    if (shouldHatch) {
      mainWindow?.webContents.send(HATCH_START_CHANNEL, { corner: HATCH_CORNER });
    }
  });

  powerMonitor.on('suspend', () => {
    pauseState = setSystemPause(pauseState, true);
    broadcastPaused();
  });
  powerMonitor.on('resume', () => {
    pauseState = setSystemPause(pauseState, false);
    broadcastPaused();
  });

  if (process.argv.includes('--smoke')) {
    printSmokeResultAndExit(mainWindow);
  }
}).catch((error: unknown) => {
  console.error('Failed to start Beaver Buddy:', error);
  app.exit(1);
});
