import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

export default defineVitestProject({
  test: {
    name: 'unit-bench-file',
    include: ['unit-bench/**/*.{test,spec}.ts'],
    maxWorkers: 1,
    pool: 'threads',
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
        appIsolation: 'file',
      },
    },
  },
});
