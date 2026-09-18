import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...parts: string[]) => resolve(root, ...parts);

/** Bundle private packages into the published facade. */
export default defineConfig({
  build: {
    outDirs: ['dist'],
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: {
        index: p('src/index.ts'),
        vitest: p('../vitest/src/index.ts'),
        'vitest-plugin': p('../vitest/src/plugin.ts'),
        'vitest-global-setup': p('../vitest/src/global-setup.ts'),
        'vitest-setup-file': p('../vitest/src/setup-file.ts'),
        playwright: p('../playwright/src/index.ts'),
        'playwright-pw-global-setup': p('../playwright/src/pw-global-setup.ts'),
        'playwright-pw-global-teardown': p('../playwright/src/pw-global-teardown.ts'),
        nuxt: p('../nuxt/src/index.ts'),
        vite: p('../vite/src/index.ts'),
        next: p('../next/src/index.ts'),
        astro: p('../astro/src/index.ts'),
        sveltekit: p('../sveltekit/src/index.ts'),
        utils: p('../utils/src/index.ts'),
        perf: p('../perf/src/index.ts'),
        command: p('../drivers/src/command.ts'),
        runtime: p('../runtime/src/index.ts'),
        module: p('../module/src/index.ts'),
        config: p('../config/src/index.ts'),
        ai: p('../ai/src/index.ts'),
        'cli-run': p('../cli/src/run.ts'),
      },
      formats: ['es'],
      fileName: (_f, n) => `${n}.mjs`,
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith('@untestutils/')) return false;
        if (id.startsWith('node:') || id.startsWith('@ai-sdk/')) return true;
        return [
          'ofetch',
          'pathe',
          'defu',
          'destr',
          'std-env',
          'ufo',
          'citty',
          'consola',
          'nypm',
          'tinyglobby',
          'vitest',
          'vitest/node',
          '@playwright/test',
          'playwright-core',
          'ai',
          'autocannon',
          'artillery',
          'fs',
          'path',
          'url',
          'os',
          'crypto',
          'child_process',
          'http',
          'module',
          'async_hooks',
        ].includes(id);
      },
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        banner: (chunk) => (chunk.name === 'cli-run' ? '#!/usr/bin/env node\n' : ''),
      },
    },
    minify: false,
  },
  plugins: [],
  resolve: {
    alias: [
      { find: /^@untestutils\/vitest\/(.*)$/, replacement: p('../vitest/src/$1') },
      { find: '@untestutils/vitest', replacement: p('../vitest/src/index.ts') },
      { find: /^@untestutils\/playwright\/(.*)$/, replacement: p('../playwright/src/$1') },
      { find: '@untestutils/playwright', replacement: p('../playwright/src/index.ts') },
      { find: '@untestutils/core', replacement: p('../core/src/index.ts') },
      { find: '@untestutils/drivers', replacement: p('../drivers/src/index.ts') },
      { find: '@untestutils/nuxt', replacement: p('../nuxt/src/index.ts') },
      { find: '@untestutils/vite', replacement: p('../vite/src/index.ts') },
      { find: '@untestutils/next', replacement: p('../next/src/index.ts') },
      { find: '@untestutils/astro', replacement: p('../astro/src/index.ts') },
      { find: '@untestutils/sveltekit', replacement: p('../sveltekit/src/index.ts') },
      { find: '@untestutils/utils', replacement: p('../utils/src/index.ts') },
      { find: '@untestutils/perf', replacement: p('../perf/src/index.ts') },
      { find: '@untestutils/ai', replacement: p('../ai/src/index.ts') },
      { find: '@untestutils/runtime', replacement: p('../runtime/src/index.ts') },
      { find: '@untestutils/module', replacement: p('../module/src/index.ts') },
      { find: '@untestutils/config', replacement: p('../config/src/index.ts') },
      { find: '@untestutils/cli', replacement: p('../cli/src/main.ts') },
    ],
  },
});
