import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

export default defineVitestProject({
  test: {
    name: 'unit-worker-file-no-isolate',
    include: ['unit-worker/**/*.{test,spec}.ts'],
    maxWorkers: 1,
    isolate: false,
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
        appIsolation: 'file',
      },
    },
  },
});
