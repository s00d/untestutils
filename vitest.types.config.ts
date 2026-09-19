import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'types',
    include: ['tests/types/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test.ts'],
      // ignore ambient errors from consumer-facing type fixtures
      ignoreSourceErrors: true,
    },
  },
});
