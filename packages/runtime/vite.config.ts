import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync, copyFileSync, mkdirSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Ship the Nuxt-virtual runtime files (`suspended`, `nuxt-root`, `entry`,
 * `shared/*`, `mocks/*`) verbatim. They contain `#imports` / `#build` virtual
 * imports that must stay untouched so Nuxt can resolve them inside the test
 * environment; bundling them would break resolution.
 */
function copyRuntimeFiles(): Plugin {
  return {
    name: 'untestutils:copy-runtime-files',
    closeBundle() {
      const dist = join(root, 'dist');
      mkdirSync(dist, { recursive: true });
      for (const file of ['suspended.mjs', 'nuxt-root.mjs', 'entry.mjs']) {
        copyFileSync(join(root, 'src', file), join(dist, file));
      }
      cpSync(join(root, 'src/shared'), join(dist, 'shared'), { recursive: true });
      cpSync(join(root, 'src/mocks'), join(dist, 'mocks'), { recursive: true });
    },
  };
}

const externalModules = new Set([
  'vue',
  '@vue/test-utils',
  '@testing-library/vue',
  './suspended.mjs',
  'ofetch',
  'pathe',
  'vitest',
  'vitest/node',
]);

export default defineConfig({
  build: {
    outDirs: ['dist'],
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: {
        index: resolve(root, 'src/index.ts'),
      },
      formats: ['es'],
      fileName: (_f, n) => `${n}.mjs`,
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
      external: (id) => {
        if (id.startsWith('node:') || id.startsWith('@untestutils/')) return true;
        if (id.startsWith('#')) return true;
        return externalModules.has(id);
      },
    },
    minify: false,
  },
  plugins: [
    dts({ include: ['src/index.ts'], outDirs: ['dist'], entryRoot: 'src' }),
    copyRuntimeFiles(),
  ],
});
