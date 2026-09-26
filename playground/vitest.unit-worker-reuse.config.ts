import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

export default defineVitestProject({
  test: {
    name: 'unit-worker-reuse',
    include: ['unit-worker/**/*.{test,spec}.ts'],
    maxWorkers: 1,
    pool: 'threads',
    sequence: { shuffle: true },
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
        appIsolation: 'worker',
        resetBetweenTests: true,
      },
    },
  },
});
