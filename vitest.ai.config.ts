import { defineConfig } from 'vitest/config';
import { resolve } from 'pathe';

export default defineConfig({
  resolve: {
    alias: {
      'untestutils/ai': resolve('./src/ai/index.ts'),
      untestutils: resolve('./src/index.ts'),
    },
  },
  test: {
    name: 'ai',
    include: ['tests/ai/**/*.test.ts'],
    environment: 'node',
  },
});
