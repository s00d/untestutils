import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDirs: ['dist'],
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: {
        index: resolve(root, 'src/index.ts'),
        plugin: resolve(root, 'src/plugin.ts'),
        'global-setup': resolve(root, 'src/global-setup.ts'),
        'setup-file': resolve(root, 'src/setup-file.ts'),
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
        if (id.startsWith('node:') || id.startsWith('@untestutils/') || id.startsWith('@ai-sdk/'))
          return true;
        if (
          [
            'ofetch',
            'pathe',
            'vitest',
            'vitest/node',
            '@playwright/test',
            'playwright-core',
            'ai',
            'fs',
            'path',
            'url',
            'os',
            'crypto',
            'child_process',
            'http',
            'module',
            'async_hooks',
          ].includes(id)
        )
          return true;
        return false;
      },
    },
    minify: false,
  },
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/**/*.test-d.ts'],
      outDirs: ['dist'],
      entryRoot: 'src',
    }),
  ],
});
