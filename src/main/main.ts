import path from 'node:path';
import { app, BrowserWindow, powerMonitor, screen } from 'electron';
import { applySessionHardening, applyWindowHardening } from './hardening';
import { HATCH_START_CHANNEL, PAUSE_CHANGED_CHANNEL, PET_CHANGED_CHANNEL, QUIP_CHANGED_CHANNEL } from './ipc-channels';
import { loadOnboardingState, saveOnboardingState } from './onboarding';
import { createPauseState, isPaused, setSystemPause, toggleManualPause, type PauseState } from './pause-state';
import { createTray, formatPetLabel } from './tray';
import { XpEngine, type PetUpdate } from './xp/engine';
import { UsageTracker } from './usage/tracker';
import { createDetectorState, detectEvents } from './quips/detectors';
import { QUIP_DISPLAY_DURATION_MS } from './quips/quip-config';
import { QUIP_POOLS, type QuipTrigger } from './quips/quips';
import { createSchedulerState, schedule, type SchedulerState } from './quips/scheduler';
import type { Stage } from './xp/curve';
import { isValidKeychainService } from './mrr/keychain';
import { DEFAULT_KEYCHAIN_SERVICE } from './mrr/mrr-config';
import { MrrEngine } from './mrr/mrr-engine';
import { loadSettingsState, saveSettingsState, type SettingsState } from './mrr/settings-store';
import { openSettingsWindow } from './mrr/settings-window';

const SMOKE_DELAY_MS = 3000;
const INJECT_XP_FLAG_PREFIX = '--inject-xp=';
const QUIP_FLAG = '--quip';
const KEYCHAIN_SERVICE_FLAG = '--keychain-service';
const MRR_POLL_NOW_FLAG = '--mrr-poll-now';
const QUIP_TRIGGERS = Object.keys(QUIP_POOLS) as readonly QuipTrigger[];

let pauseState: PauseState = createPauseState();
let mainWindow: BrowserWindow | null = null;
// Electron has no getter for ignoreMouseEvents, so we track what we set.
let ignoresMouseEvents = false;
let quipSchedulerState: SchedulerState = createSchedulerState();
// A quip fired before did-finish-load would be dropped by webContents.send
// yet still burn the scheduler cooldown, silently suppressing the next
// visible quip. So fireQuip is a full no-op until the page has loaded;
// launch-time evolution is replayed inside the did-finish-load handler from
// the engine's getLastUpdate() — the same resend pattern as PET_CHANGED.
let rendererReadyForQuips = false;

function broadcastPaused(): void {
  mainWindow?.webContents.send(PAUSE_CHANGED_CHANNEL, isPaused(pauseState));
}

// Runs every trigger through the real scheduler (cooldown + no-immediate-
// repeat); only sends IPC when the scheduler actually picks a quip.
function fireQuip(trigger: QuipTrigger, evolvedStage?: Stage): void {
  if (!rendererReadyForQuips) return;
  const result = schedule(quipSchedulerState, trigger, Date.now(), Math.random, evolvedStage);
  quipSchedulerState = result.state;
  if (result.text) {
    mainWindow?.webContents.send(QUIP_CHANGED_CHANNEL, { text: result.text, durationMs: QUIP_DISPLAY_DURATION_MS });
  }
}

function isQuipTrigger(value: string | undefined): value is QuipTrigger {
  return QUIP_TRIGGERS.includes(value as QuipTrigger);
}

