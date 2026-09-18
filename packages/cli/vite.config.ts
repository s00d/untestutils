import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    lib: {
      entry: {
        run: resolve(root, 'src/run.ts'),
        main: resolve(root, 'src/main.ts'),
      },
      formats: ['es'],
      fileName: (_f, n) => `${n}.mjs`,
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        banner: (chunk) => (chunk.name === 'run' ? '#!/usr/bin/env node\n' : ''),
      },
      external: (id) => {
        if (id.startsWith('node:') || id.startsWith('@untestutils/')) return true;
        if (
          [
            'citty',
            'consola',
            'nypm',
            'pathe',
            'tinyglobby',
            'fs',
            'path',
            'url',
            'os',
            'crypto',
            'child_process',
            'module',
            'process',
          ].includes(id)
        ) {
          return true;
        }
        return false;
      },
    },
    minify: false,
  },
  plugins: [dts({ include: ['src'], outDir: 'dist', entryRoot: 'src' })],
});
