import { defineConfig } from 'vitest/config';
import { untestutils } from 'untestutils/vitest/plugin';
import { recipes } from './recipes';

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['basic'],
    }),
  ],
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
