import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { layoutBubble } from './bubble.js';
import { BUBBLE_TAIL_SIZE_PX } from './pet-config.js';

// renderer.ts executes DOM side effects at module load time, so we stub the
// required globals before dynamically importing it in each test.

describe('renderer: HiDPI bounds and clear behavior', () => {
  let listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  let canvas: Record<string, unknown>;
  let ctx: Record<string, ReturnType<typeof vi.fn>>;
  let windowStub: Record<string, unknown>;

  beforeEach(() => {
    vi.resetModules();
    listeners = {};

    ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      fillText: vi.fn(),
    };
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '';
    ctx.strokeStyle = '';

    const beaverBuddy = {
      onPausedChanged: vi.fn((cb: (...args: unknown[]) => void) => {
        (listeners.paused ||= []).push(cb);
      }),
      onPetChanged: vi.fn((cb: (...args: unknown[]) => void) => {
        (listeners.pet ||= []).push(cb);
      }),
      onHatchStart: vi.fn((cb: (...args: unknown[]) => void) => {
        (listeners.hatch ||= []).push(cb);
      }),
      onQuip: vi.fn((cb: (...args: unknown[]) => void) => {
        (listeners.quip ||= []).push(cb);
      }),
      onBoundsChanged: vi.fn((cb: (...args: unknown[]) => void) => {
        (listeners.bounds ||= []).push(cb);
      }),
    };

    windowStub = {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 1,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        (listeners[`window:${event}`] ||= []).push(handler);
      }),
      requestAnimationFrame: vi.fn(),
      beaverBuddy,
    };

    class MockHTMLCanvasElement {
      width = 0;
      height = 0;
      style = { width: '', height: '' };
      getContext = vi.fn(() => ctx);
    }
    canvas = new MockHTMLCanvasElement();

    vi.stubGlobal('HTMLCanvasElement', MockHTMLCanvasElement);
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => canvas),
      hidden: false,
    });
    vi.stubGlobal('window', windowStub);
    vi.stubGlobal('requestAnimationFrame', windowStub.requestAnimationFrame);
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = '';
        constructor() {
          setTimeout(() => this.onload?.(), 0);
        }
      },
    );
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        tile: 32,
        fps: 8,
        sheetWidth: 64,
        sheetHeight: 32,
        rows: [{ name: 'idle', frames: 2 }],
      }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps bounds() logical while the canvas backing store scales by DPR', async () => {
    const { bounds } = await import('./renderer.js');

    expect(bounds()).toEqual({ width: 1920, height: 1080 });
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);

    windowStub.devicePixelRatio = 2;
    listeners['window:resize'][0]();
    listeners.bounds[0]({ width: 1920, height: 1080 });

    expect(bounds()).toEqual({ width: 1920, height: 1080 });
    expect(canvas.width).toBe(3840);
    expect(canvas.height).toBe(2160);
    expect(canvas.style.width).toBe('1920px');
    expect(canvas.style.height).toBe('1080px');
  });

  it('reconfigures DPR on window resize when devicePixelRatio changes', async () => {
    const { bounds } = await import('./renderer.js');

    windowStub.devicePixelRatio = 1.5;
    listeners['window:resize'][0]();

    expect(bounds()).toEqual({ width: 1920, height: 1080 });
    expect(canvas.width).toBe(2880);
    expect(canvas.height).toBe(1620);
  });

  it('clears the full canvas using logical bounds, not physical pixels', async () => {
    const { bounds } = await import('./renderer.js');

    windowStub.devicePixelRatio = 2;
    listeners.bounds[0]({ width: 1920, height: 1080 });
    ctx.clearRect.mockClear();

    // Trigger a draw: paused toggle sets needsDraw, then the rAF callback
    // runs draw() once.
    listeners.paused[0](true);
    const rafCallback = (windowStub.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls[0][0] as (t: number) => void;
    rafCallback(0);

    expect(bounds()).toEqual({ width: 1920, height: 1080 });
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
  });

  it('cancels an in-flight evolution when a hatch starts (mid-session reset)', async () => {
    await import('./renderer.js');

    // Start an evolution (simulating a stage-crossing token award).
    listeners.pet[0]({ level: 5, stage: 'baby', evolvingTo: 'teen' });

    const rafCallback = (windowStub.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls[0][0] as (t: number) => void;
    rafCallback(0);

    expect(windowStub.__debugPet).toEqual({ level: 5, stage: 'baby', evolving: true });

    // Mid-session reset: hatch starts while evolution is in flight.
    listeners.hatch[0]();

    // The hatch handler sets evolutionState = null synchronously; the rAF
    // callback picks it up and sets __debugPet.evolving = false.
    rafCallback(16);

    expect(windowStub.__debugPet.evolving).toBe(false);
  });

  it('snaps to the reset stage during an active hatch without evolvingTo', async () => {
    await import('./renderer.js');

    // Sync to a non-baby stage first so there is a real stage delta on reset.
    listeners.pet[0]({ level: 10, stage: 'teen' });

    const rafCallback = (windowStub.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls[0][0] as (t: number) => void;
    rafCallback(0);

    expect(windowStub.__debugPet.stage).toBe('teen');

    // Start the hatch (mid-session reset).
    listeners.hatch[0]();
    rafCallback(16);

    // Reset pet update: level → 1, stage → baby, no evolvingTo — the
    // renderer must snap the sheet synchronously without playing an
    // evolution animation, even while the hatch is active.
    listeners.pet[0]({ level: 1, stage: 'baby' });
    rafCallback(32);

    expect(windowStub.__debugPet).toEqual({ level: 1, stage: 'baby', evolving: false });
  });

  it('inflates the bubble dirty rect by 1px on all sides including tail bleed', async () => {
    const { bubbleDirtyRect } = await import('./renderer.js');
    const layout = layoutBubble('dam', 100, 100, 32, { width: 2000, height: 2000 });
    const rect = bubbleDirtyRect(layout);

    expect(rect.x).toBe(layout.x - 1);
    expect(rect.y).toBe(layout.y - 1);
    expect(rect.width).toBe(layout.width + 2);
    expect(rect.height).toBe(layout.height + BUBBLE_TAIL_SIZE_PX + 3);
  });
});
