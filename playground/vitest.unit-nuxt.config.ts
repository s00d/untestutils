import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

export default defineVitestProject({
  test: {
    name: 'unit-nuxt',
    include: ['unit/**/*.{test,spec}.ts'],
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
      },
    },
  },
});
