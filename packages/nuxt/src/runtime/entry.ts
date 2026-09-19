import { setupNuxt } from './shared/nuxt';
import { beforeAll, vi } from 'vitest';

const win = globalThis.window as (Window & { __NUXT_VITEST_ENVIRONMENT__?: boolean }) | undefined;
if (typeof globalThis !== 'undefined' && win?.__NUXT_VITEST_ENVIRONMENT__) {
  vi.resetModules();
  beforeAll(async () => {
    await setupNuxt();
  });
}
