import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

/** Dogfood for restartSharedNuxtApp / hot invalidate (separate from boot-count matrix). */
export default defineVitestProject({
  test: {
    name: 'unit-worker-hot',
    include: ['unit-worker-hot/**/*.{test,spec}.ts'],
    maxWorkers: 1,
    pool: 'threads',
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
