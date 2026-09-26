import { setupNuxt } from './shared/nuxt';
import {
  registerNuxtSetupEntry,
  resolveAppIsolation,
  tryUseNuxtAppFromUnctx,
  type SetupEntryWindow,
} from './shared/setup-entry';
import { resetSharedNuxtApp } from './shared/reset';
import { enableSharedNuxtHotRestart } from './shared/restart';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Virtual module injected by `untestutils:vitest:environment-options` Vite plugin.
import environmentOptions from 'untestutils-vitest-environment-options';

const win = globalThis.window as SetupEntryWindow | undefined;

if (typeof globalThis !== 'undefined' && win?.__NUXT_VITEST_ENVIRONMENT__) {
  const { mode, resetBetweenTests } = resolveAppIsolation(
    environmentOptions as {
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
    vi,
    beforeAll,
    afterEach,
    beforeEach,
  });

  if (mode === 'worker') enableSharedNuxtHotRestart(win);
}
