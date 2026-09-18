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
      },
      formats: ['es'],
      fileName: (_f, n) => `${n}.mjs`,
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
      // Externalize every bare specifier; only relative/absolute sources are bundled.
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.includes('\0'),
    },
    minify: false,
  },
  plugins: [dts({ include: ['src/index.ts'], outDirs: ['dist'], entryRoot: 'src' })],
});
