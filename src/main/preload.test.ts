import { describe, expect, it, vi } from 'vitest';

// Captures the renderer-side API object passed to contextBridge.exposeInMainWorld.
const capture = vi.hoisted(() => ({
  exposedApi: undefined as Record<string, unknown> | undefined,
  ipcHandlers: new Map<string, ((...args: unknown[]) => void)[]>(),
}));

function emitIpcEvent(channel: string, ...args: unknown[]): void {
  capture.ipcHandlers.get(channel)?.forEach((handler) => handler(...args));
}

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((_apiName: string, api: Record<string, unknown>) => {
      capture.exposedApi = api;
    }),
  },
  ipcRenderer: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      if (!capture.ipcHandlers.has(channel)) {
        capture.ipcHandlers.set(channel, []);
      }
      capture.ipcHandlers.get(channel)!.push(handler);
    }),
  },
}));

// Import preload after mocking electron so the module-level exposeInMainWorld
// call uses the mocked bridge.
import './preload';

describe('preload API', () => {
  it('exposes beaverBuddy API', () => {
    expect(capture.exposedApi).toBeDefined();
    expect(capture.exposedApi).toHaveProperty('onBoundsChanged');
  });

  it('onBoundsChanged registers a handler for state:bounds and forwards the payload', () => {
    expect(capture.exposedApi).toBeDefined();
    const onBoundsChanged = capture.exposedApi!.onBoundsChanged as (callback: (bounds: { width: number; height: number }) => void) => void;

    const callback = vi.fn();
    onBoundsChanged(callback);

    expect(capture.ipcHandlers.has('state:bounds')).toBe(true);

    emitIpcEvent('state:bounds', {}, { width: 1920, height: 1040 });
    expect(callback).toHaveBeenCalledWith({ width: 1920, height: 1040 });
  });

  it('onBoundsChanged ignores payloads on other channels', () => {
    expect(capture.exposedApi).toBeDefined();
    const onBoundsChanged = capture.exposedApi!.onBoundsChanged as (callback: (bounds: { width: number; height: number }) => void) => void;

    const callback = vi.fn();
    onBoundsChanged(callback);

    emitIpcEvent('state:pet', { level: 1, stage: 'baby' });
    expect(callback).not.toHaveBeenCalled();
  });
});
