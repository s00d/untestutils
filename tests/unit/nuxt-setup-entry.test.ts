import { describe, expect, test, vi } from 'vitest';
import {
  registerNuxtSetupEntry,
  resolveAppIsolation,
  type SetupEntryWindow,
} from '../../packages/nuxt/src/runtime/shared/setup-entry';

function createWindow(partial: Partial<SetupEntryWindow> = {}): SetupEntryWindow {
  return {
    __NUXT_VITEST_ENVIRONMENT__: true,
    ...partial,
  } as SetupEntryWindow;
}

describe('registerNuxtSetupEntry', () => {
  test('file mode calls setupNuxt on every beforeAll', async () => {
    const setupNuxt = vi.fn(async () => {});
    const resetModules = vi.fn();
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    const win = createWindow();

    for (let i = 0; i < 3; i++) {
      registerNuxtSetupEntry({
        mode: 'file',
        resetBetweenTests: false,
        window: win,
        setupNuxt,
        tryUseNuxtApp: () => null,
        vi: { resetModules },
        beforeAll: (fn) => {
          beforeAllFns.push(fn);
        },
      });
    }

    expect(resetModules).toHaveBeenCalledTimes(3);
    for (const fn of beforeAllFns) await fn();
    expect(setupNuxt).toHaveBeenCalledTimes(3);
  });

  test('file mode unmounts existing app before reboot', async () => {
    const unmount = vi.fn();
    let app: { vueApp: { unmount: () => void } } | null = {
      vueApp: { unmount },
    };
    const setupNuxt = vi.fn(async () => {
      app = { vueApp: { unmount: vi.fn() } };
    });
    let beforeAllFn: (() => void | Promise<void>) | undefined;
    registerNuxtSetupEntry({
      mode: 'file',
      resetBetweenTests: false,
      window: createWindow(),
      setupNuxt,
      tryUseNuxtApp: () => app,
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFn = fn;
      },
    });
    await beforeAllFn!();
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(setupNuxt).toHaveBeenCalledTimes(1);
  });

  test('worker mode calls setupNuxt once across files', async () => {
    const setupCalls = vi.fn(async () => {});
    const resetModules = vi.fn();
    const win = createWindow();
    let app: { vueApp: { unmount: () => void } } | null = null;

    for (let i = 0; i < 3; i++) {
      let beforeAllFn: (() => void | Promise<void>) | undefined;
      registerNuxtSetupEntry({
        mode: 'worker',
        resetBetweenTests: false,
        window: win,
        setupNuxt: async () => {
          await setupCalls();
          app = { vueApp: { unmount: vi.fn() } };
        },
        tryUseNuxtApp: () => app,
        vi: { resetModules },
        beforeAll: (fn) => {
          beforeAllFn = fn;
        },
      });
      await beforeAllFn!();
    }

    expect(resetModules).toHaveBeenCalledTimes(1);
    expect(setupCalls).toHaveBeenCalledTimes(1);
  });

  test('worker mode clears rejected promise so next file can retry', async () => {
    const win = createWindow();
    let shouldFail = true;
    const setupCalls = vi.fn(async () => {
      if (shouldFail) throw new Error('boot failed');
    });
    const unmount = vi.fn();
    const stop = vi.fn();
    let app: { vueApp: { unmount: () => void }; _scope?: { stop: () => void } } | null = null;

    const runFile = async () => {
      let beforeAllFn: (() => void | Promise<void>) | undefined;
      registerNuxtSetupEntry({
        mode: 'worker',
        resetBetweenTests: false,
        window: win,
        setupNuxt: async () => {
          app = { vueApp: { unmount }, _scope: { stop } };
          await setupCalls();
        },
        tryUseNuxtApp: () => app,
        vi: { resetModules: vi.fn() },
        beforeAll: (fn) => {
          beforeAllFn = fn;
        },
      });
      await beforeAllFn!();
    };

    await expect(runFile()).rejects.toThrow('boot failed');
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);

    shouldFail = false;
    app = null;
    await runFile();
    expect(setupCalls).toHaveBeenCalledTimes(2);
  });

  test('worker fail cleanup survives unmount throwing', async () => {
    const win = createWindow();
    const unmount = vi.fn(() => {
      throw new Error('unmount boom');
    });
    let app: { vueApp: { unmount: () => void } } | null = null;
    let beforeAllFn: (() => void | Promise<void>) | undefined;
    registerNuxtSetupEntry({
      mode: 'worker',
      resetBetweenTests: false,
      window: win,
      setupNuxt: async () => {
        app = { vueApp: { unmount } };
        throw new Error('boot failed');
      },
      tryUseNuxtApp: () => app,
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFn = fn;
      },
    });
    await expect(beforeAllFn!()).rejects.toThrow('boot failed');
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  test('resetSharedNuxtApp failure clears worker memo so next boot can recover', async () => {
    const win = createWindow();
    const afterEachFns: Array<() => void | Promise<void>> = [];
    let beforeAllFn: (() => void | Promise<void>) | undefined;
    const unmount = vi.fn();
    let app: { vueApp: { unmount: () => void } } | null = { vueApp: { unmount } };

    registerNuxtSetupEntry({
      mode: 'worker',
      resetBetweenTests: true,
      window: win,
      setupNuxt: vi.fn(async () => {}),
      tryUseNuxtApp: () => app,
      resetSharedNuxtApp: async () => {
        throw new Error('reset boom');
      },
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFn = fn;
      },
      afterEach: (fn) => {
        afterEachFns.push(fn);
      },
    });

    await beforeAllFn!();
    win.__UNTESTUTILS_WORKER_SETUP__ = Promise.resolve();
    await expect(afterEachFns[0]!()).rejects.toThrow(/call restartSharedApp/);
    expect(win.__UNTESTUTILS_NEEDS_RESTART__).toBe(true);
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(win.__UNTESTUTILS_WORKER_RESET_HOOK__).toBeUndefined();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  test('separate windows get independent worker setups', async () => {
    const setupCalls = vi.fn(async () => {});
    const wins = [createWindow(), createWindow()];
    const beforeAllFns: Array<() => void | Promise<void>> = [];

    for (const win of wins) {
      registerNuxtSetupEntry({
        mode: 'worker',
        resetBetweenTests: false,
        window: win,
        setupNuxt: setupCalls,
        tryUseNuxtApp: () => null,
        vi: { resetModules: vi.fn() },
        beforeAll: (fn) => {
          beforeAllFns.push(fn);
        },
      });
    }

    for (const fn of beforeAllFns) await fn();
    expect(setupCalls).toHaveBeenCalledTimes(2);
  });

  test('worker mode registers afterEach only once across setupFile re-evals', async () => {
    const resetSharedNuxtApp = vi.fn(async () => {});
    const afterEach = vi.fn((fn: () => void | Promise<void>) => {
      void fn;
    });
    const win = createWindow();

    for (let i = 0; i < 3; i++) {
      registerNuxtSetupEntry({
        mode: 'worker',
        resetBetweenTests: true,
        window: win,
        setupNuxt: vi.fn(async () => {}),
        tryUseNuxtApp: () => null,
        resetSharedNuxtApp,
        vi: { resetModules: vi.fn() },
        beforeAll: () => {},
        afterEach,
      });
    }

    expect(afterEach).toHaveBeenCalledTimes(1);
    expect(win.__UNTESTUTILS_WORKER_RESET_HOOK__).toBe(true);
  });

  test('node entry skips when browser flag set without fromBrowserEntry', () => {
    const setupNuxt = vi.fn(async () => {});
    const beforeAll = vi.fn();
    registerNuxtSetupEntry({
      mode: 'file',
      resetBetweenTests: false,
      window: createWindow({ __NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__: true }),
      setupNuxt,
      tryUseNuxtApp: () => null,
      vi: { resetModules: vi.fn() },
      beforeAll,
    });
    expect(beforeAll).not.toHaveBeenCalled();
    expect(setupNuxt).not.toHaveBeenCalled();
  });

  test('fromBrowserEntry registers even with browser flag', () => {
    const beforeAll = vi.fn();
    registerNuxtSetupEntry({
      mode: 'file',
      resetBetweenTests: false,
      window: createWindow({ __NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__: true }),
      setupNuxt: vi.fn(async () => {}),
      tryUseNuxtApp: () => null,
      vi: { resetModules: vi.fn() },
      beforeAll,
      fromBrowserEntry: true,
    });
    expect(beforeAll).toHaveBeenCalledTimes(1);
  });
});

describe('resolveAppIsolation', () => {
  test('defaults to file', () => {
    expect(resolveAppIsolation(undefined, createWindow())).toEqual({
      mode: 'file',
      resetBetweenTests: false,
    });
  });

  test('worker defaults resetBetweenTests to true', () => {
    expect(resolveAppIsolation({ nuxt: { appIsolation: 'worker' } }, createWindow())).toEqual({
      mode: 'worker',
      resetBetweenTests: true,
    });
  });

  test('reads window fallbacks', () => {
    expect(
      resolveAppIsolation(
        undefined,
        createWindow({
          __UNTESTUTILS_APP_ISOLATION__: 'worker',
          __UNTESTUTILS_RESET_BETWEEN_TESTS__: false,
        }),
      ),
    ).toEqual({
      mode: 'worker',
      resetBetweenTests: false,
    });
  });
});
