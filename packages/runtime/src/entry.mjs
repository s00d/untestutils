import { setupNuxt } from './shared/nuxt.mjs';
import { beforeAll, vi } from 'vitest';

//#region src/runtime/entry.ts
if (typeof window !== 'undefined' && window.__NUXT_VITEST_ENVIRONMENT__) {
  vi.resetModules();
  beforeAll(async () => {
    await setupNuxt();
  });
}
//#endregion
