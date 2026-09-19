import { defineConfig } from 'vitest/config';
import { resolve } from 'pathe';
import {
  createCoverageConfig,
  UNTESTUTILS_WORKSPACE_PACKAGES,
} from './packages/vitest/src/coverage.ts';

const root = resolve(import.meta.dirname);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@untestutils\/vitest\/(.*)$/,
        replacement: resolve(root, 'packages/vitest/src/$1'),
      },
      { find: '@untestutils/vitest', replacement: resolve(root, 'packages/vitest/src/index.ts') },
      {
        find: /^@untestutils\/playwright\/(.*)$/,
        replacement: resolve(root, 'packages/playwright/src/$1'),
      },
      {
        find: '@untestutils/playwright',
        replacement: resolve(root, 'packages/playwright/src/index.ts'),
      },
      { find: '@untestutils/core', replacement: resolve(root, 'packages/core/src/index.ts') },
      {
        find: /^@untestutils\/nuxt\/(.*)$/,
        replacement: resolve(root, 'packages/nuxt/src/$1'),
      },
      { find: '@untestutils/nuxt', replacement: resolve(root, 'packages/nuxt/src/index.ts') },
      { find: '@untestutils/ai', replacement: resolve(root, 'packages/ai/src/index.ts') },
      { find: '@untestutils/vite', replacement: resolve(root, 'packages/vite/src/index.ts') },
      { find: '@untestutils/next', replacement: resolve(root, 'packages/next/src/index.ts') },
      { find: '@untestutils/astro', replacement: resolve(root, 'packages/astro/src/index.ts') },
      {
        find: '@untestutils/sveltekit',
        replacement: resolve(root, 'packages/sveltekit/src/index.ts'),
      },
      { find: '@untestutils/remix', replacement: resolve(root, 'packages/remix/src/index.ts') },
      {
        find: '@untestutils/solidstart',
        replacement: resolve(root, 'packages/solidstart/src/index.ts'),
      },
      {
        find: '@untestutils/runtime',
        replacement: resolve(root, 'packages/nuxt/src/runtime/index.ts'),
      },
      {
        find: '@untestutils/module',
        replacement: resolve(root, 'packages/nuxt/src/module/index.ts'),
      },
      {
        find: '@untestutils/config',
        replacement: resolve(root, 'packages/nuxt/src/config/index.ts'),
      },
      { find: '@untestutils/cli', replacement: resolve(root, 'packages/cli/src/main.ts') },
      { find: /^untestutils\/(.*)$/, replacement: resolve(root, 'packages/untestutils/src/$1.ts') },
      { find: 'untestutils', replacement: resolve(root, 'packages/untestutils/src/index.ts') },
    ],
  },
  test: {
    name: 'unit',
    include: ['tests/unit/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: ['packages/cli/src/templates/**'],
    environment: 'node',
    testTimeout: 30_000,
    coverage: createCoverageConfig({
      workspacePackages: [...UNTESTUTILS_WORKSPACE_PACKAGES],
      includeEnvironment: true,
      exclude: ['packages/cli/src/templates/**'],
      // Dogfood floor after dropping coverage-pad tests; raise as real suites grow.
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 55 },
    }),
  },
});
