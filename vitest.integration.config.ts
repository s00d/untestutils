import { defineConfig } from 'vitest/config';
import { resolve } from 'pathe';

export default defineConfig({
  resolve: {
    alias: {
      untestutils: resolve('./src/index.ts'),
    },
  },
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
