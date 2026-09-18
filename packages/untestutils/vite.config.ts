import { defineConfig, type Plugin } from 'vite';
import { dts } from 'rolldown-plugin-dts';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...parts: string[]) => resolve(root, ...parts);

const aliases = {
  '@untestutils/vitest': p('../vitest/src/index.ts'),
  '@untestutils/playwright': p('../playwright/src/index.ts'),
  '@untestutils/core': p('../core/src/index.ts'),
  '@untestutils/drivers': p('../drivers/src/index.ts'),
  '@untestutils/nuxt': p('../nuxt/src/index.ts'),
  '@untestutils/vite': p('../vite/src/index.ts'),
  '@untestutils/next': p('../next/src/index.ts'),
  '@untestutils/astro': p('../astro/src/index.ts'),
  '@untestutils/sveltekit': p('../sveltekit/src/index.ts'),
  '@untestutils/remix': p('../remix/src/index.ts'),
  '@untestutils/solidstart': p('../solidstart/src/index.ts'),
  '@untestutils/utils': p('../utils/src/index.ts'),
  '@untestutils/perf': p('../perf/src/index.ts'),
  '@untestutils/ai': p('../ai/src/index.ts'),
  '@untestutils/runtime': p('../runtime/src/index.ts'),
  '@untestutils/module': p('../module/src/index.ts'),
  '@untestutils/config': p('../config/src/index.ts'),
  '@untestutils/cli': p('../cli/src/main.ts'),
};

function copyCliTemplates(): Plugin {
  return {
    name: 'untestutils:copy-cli-templates',
    closeBundle() {
      const src = p('../cli/src/templates');
      const dest = p('templates');
      if (!existsSync(src)) return;
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    },
  };
}

/** Bundle private workspace packages into the published facade. */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: {
        index: p('src/index.ts'),
        vitest: p('src/vitest.ts'),
        'vitest-plugin': p('src/vitest-plugin.ts'),
        'vitest-global-setup': p('src/vitest-global-setup.ts'),
        'vitest-setup-file': p('src/vitest-setup-file.ts'),
        playwright: p('src/playwright.ts'),
        'playwright-pw-global-setup': p('src/playwright-pw-global-setup.ts'),
        'playwright-pw-global-teardown': p('src/playwright-pw-global-teardown.ts'),
        nuxt: p('src/nuxt.ts'),
        vite: p('src/vite.ts'),
        next: p('src/next.ts'),
        astro: p('src/astro.ts'),
        sveltekit: p('src/sveltekit.ts'),
        remix: p('src/remix.ts'),
        solidstart: p('src/solidstart.ts'),
        utils: p('src/utils.ts'),
        perf: p('src/perf.ts'),
        command: p('src/command.ts'),
        runtime: p('src/runtime.ts'),
        'runtime-entry': p('../runtime/src/entry.mjs'),
        'runtime-browser-entry': p('../runtime/src/browser-entry.ts'),
        'runtime-nuxt-root': p('../runtime/src/nuxt-root.mjs'),
        'runtime-mocks-vue-devtools': p('../runtime/src/mocks/vue-devtools.mjs'),
        'vitest-environment': p('../vitest-environment-untestutils/index.mjs'),
        module: p('src/module.ts'),
        config: p('src/config.ts'),
        ai: p('src/ai.ts'),
        'cli-run': p('../cli/src/run.ts'),
      },
      formats: ['es'],
      fileName: (_f, n) => `${n}.mjs`,
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith('@untestutils/')) return false;
        if (id.startsWith('#') || id.startsWith('@nuxt/')) return true;
        if (id.startsWith('node:') || id.startsWith('@ai-sdk/')) return true;
        const exact = new Set([
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
          'vue',
          '@vue/test-utils',
          '@testing-library/vue',
          'happy-dom',
          'jsdom',
          'h3',
          'h3-next',
          'c12',
          'exsolve',
          'local-pkg',
          'scule',
          'unplugin',
          'estree-walker',
          'magic-string',
          'fake-indexeddb',
          'radix3',
          'node-mock-http',
          'node-fetch-native',
          'vitest',
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
        ]);
        if (exact.has(id)) return true;
        for (const pkg of exact) {
          if (id.startsWith(`${pkg}/`)) return true;
        }
        return false;
      },
      output: {
        // DTS chunks must use a .js template — rolldown-plugin-dts rewrites to .d.ts.
        entryFileNames: (chunk) => (chunk.name.endsWith('.d') ? '[name].js' : '[name].mjs'),
        chunkFileNames: (chunk) =>
          chunk.name.endsWith('.d') ? 'chunks/[name]-[hash].js' : 'chunks/[name]-[hash].mjs',
        banner: (chunk) => (chunk.name === 'cli-run' ? '#!/usr/bin/env node\n' : ''),
      },
    },
    minify: false,
  },
  // Keep JS excluded — oxc.exclude replaces Vite defaults.
  oxc: {
    exclude: [/\.js$/, /\.d\.[cm]?ts$/],
  },
  plugins: [
    dts({
      // Only facade src entries; skip runtime .mjs / CLI.
      entry: ['src/*.ts'],
      tsconfig: './tsconfig.build.json',
      generator: 'tsc',
      resolver: 'tsc',
    }),
    copyCliTemplates(),
  ],
  resolve: {
    alias: [
      { find: /^@untestutils\/vitest\/(.*)$/, replacement: p('../vitest/src/$1') },
      { find: /^@untestutils\/playwright\/(.*)$/, replacement: p('../playwright/src/$1') },
      ...Object.entries(aliases).map(([find, replacement]) => ({ find, replacement })),
    ],
  },
});
