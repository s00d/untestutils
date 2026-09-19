import { defineConfig } from 'vitest/config';
import { untestutils } from 'untestutils/vitest/plugin';
import { recipes } from './recipes.ts';

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      // Prepare on first harness use (worker). Cold Nuxt build inside Vitest
      // globalSetup can exit the main process after nitro — avoid prewarm here.
      browsers: ['chromium'],
      session: 'mass-shared',
    }),
  ],
  test: {
    include: ['e2e/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 300_000,
    fileParallelism: true,
  },
});
