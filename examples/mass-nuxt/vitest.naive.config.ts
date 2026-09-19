import { defineConfig } from 'vitest/config';
import { untestutils } from 'untestutils/vitest/plugin';
import { naiveRecipes } from './recipes.ts';

/**
 * Ordinary baseline: each of 10 files has its own Nuxt recipe id → own prepare/start.
 * Same browser scenarios as vitest.config.ts — measured wall time for the docs demo.
 */
export default defineConfig({
  plugins: [
    untestutils({
      recipes: naiveRecipes,
      browsers: ['chromium'],
      session: 'mass-naive',
    }),
  ],
  test: {
    include: ['e2e-naive/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
