import { defineConfig } from 'vitest/config';
import { untestutils } from 'untestutils/vitest/plugin';
import { recipes } from './recipes';

/**
 * E2e harness project. Keep unit Nuxt env in a *separate* Vitest config
 * (see vitest.unit.config.ts) — do not mix `untestutils()` plugin with
 * `environment: 'untestutils'` in one project.
 */
export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['app'],
    }),
  ],
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
