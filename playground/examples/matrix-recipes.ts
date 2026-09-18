/**
 * Example: expand one Nuxt fixture into many recipe ids (i18n-style variants).
 * Not wired into playground e2e prewarm — import when you need the pattern.
 *
 *   import { recipes } from './examples/matrix-recipes.ts'
 */
import { defineRecipes } from 'untestutils';
import { matrix } from 'untestutils/nuxt';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));
const unitApp = join(root, '../fixtures/unit-app');

export const recipes = defineRecipes(
  {
    ...matrix(
      {
        id: 'unitApp',
        root: unitApp,
        run: 'server',
        // Default Nitro Node server (explicit for docs / dogfood).
        preset: 'node-server',
      },
      {
        default: { env: { STRATEGY: 'prefix' } },
        noSsr: {
          env: { STRATEGY: 'prefix' },
          nuxtConfig: { ssr: false },
        },
      },
    ),
  },
  import.meta.url,
);
