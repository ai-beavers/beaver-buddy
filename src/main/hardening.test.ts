import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionMocks } = vi.hoisted(() => ({
  sessionMocks: {
    setPermissionRequestHandler: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  session: {
    defaultSession: sessionMocks,
  },
}));

import { applySessionHardening, applyWindowHardening } from './hardening';

function createFakeWindow() {
  const handlers = new Map<string, ((...args: unknown[]) => unknown)>();
  return {
    handlers,
    win: {
      webContents: {
        on: vi.fn((eventName: string, handler: (...args: unknown[]) => unknown) => {
          handlers.set(eventName, handler);
        }),
        setWindowOpenHandler: vi.fn(),
      },
    } as unknown as Electron.BrowserWindow,
  };
}

beforeEach(() => {
  sessionMocks.setPermissionRequestHandler.mockClear();
  sessionMocks.on.mockClear();
});

describe('applyWindowHardening', () => {
  it('registers a will-navigate handler that calls preventDefault()', () => {
    const { handlers, win } = createFakeWindow();
    applyWindowHardening(win);
    const willNavigateHandler = handlers.get('will-navigate');
    expect(willNavigateHandler).toBeDefined();
    const event = { preventDefault: vi.fn() };
    willNavigateHandler!(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('sets a window-open handler that returns { action: "deny" }', () => {
    const { win } = createFakeWindow();
    applyWindowHardening(win);
    expect(win.webContents.setWindowOpenHandler).toHaveBeenCalledTimes(1);
    const handler = vi.mocked(win.webContents.setWindowOpenHandler).mock.calls[0][0];
    expect(handler({} as Electron.HandlerDetails)).toEqual({ action: 'deny' });
  });
});

describe('applySessionHardening', () => {
  it('registers a permission handler that denies every request', () => {
    applySessionHardening();
    expect(sessionMocks.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    const handler = sessionMocks.setPermissionRequestHandler.mock.calls[0][0];
    const callback = vi.fn();
    handler(null, 'notifications', callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('registers a will-download handler that calls preventDefault()', () => {
    applySessionHardening();
    expect(sessionMocks.on).toHaveBeenCalledWith('will-download', expect.any(Function));
    const handler = sessionMocks.on.mock.calls[0][1] as (event: { preventDefault: () => void }) => void;
    const event = { preventDefault: vi.fn() };
    handler(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
