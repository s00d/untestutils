import { setupNuxt } from './shared/nuxt.mjs';
import { beforeAll, vi } from 'vitest';

if (typeof globalThis !== 'undefined' && globalThis.window?.__NUXT_VITEST_ENVIRONMENT__) {
  vi.resetModules();
  beforeAll(async () => {
    await setupNuxt();
  });
}
