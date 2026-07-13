// Plain script (no imports/exports) so tsc's commonjs output stays
// require-free and loadable via a bare <script> tag — no bundler.
// Draws a static pixel placeholder; the real beaver sprite arrives in
// a later item. Dims the placeholder while paused so the tray toggle + IPC
// wiring is visibly demonstrable even with no animation yet.

// Global interface merge (declares the preload-exposed API) — the lint rule
// can't see the implicit use, so it looks unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
  beaverBuddy: {
    onPausedChanged(callback: (paused: boolean) => void): void;
  };
}

const PLACEHOLDER_SIZE = 24;
const PLACEHOLDER_MARGIN = 16;
const COLOR_ACTIVE = '#8a5a34';
const COLOR_PAUSED = '#8a5a3455';

const canvasEl = document.getElementById('stage');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('missing #stage canvas element');
}
const canvas: HTMLCanvasElement = canvasEl;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2d canvas context unavailable');
}
const ctx: CanvasRenderingContext2D = context;
ctx.imageSmoothingEnabled = false;

let paused = false;

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = paused ? COLOR_PAUSED : COLOR_ACTIVE;
  const x = PLACEHOLDER_MARGIN;
  const y = canvas.height - PLACEHOLDER_MARGIN - PLACEHOLDER_SIZE;
  ctx.fillRect(x, y, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
}

window.beaverBuddy.onPausedChanged((nextPaused) => {
  paused = nextPaused;
  draw();
});

draw();
