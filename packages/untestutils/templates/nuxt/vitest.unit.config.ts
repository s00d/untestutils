import { fileURLToPath } from 'node:url';
import { defineVitestProject } from 'untestutils/config';

/** In-process Nuxt unit project — separate from e2e harness config. */
export default defineVitestProject({
  test: {
    name: 'unit-nuxt',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        domEnvironment: 'happy-dom',
      },
    },
  },
});
