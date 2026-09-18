import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { untestutils } from 'untestutils/vitest/plugin';
import { recipes } from './recipes.ts';

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['staticSite'],
      artifactsRoot: fileURLToPath(new URL('./.untestutils', import.meta.url)),
    }),
  ],
  test: {
    include: ['e2e/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