// Dev acceptance flag: --quip <trigger> [--quip <trigger> ...] fires each
// named trigger through the real scheduler after window load — the
// scriptable acceptance mechanism, mirroring --inject-xp. Multiple
// occurrences let a single launch demonstrate the cooldown suppressing a
// second trigger fired immediately after the first.
function parseQuipFlags(argv: readonly string[]): QuipTrigger[] {
  const triggers: QuipTrigger[] = [];
  argv.forEach((arg, i) => {
    if (arg === QUIP_FLAG && isQuipTrigger(argv[i + 1])) {
      triggers.push(argv[i + 1] as QuipTrigger);
    }
  });
  return triggers;
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

// Dev flag: --keychain-service <name> overrides the Keychain service name
// (space-separated, like --quip) so QA never touches the real entries.
// A name failing isValidKeychainService (leading '-', stray charset,
// oversize) falls back to the default rather than reaching `security` argv.
function parseKeychainService(argv: readonly string[]): string {
  const i = argv.indexOf(KEYCHAIN_SERVICE_FLAG);
  const value = i !== -1 ? argv[i + 1] : undefined;
  return value && isValidKeychainService(value) ? value : DEFAULT_KEYCHAIN_SERVICE;
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

  const keychainService = parseKeychainService(process.argv);
  const mrrPollNowOnModeSwitch = process.argv.includes(MRR_POLL_NOW_FLAG);
  let growthSettings: SettingsState = loadSettingsState(stateDir);
  xpEngine.setMode(growthSettings.mode);

  const mrrEngine = new MrrEngine({
    xpEngine,
    getMode: () => growthSettings.mode,
    getKeychainService: () => keychainService,
    getConnected: () => ({ stripe: growthSettings.stripeConnected, revenuecat: growthSettings.revenuecatConnected }),
  });
  mrrEngine.start();

  // Named (not inline) so the QA-only --open-growth-settings flag below can
  // invoke the exact same code path the tray's "Growth settings…" click
  // does — a native tray menu item can't be clicked via CDP, so a
  // scriptable flag is the only way to drive it, same family as --quip.
  function openGrowthSettings(): void {
    openSettingsWindow({
      stateDir,
      keychainService,
      getSettings: () => growthSettings,
      onSettingsChanged: (next) => {
        growthSettings = next;
        xpEngine.setMode(growthSettings.mode);
        tray.refresh();
        if (growthSettings.mode === 'mrr' && mrrPollNowOnModeSwitch) void mrrEngine.pollNow();
      },
    });
  }

  const debugTrayMenu = process.argv.includes('--debug-tray-menu');
  const tray = createTray(
    {
      isPaused: () => isPaused(pauseState),
      onTogglePause: () => {
        pauseState = toggleManualPause(pauseState);
        broadcastPaused();
      },
      getPetLabel: () => formatPetLabel(xpEngine.getState()),
      getGrowthMode: () => growthSettings.mode,
      isMrrAvailable: () => growthSettings.stripeConnected || growthSettings.revenuecatConnected,
      onSelectGrowthMode: (mode) => {
        if (mode === 'mrr' && !(growthSettings.stripeConnected || growthSettings.revenuecatConnected)) return;
        growthSettings = { ...growthSettings, mode };
        saveSettingsState(stateDir, growthSettings);
        xpEngine.setMode(growthSettings.mode);
        if (mode === 'mrr' && mrrPollNowOnModeSwitch) void mrrEngine.pollNow();
      },
      onOpenGrowthSettings: openGrowthSettings,
    },
    debugTrayMenu ? (labels) => process.stdout.write(`TRAY_MENU: ${JSON.stringify(labels)}\n`) : undefined,
  );

  if (process.argv.includes('--open-growth-settings')) openGrowthSettings();

  // Registered before any accrual (--inject-xp, tracker attach) so every
  // update — including a launch-time stage crossing — flows through here
  // and lands in the engine's getLastUpdate() for the resend below.
  xpEngine.onUpdate((update: PetUpdate) => {
    tray.refresh();
    mainWindow?.webContents.send(PET_CHANGED_CHANNEL, update);
    if (update.evolvingTo) {
      fireQuip('evolution', update.evolvingTo);
    }
  });

  const injectXpAmount = parseInjectXp(process.argv);
  if (injectXpAmount !== null) {
    xpEngine.injectXp(injectXpAmount);
  }

  const usageTracker = new UsageTracker();
  usageTracker.start();
  xpEngine.attachTracker(usageTracker);

  // codingSession/tokenSpike/idle detection rides the tracker's own refresh
  // cadence via onTick (fires whether usage changed or not — idle detection
  // needs the zero-delta ticks too) rather than a second polling loop.
  let detectorState = createDetectorState();
  usageTracker.onTick((totals) => {
    const result = detectEvents(detectorState, { nowMs: Date.now(), lifetimeTokens: totals.lifetime.totalTokens });
    detectorState = result.state;
    for (const event of result.events) fireQuip(event);
  });

  // webContents.send before the renderer has finished loading (and
  // attached its onPetChanged listener) is silently dropped, so the latest
  // engine update — including any evolution launch-time accrual already
  // triggered — is (re-)sent once the page is ready to receive it.
  mainWindow.webContents.once('did-finish-load', () => {
    // Hatch first: the renderer suppresses the animated evolution for pet
    // updates that arrive while a hatch is active, which only works if the
    // hatch message lands before a launch-time evolving update.
    if (shouldHatch) {
      mainWindow?.webContents.send(HATCH_START_CHANNEL);
    }
    const lastUpdate = xpEngine.getLastUpdate();
    mainWindow?.webContents.send(PET_CHANGED_CHANNEL, lastUpdate);

    // From here on quips reach the renderer; earlier fireQuip calls were
    // no-ops (see rendererReadyForQuips), so nothing has burned the
    // cooldown yet and each launch-time trigger below fires exactly once.
    rendererReadyForQuips = true;

    // Launch-time evolution (e.g. --inject-xp crossing a stage) emitted
    // before the page loaded: replay it here, exactly like the PET_CHANGED
    // resend above. Live evolutions after this point flow through
    // xpEngine.onUpdate as normal.
    if (lastUpdate.evolvingTo) {
      fireQuip('evolution', lastUpdate.evolvingTo);
    }

    // Scripted --quip triggers next, so a QA launch can control exactly
    // what fires (and, with two flags, demonstrate cooldown suppression)
    // without racing the automatic appStart trigger below.
    for (const trigger of parseQuipFlags(process.argv)) {
      fireQuip(trigger, trigger === 'evolution' ? xpEngine.getState().stage : undefined);
    }

    // appStart is suppressed on the hatch launch (hatch owns the first
    // impression) and, incidentally, by the cooldown if an evolution or
    // --quip trigger above already fired — same mechanism, no special-casing.
    if (!shouldHatch) {
      fireQuip('appStart');
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
