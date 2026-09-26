import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { untestutils } from 'untestutils/vitest/plugin';
import { recipes } from './recipes.ts';

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['staticSite'],
      browsers: ['chromium'],
      artifactsRoot: fileURLToPath(new URL('./.untestutils', import.meta.url)),
    }),
  ],
  test: {
    include: ['e2e/**/*.spec.ts'],
    testTimeout: 180_000,
    hookTimeout: 240_000,
    // Shared fixture roots (next/solid) race if two prepares write the same cwd.
    fileParallelism: false,
  },
});
