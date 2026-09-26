import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { SetupEntryWindow } from '../../packages/nuxt/src/runtime/shared/setup-entry';

const setupNuxt = vi.fn(async () => {});
const cleanupAll = vi.fn();
const disposeSharedNuxtApp = vi.fn(async () => {});

vi.mock('../../packages/nuxt/src/runtime/shared/nuxt', () => ({
  setupNuxt: (...args: unknown[]) => setupNuxt(...args),
}));

vi.mock('../../packages/nuxt/src/runtime/shared/cleanup', () => ({
  cleanupAll: (...args: unknown[]) => cleanupAll(...args),
}));

vi.mock('../../packages/nuxt/src/runtime/shared/setup-entry', async () => {
  const actual = await vi.importActual<
    typeof import('../../packages/nuxt/src/runtime/shared/setup-entry')
  >('../../packages/nuxt/src/runtime/shared/setup-entry');
  return {
    ...actual,
    disposeSharedNuxtApp: (...args: unknown[]) => disposeSharedNuxtApp(...args),
    tryUseNuxtAppFromUnctx: () => null,
  };
});

describe('restartSharedNuxtApp', () => {
  beforeEach(() => {
    setupNuxt.mockClear();
    cleanupAll.mockClear();
    disposeSharedNuxtApp.mockClear();
    delete (globalThis as { __UNTESTUTILS_FORCE_NUXT_REMOUNT__?: boolean })
      .__UNTESTUTILS_FORCE_NUXT_REMOUNT__;
  });

  test('invalidates worker memo and calls setupNuxt', async () => {
    const { restartSharedNuxtApp } = await import('../../packages/nuxt/src/runtime/shared/restart');
    const win = {
      __UNTESTUTILS_WORKER_SETUP__: Promise.resolve(),
      __UNTESTUTILS_WORKER_RESET_HOOK__: true,
      __UNTESTUTILS_BASELINE_ROUTE__: '/',
    } as SetupEntryWindow & { __UNTESTUTILS_BASELINE_ROUTE__?: string };

    await restartSharedNuxtApp(win);

    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(win.__UNTESTUTILS_WORKER_RESET_HOOK__).toBeUndefined();
    expect(disposeSharedNuxtApp).toHaveBeenCalled();
    expect(setupNuxt).toHaveBeenCalled();
    expect(
      (globalThis as { __UNTESTUTILS_FORCE_NUXT_REMOUNT__?: boolean })
        .__UNTESTUTILS_FORCE_NUXT_REMOUNT__,
    ).toBe(true);
  });

  test('continues restart even when cleanupAll throws', async () => {
    cleanupAll.mockImplementationOnce(() => {
      throw new Error('cleanup boom');
    });
    const { restartSharedNuxtApp } = await import('../../packages/nuxt/src/runtime/shared/restart');
    const win = {
      __UNTESTUTILS_WORKER_SETUP__: Promise.reject(new Error('stale')),
    } as SetupEntryWindow;
    void (win.__UNTESTUTILS_WORKER_SETUP__ as Promise<void>).catch(() => {});

    await restartSharedNuxtApp(win);
    expect(disposeSharedNuxtApp).toHaveBeenCalled();
    expect(setupNuxt).toHaveBeenCalled();
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
  });

  test('enableSharedNuxtHotRestart is idempotent', async () => {
    const on = vi.fn();
    const { enableSharedNuxtHotRestart } =
      await import('../../packages/nuxt/src/runtime/shared/restart');
    const win = {} as SetupEntryWindow;
    enableSharedNuxtHotRestart(win, { on });
    enableSharedNuxtHotRestart(win, { on });
    expect(on).toHaveBeenCalledTimes(2);
  });

  test('hot invalidate clears worker memo', async () => {
    const handlers: Record<string, () => void> = {};
    const { enableSharedNuxtHotRestart } =
      await import('../../packages/nuxt/src/runtime/shared/restart');
    const win = {
      __UNTESTUTILS_WORKER_SETUP__: Promise.resolve(),
      __UNTESTUTILS_WORKER_RESET_HOOK__: true,
    } as SetupEntryWindow;
    enableSharedNuxtHotRestart(win, {
      on: (event, cb) => {
        handlers[event] = cb;
      },
    });
    handlers['vite:beforeFullReload']!();
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(disposeSharedNuxtApp).toHaveBeenCalled();
  });
});
