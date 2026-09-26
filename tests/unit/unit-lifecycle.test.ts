/** @vitest-environment happy-dom */
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addCleanup,
  cleanupAll,
  removeCleanup,
  bumpUnitBootCounter,
  applyHostResetLayers,
  disposeBestEffort,
  registerSetupEntry,
  invalidateWorkerSetup,
  applyWorkerIsolationDefaults,
  type SetupEntryWindow,
} from '../../packages/vitest/src/unit-lifecycle';

describe('unit-lifecycle cleanupAll', () => {
  test('runs later cleanups even if one throws', () => {
    const second = vi.fn();
    addCleanup(() => {
      throw new Error('first boom');
    });
    addCleanup(second);
    expect(() => cleanupAll()).toThrow('first boom');
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('AggregateError when multiple cleanups throw', () => {
    addCleanup(() => {
      throw new Error('a');
    });
    addCleanup(() => {
      throw new Error('b');
    });
    expect(() => cleanupAll()).toThrow(AggregateError);
  });

  test('removeCleanup prevents execution', () => {
    const spy = vi.fn();
    addCleanup(spy);
    removeCleanup(spy);
    cleanupAll();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('unit-lifecycle registerSetupEntry (fake adapter)', () => {
  function makeWin(overrides: Partial<SetupEntryWindow> = {}): SetupEntryWindow {
    return {
      __UNTESTUTILS_ENVIRONMENT__: true,
      ...overrides,
    } as SetupEntryWindow;
  }

  test('worker memoizes setup once', async () => {
    const setup = vi.fn(async () => {});
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    let app: { vueApp: { unmount: () => void } } | null = null;
    const win = makeWin();

    registerSetupEntry({
      mode: 'worker',
      resetBetweenTests: false,
      window: win,
      setup: async () => {
        await setup();
        app = { vueApp: { unmount: () => {} } };
      },
      tryUseApp: () => app,
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFns.push(fn);
      },
    });

    await beforeAllFns[0]!();
    await beforeAllFns[0]!();
    expect(setup).toHaveBeenCalledTimes(1);
  });

  test('fail-before clear + retry', async () => {
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    let app: { vueApp: { unmount: () => void } } | null = null;
    const dispose = vi.fn(async () => {
      app = null;
    });
    const win = makeWin();
    let fail = true;

    registerSetupEntry({
      mode: 'worker',
      resetBetweenTests: false,
      window: win,
      setup: async () => {
        if (fail) {
          fail = false;
          throw new Error('boot boom');
        }
        app = { vueApp: { unmount: () => {} } };
      },
      tryUseApp: () => app,
      dispose,
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFns.push(fn);
      },
    });

    await expect(beforeAllFns[0]!()).rejects.toThrow('boot boom');
    expect(dispose).toHaveBeenCalled();
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();

    await beforeAllFns[0]!();
    expect(app).not.toBeNull();
  });

  test('dispose throws still clears memo on fail', async () => {
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    const win = makeWin();

    registerSetupEntry({
      mode: 'worker',
      resetBetweenTests: false,
      window: win,
      setup: async () => {
        throw new Error('fail');
      },
      tryUseApp: () => ({
        vueApp: {
          unmount: () => {
            throw new Error('unmount boom');
          },
        },
      }),
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFns.push(fn);
      },
    });

    await expect(beforeAllFns[0]!()).rejects.toThrow('fail');
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
  });

  test('reset throw → dispose + clear memo', async () => {
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    const afterEachFns: Array<() => void | Promise<void>> = [];
    let app: { vueApp: { unmount: () => void } } | null = { vueApp: { unmount: () => {} } };
    const dispose = vi.fn(async () => {
      app = null;
    });
    const win = makeWin();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registerSetupEntry({
      mode: 'worker',
      resetBetweenTests: true,
      window: win,
      setup: async () => {},
      tryUseApp: () => app,
      dispose,
      reset: async () => {
        throw new Error('reset boom');
      },
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFns.push(fn);
      },
      afterEach: (fn) => {
        afterEachFns.push(fn);
      },
    });

    await beforeAllFns[0]!();
    await expect(afterEachFns[0]!()).rejects.toThrow(/call restartSharedApp/);
    expect(dispose).toHaveBeenCalled();
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(win.__UNTESTUTILS_NEEDS_RESTART__).toBe(true);
    warn.mockRestore();
  });

  test('file mode remounts every beforeAll', async () => {
    const setup = vi.fn(async () => {});
    const dispose = vi.fn(async () => {});
    const beforeAllFns: Array<() => void | Promise<void>> = [];
    const win = makeWin();

    registerSetupEntry({
      mode: 'file',
      resetBetweenTests: false,
      window: win,
      setup,
      tryUseApp: () => null,
      dispose,
      vi: { resetModules: vi.fn() },
      beforeAll: (fn) => {
        beforeAllFns.push(fn);
      },
    });

    await beforeAllFns[0]!();
    await beforeAllFns[0]!();
    expect(setup).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  test('enabled: false is a no-op', () => {
    const beforeAll = vi.fn();
    registerSetupEntry({
      mode: 'worker',
      resetBetweenTests: false,
      window: makeWin({ __UNTESTUTILS_ENVIRONMENT__: false }),
      setup: async () => {},
      tryUseApp: () => null,
      vi: { resetModules: vi.fn() },
      beforeAll,
      enabled: false,
    });
    expect(beforeAll).not.toHaveBeenCalled();
  });
});

describe('unit-lifecycle disposeBestEffort', () => {
  test('stops scope, unmounts, clears root', async () => {
    const stop = vi.fn();
    const unmount = vi.fn();
    document.body.innerHTML = '<div id="app-root"><span>x</span></div>';
    await disposeBestEffort(
      () => ({
        vueApp: { unmount },
        _scope: { stop },
      }),
      { rootId: 'app-root' },
    );
    expect(stop).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(document.getElementById('app-root')?.innerHTML).toBe('');
  });
});

describe('unit-lifecycle host reset', () => {
  beforeEach(() => {
    localStorage.setItem('k', '1');
    sessionStorage.setItem('s', '2');
    document.cookie = 'tok=abc; path=/';
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  test('clears host by default', () => {
    applyHostResetLayers({ timers: false, stubs: false });
    expect(localStorage.getItem('k')).toBeNull();
    expect(sessionStorage.getItem('s')).toBeNull();
    expect(document.cookie.includes('tok=')).toBe(false);
  });

  test('host: false leaves storage', () => {
    applyHostResetLayers({ host: false, timers: false, stubs: false });
    expect(localStorage.getItem('k')).toBe('1');
  });

  test('clears fake timers by default', () => {
    vi.useFakeTimers();
    applyHostResetLayers({ host: false, stubs: false });
    expect(vi.isFakeTimers()).toBe(false);
  });
});

describe('unit-lifecycle boot counter', () => {
  test('writes only under tmpdir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-boot-'));
    const file = join(dir, 'boots');
    process.env.UNTESTUTILS_BOOT_FILE = file;
    bumpUnitBootCounter();
    bumpUnitBootCounter();
    expect(await readFile(file, 'utf8')).toBe('2');
    delete process.env.UNTESTUTILS_BOOT_FILE;
    await rm(dir, { recursive: true, force: true });
  });

  test('refuses paths outside tmpdir', async () => {
    const outside = join(process.cwd(), `.ut-boot-refuse-${Date.now()}`);
    await writeFile(outside, '0');
    process.env.UNTESTUTILS_BOOT_FILE = outside;
    bumpUnitBootCounter();
    expect(await readFile(outside, 'utf8')).toBe('0');
    delete process.env.UNTESTUTILS_BOOT_FILE;
    await rm(outside, { force: true });
  });
});

describe('unit-lifecycle isolation defaults', () => {
  test('worker auto isolate:false + resetBetweenTests', () => {
    const r = applyWorkerIsolationDefaults({ appIsolation: 'worker' });
    expect(r.isolate).toBe(false);
    expect(r.resetBetweenTests).toBe(true);
  });

  test('worker + isolate:true warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyWorkerIsolationDefaults({ appIsolation: 'worker', userIsolate: true, label: 'fake' });
    applyWorkerIsolationDefaults({ appIsolation: 'worker', userIsolate: true, label: 'fake' });
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(1);
    warn.mockRestore();
  });
});

describe('unit-lifecycle invalidateWorkerSetup', () => {
  test('clears memo keys', () => {
    const win = {
      __UNTESTUTILS_WORKER_SETUP__: Promise.resolve(),
      __UNTESTUTILS_WORKER_RESET_HOOK__: true,
      __UNTESTUTILS_BASELINE_ROUTE__: '/',
      __UNTESTUTILS_BASELINE_BODY__: new Set(),
    } as SetupEntryWindow;
    invalidateWorkerSetup(win);
    expect(win.__UNTESTUTILS_WORKER_SETUP__).toBeUndefined();
    expect(win.__UNTESTUTILS_WORKER_RESET_HOOK__).toBeUndefined();
  });
});
