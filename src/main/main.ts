import path from 'node:path';
import { app, BrowserWindow, powerMonitor, screen } from 'electron';
import { applySessionHardening, applyWindowHardening } from './hardening';
import { PAUSE_CHANGED_CHANNEL } from './ipc-channels';
import { createPauseState, isPaused, setSystemPause, toggleManualPause, type PauseState } from './pause-state';
import { createTray } from './tray';

const SMOKE_DELAY_MS = 3000;

let pauseState: PauseState = createPauseState();
let mainWindow: BrowserWindow | null = null;
// Electron has no getter for ignoreMouseEvents, so we track what we set.
let ignoresMouseEvents = false;

function broadcastPaused(): void {
  mainWindow?.webContents.send(PAUSE_CHANGED_CHANNEL, isPaused(pauseState));
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

  mainWindow = createWindow();

  createTray({
    isPaused: () => isPaused(pauseState),
    onTogglePause: () => {
      pauseState = toggleManualPause(pauseState);
      broadcastPaused();
    },
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
