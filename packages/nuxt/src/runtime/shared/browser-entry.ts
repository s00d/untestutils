import { setupNuxt } from './nuxt';
import { setupWindow, type EnvironmentOptions } from './environment';
import {
  registerNuxtSetupEntry,
  resolveAppIsolation,
  tryUseNuxtAppFromUnctx,
  type SetupEntryWindow,
} from './setup-entry';
import { resetSharedNuxtApp } from './reset';
import { enableSharedNuxtHotRestart } from './restart';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

/**
 * Vitest Browser Mode boot (nuxt/test-utils#1821 shape + worker-aware register).
 */
export async function runBrowserNuxtEntry(
  win: SetupEntryWindow,
  options: EnvironmentOptions,
  hooks: {
    beforeAll: typeof beforeAll;
    afterEach: typeof afterEach;
    beforeEach?: typeof beforeEach;
    vi: { resetModules: () => void };
  } = { beforeAll, afterEach, beforeEach, vi },
): Promise<void> {
  if (!win) return;

  win.__NUXT_VITEST_ENVIRONMENT_BROWSER_ENTRY__ = true;

  if (!win.__NUXT_VITEST_ENVIRONMENT__) {
    await setupWindow(win as Parameters<typeof setupWindow>[0], options);
  }

  const { mode, resetBetweenTests } = resolveAppIsolation(
    options as {
      nuxt?: { appIsolation?: 'file' | 'worker'; resetBetweenTests?: boolean };
    },
    win,
  );

  registerNuxtSetupEntry({
    mode,
    resetBetweenTests,
    window: win,
    setupNuxt,
    tryUseNuxtApp: tryUseNuxtAppFromUnctx,
    resetSharedNuxtApp,
    vi: hooks.vi,
    beforeAll: hooks.beforeAll,
    afterEach: hooks.afterEach,
    beforeEach: hooks.beforeEach,
    fromBrowserEntry: true,
  });

  if (mode === 'worker') enableSharedNuxtHotRestart(win);
}
