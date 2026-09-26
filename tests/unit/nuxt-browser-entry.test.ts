import { describe, expect, test, vi } from 'vitest';
import { runBrowserNuxtEntry } from '../../packages/nuxt/src/runtime/shared/browser-entry';
import type { SetupEntryWindow } from '../../packages/nuxt/src/runtime/shared/setup-entry';

vi.mock('../../packages/nuxt/src/runtime/shared/environment', () => ({
  setupWindow: vi.fn(async (win: SetupEntryWindow) => {
    win.__NUXT_VITEST_ENVIRONMENT__ = true;
  }),
}));

vi.mock('../../packages/nuxt/src/runtime/shared/nuxt', () => ({
  setupNuxt: vi.fn(async () => {}),
}));

vi.mock('../../packages/nuxt/src/runtime/shared/reset', () => ({
  resetSharedNuxtApp: vi.fn(async () => {}),
}));

vi.mock('../../packages/nuxt/src/runtime/shared/restart', () => ({
  enableSharedNuxtHotRestart: vi.fn(),
}));

describe('runBrowserNuxtEntry', () => {
  test('sets browser flag, prepares window, registers with fromBrowserEntry', async () => {
    const { setupWindow } = await import('../../packages/nuxt/src/runtime/shared/environment');
    const win = {
      __NUXT_VITEST_ENVIRONMENT__: false,
    } as SetupEntryWindow;
    const beforeAll = vi.fn();
    const afterEach = vi.fn();
    const resetModules = vi.fn();

    await runBrowserNuxtEntry(win, { nuxt: { appIsolation: 'file' } } as never, {
      beforeAll,
      afterEach,
      vi: { resetModules },
    });

    expect(win.__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__).toBe(true);
    expect(setupWindow).toHaveBeenCalledTimes(1);
    expect(beforeAll).toHaveBeenCalledTimes(1);
  });

  test('skips setupWindow when environment already prepared', async () => {
    const { setupWindow } = await import('../../packages/nuxt/src/runtime/shared/environment');
    vi.mocked(setupWindow).mockClear();
    const win = {
      __NUXT_VITEST_ENVIRONMENT__: true,
    } as SetupEntryWindow;

    await runBrowserNuxtEntry(win, { nuxt: {} } as never, {
      beforeAll: vi.fn(),
      afterEach: vi.fn(),
      vi: { resetModules: vi.fn() },
    });

    expect(setupWindow).not.toHaveBeenCalled();
  });
});
