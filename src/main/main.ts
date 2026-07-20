import path from 'node:path';
import { app, BrowserWindow, powerMonitor, screen } from 'electron';
import { applySessionHardening, applyWindowHardening } from './hardening';
import { parseInjectXp, parseKeychainService, parseQuipFlags, hasMrrPollNowFlag } from './flags';
import {
  BOUNDS_CHANGED_CHANNEL,
  HATCH_START_CHANNEL,
  PAUSE_CHANGED_CHANNEL,
  PET_CHANGED_CHANNEL,
  QUIP_CHANGED_CHANNEL,
} from './ipc-channels';
import { loadOnboardingState, saveOnboardingState } from './onboarding';
import { createPauseState, isPaused, setSystemPause, toggleManualPause, type PauseState } from './pause-state';
import { createTray, formatPetLabel } from './tray';
import { configureAlwaysOnTop, fitWindowToWorkArea, getOverlayWindowBounds, getPrimaryWorkAreaInfo, onWorkAreaChanged } from './overlay-adapter';
import { XpEngine, type PetUpdate } from './xp/engine';
import { UsageTracker } from './usage/tracker';
import { todayTotalTokens } from './usage/totals';
import { createDetectorState, detectEvents } from './quips/detectors';
import { QUIP_DISPLAY_DURATION_MS } from './quips/quip-config';
import { type QuipTrigger } from './quips/quips';
import { createSchedulerState, schedule, type SchedulerState } from './quips/scheduler';
import type { Stage } from './xp/curve';
import { MrrEngine } from './mrr/mrr-engine';
import { loadSettingsState, saveSettingsState, type SettingsState } from './mrr/settings-store';
import { openSettingsWindow } from './mrr/settings-window';
import { setUnpackagedDockIcon } from './app-icon';

const SMOKE_DELAY_MS = 3000;

// Enforce a single running instance. A second launch terminates immediately
// and, on Windows, asks the first instance to surface its window.
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

function appIconPath(): string {
  // Opaque 1024² RGB master, no baked squircle (Apple HIG / Icon Composer).
  // Packaged .app uses assets/beaver-buddy-icon.icns via electron-builder;
  // system applies the continuous-corner mask. Unpackaged Dock uses
  // setUnpackagedDockIcon (masks in-process — dock.setIcon bypasses the system).
  return path.join(app.getAppPath(), 'assets', 'beaver-buddy-icon.png');
}

function createWindow(): BrowserWindow {
  const initialBounds = getOverlayWindowBounds(screen.getPrimaryDisplay());

  const win = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    backgroundColor: '#00000000',
    icon: appIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  configureAlwaysOnTop(win);
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
      // Windows transparent frameless windows are enlarged by ~3px by the OS,
      // so exact equality fails. Allow a small tolerance in each dimension.
      boundsMatchWorkArea: (() => {
        const wb = win.getBounds();
        const wa = getOverlayWindowBounds(screen.getPrimaryDisplay());
        const tolerance = 4;
        return (
          Math.abs(wb.x - wa.x) <= tolerance &&
          Math.abs(wb.y - wa.y) <= tolerance &&
          Math.abs(wb.width - wa.width) <= tolerance &&
          Math.abs(wb.height - wa.height) <= tolerance
        );
      })(),
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    app.exit(0);
  }, SMOKE_DELAY_MS);
}

