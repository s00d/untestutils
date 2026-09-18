import { fileURLToPath } from 'node:url'
import { defineVitestProject } from 'untestutils/config'

/**
 * Server-side unit project — enables nitroEnvironment so handlers can be
 * exercised in-process (pain-point #531).
 */
export default defineVitestProject({
  test: {
    name: 'unit-nuxt-server',
    include: ['unit-server/**/*.{test,spec}.ts'],
    environmentOptions: {
      nuxt: {
        rootDir: fileURLToPath(new URL('./fixtures/unit-app', import.meta.url)),
        domEnvironment: 'happy-dom',
        nitroEnvironment: true,
      },
    },
  },
})
