import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'types',
    include: ['tests/types/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['tests/types/**/*.test.ts'],
      // don't typecheck package vite configs (vite-plugin-dts option drift)
      ignoreSourceErrors: true,
    },
  },
});