app.whenReady().then(async () => {
  applySessionHardening();

  // Unpackaged only: Electron.app has no bundle icon, so set Dock manually
  // with a squircle mask. Packaged builds keep the system-masked .icns.
  setUnpackagedDockIcon(appIconPath());

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
    await saveOnboardingState(stateDir, { hatched: true });
  }

  mainWindow = createWindow();

  let lastWorkArea = getPrimaryWorkAreaInfo();
  fitWindowToWorkArea(mainWindow, lastWorkArea);

  const unsubscribeWorkArea = onWorkAreaChanged((next) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (
      next.x === lastWorkArea.x &&
      next.y === lastWorkArea.y &&
      next.width === lastWorkArea.width &&
      next.height === lastWorkArea.height
    ) {
      return;
    }
    lastWorkArea = next;
    fitWindowToWorkArea(mainWindow, next);
    mainWindow.webContents.send(BOUNDS_CHANGED_CHANNEL, {
      width: next.width,
      height: next.height,
    });
  });

  mainWindow.on('closed', () => {
    unsubscribeWorkArea();
  });

  const xpEngine = new XpEngine(stateDir);

  const keychainService = parseKeychainService(process.argv);
  const mrrPollNowOnModeSwitch = hasMrrPollNowFlag(process.argv);
  let growthSettings: SettingsState = loadSettingsState(stateDir);
  xpEngine.setMode(growthSettings.mode);

  const mrrEngine = new MrrEngine({
    xpEngine,
    getMode: () => growthSettings.mode,
    getSecretStoreDir: () => stateDir,
    getKeychainService: () => keychainService,
    getConnected: () => ({ stripe: growthSettings.stripeConnected, revenuecat: growthSettings.revenuecatConnected }),
  });
  mrrEngine.start();

  // Named (not inline) so the QA-only --open-growth-settings flag below can
  // invoke the exact same code path the tray's Connect… / Settings… clicks
  // do — a native tray menu item can't be clicked via CDP, so a
  // scriptable flag is the only way to drive it, same family as --quip.
  // usageTracker is assigned below; getUsageSources reads the live ref.
  let usageTracker: UsageTracker | null = null;
  function applyUsageEnabled(next: SettingsState): void {
    usageTracker?.setEnabledSources({ claude: next.claudeEnabled, codex: next.codexEnabled });
  }
  function openGrowthSettings(): void {
    openSettingsWindow({
      stateDir,
      keychainService,
      getSettings: () => growthSettings,
      onSettingsChanged: (next) => {
        growthSettings = next;
        xpEngine.setMode(growthSettings.mode);
        applyUsageEnabled(growthSettings);
        tray.refresh();
        if (growthSettings.mode === 'mrr' && mrrPollNowOnModeSwitch) void mrrEngine.pollNow();
      },
      onProgressReset: async () => {
        // Persist before send: same exactly-once discipline as the launch
        // hatch path — a kill mid-hatch must not re-hatch on next launch.
        await saveOnboardingState(stateDir, { hatched: true });
        // Hatch before the pet update, same ordering invariant as
        // did-finish-load (the renderer suppresses evolution handling while
        // a hatch is active).
        mainWindow?.webContents.send(HATCH_START_CHANNEL);
        // Emits the pet update through the onUpdate wiring above, which
        // does tray.refresh() + PET_CHANGED — nothing else to notify.
        try {
          await xpEngine.resetProgress();
        } catch {
          // Persist failure (e.g. Windows transient rename lock from AV):
          // the hatch already started, but the XP state did not actually
          // change. Resync the renderer with the real current state so it
          // does not stay stuck on a false reset.
          const lastUpdate = xpEngine.getLastUpdate();
          mainWindow?.webContents.send(PET_CHANGED_CHANNEL, lastUpdate);
        }
      },
      getUsageSources: () => {
        usageTracker?.refresh();
        return (
          usageTracker?.getSourcesSnapshot() ?? {
            claude: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
            codex: { enabled: false, logsFound: false, connected: false, lifetimeTokens: 0, todayTokens: 0 },
          }
        );
      },
      onUsageEnabledChanged: ({ claudeEnabled, codexEnabled }) => {
        usageTracker?.setEnabledSources({ claude: claudeEnabled, codex: codexEnabled });
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
      onSelectGrowthMode: async (mode) => {
        if (mode === 'mrr' && !(growthSettings.stripeConnected || growthSettings.revenuecatConnected)) return;
        growthSettings = { ...growthSettings, mode };
        await saveSettingsState(stateDir, growthSettings);
        xpEngine.setMode(growthSettings.mode);
        if (mode === 'mrr' && mrrPollNowOnModeSwitch) void mrrEngine.pollNow();
      },
      onOpenGrowthSettings: openGrowthSettings,
      onOpenConnect: openGrowthSettings,
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
    await xpEngine.injectXp(injectXpAmount);
  }

  const usageTrackerInstance = new UsageTracker();
  usageTracker = usageTrackerInstance;
  usageTrackerInstance.setEnabledSources({
    claude: growthSettings.claudeEnabled,
    codex: growthSettings.codexEnabled,
  });
  usageTrackerInstance.start();
  await xpEngine.attachTracker(usageTrackerInstance);

  // codingSession/spend-tier/idle detection rides the tracker's own refresh
  // cadence via onTick (fires whether usage changed or not — idle detection
  // needs the zero-delta ticks too) rather than a second polling loop.
  let detectorState = createDetectorState();
  usageTrackerInstance.onTick((totals) => {
    const nowMs = Date.now();
    const result = detectEvents(detectorState, {
      nowMs,
      lifetimeTokens: totals.lifetime.totalTokens,
      todayTokens: todayTotalTokens(totals, nowMs),
    });
    detectorState = result.state;
    for (const event of result.events) fireQuip(event);
  });

  // webContents.send before the renderer has finished loading (and
  // attached its onPetChanged listener) is silently dropped, so the latest
  // engine update — including any evolution launch-time accrual already
  // triggered — is (re-)sent once the page is ready to receive it.
  mainWindow.webContents.once('did-finish-load', () => {
    // Send the initial bounds explicitly so the renderer never has to infer
    // the work area from window.innerWidth/Height.
    mainWindow?.webContents.send(BOUNDS_CHANGED_CHANNEL, {
      width: lastWorkArea.width,
      height: lastWorkArea.height,
    });

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
