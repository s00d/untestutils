import { defineConfig, type Plugin } from 'vite';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...parts: string[]) => resolve(root, ...parts);

const workspacePkgs = [
  '@untestutils/core',
  '@untestutils/drivers',
  '@untestutils/utils',
  '@untestutils/perf',
  '@untestutils/vitest',
  '@untestutils/playwright',
  '@untestutils/nuxt',
  '@untestutils/vite',
  '@untestutils/next',
  '@untestutils/astro',
  '@untestutils/sveltekit',
  '@untestutils/remix',
  '@untestutils/solidstart',
  '@untestutils/ai',
  '@untestutils/runtime',
  '@untestutils/module',
  '@untestutils/config',
] as const;

/** Typed public entries (runtime .mjs / CLI bin skip declarations). */
const dtsEntries: Record<string, string> = {
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
  module: p('src/module.ts'),
  config: p('src/config.ts'),
  ai: p('src/ai.ts'),
};

const aliases = [
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
  { find: '@untestutils/remix', replacement: p('../remix/src/index.ts') },
  { find: '@untestutils/solidstart', replacement: p('../solidstart/src/index.ts') },
  { find: '@untestutils/utils', replacement: p('../utils/src/index.ts') },
  { find: '@untestutils/perf', replacement: p('../perf/src/index.ts') },
  { find: '@untestutils/ai', replacement: p('../ai/src/index.ts') },
  { find: '@untestutils/runtime', replacement: p('../runtime/src/index.ts') },
  { find: '@untestutils/module', replacement: p('../module/src/index.ts') },
  { find: '@untestutils/config', replacement: p('../config/src/index.ts') },
  { find: '@untestutils/cli', replacement: p('../cli/src/main.ts') },
];

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

/**
 * Bundle public .d.ts via rollup-plugin-dts (project TypeScript / TS6).
 * Replaces @microsoft/api-extractor which pins TS5.9 and OOMs on this facade.
 */
function emitDts(): Plugin {
  return {
    name: 'untestutils:emit-dts',
    async closeBundle() {
      for (const [name, input] of Object.entries(dtsEntries)) {
        const bundle = await rollup({
          input,
          plugins: [
            dts({
              tsconfig: p('tsconfig.build.json'),
              respectExternal: true,
              includeExternal: [...workspacePkgs],
            }),
          ],
          external: (id) => {
            if (workspacePkgs.some((pkg) => id === pkg || id.startsWith(`${pkg}/`))) return false;
            if (id.startsWith('\0') || id.startsWith('.') || id.startsWith('/')) return false;
            if (id.startsWith('#') || id.startsWith('node:') || id.startsWith('@nuxt/')) return true;
            if (id.startsWith('@ai-sdk/')) return true;
            return /^[@a-zA-Z]/.test(id);
          },
          onwarn(warning, warn) {
            if (warning.code === 'UNRESOLVED_IMPORT' || warning.code === 'EMPTY_BUNDLE') return;
            warn(warning);
          },
        });
        await bundle.write({
          file: p('dist', `${name}.d.ts`),
          format: 'es',
        });
        await bundle.close();
      }
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
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        banner: (chunk) => (chunk.name === 'cli-run' ? '#!/usr/bin/env node\n' : ''),
      },
    },
    minify: false,
  },
  plugins: [emitDts(), copyCliTemplates()],
  resolve: {
    alias: aliases,
  },
});
