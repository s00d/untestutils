/**
 * Example: `matrix()` for Nuxt (nitro-aware) and other frameworks (generic).
 * Not wired into playground e2e prewarm — import when you need the pattern.
 *
 *   import { recipes } from './examples/matrix-recipes.ts'
 */
import { defineRecipes } from 'untestutils';
import { matrix as nuxtMatrix } from 'untestutils/nuxt';
import { matrix as viteMatrix } from 'untestutils/vite';
import { matrix as nextMatrix } from 'untestutils/next';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));
const unitApp = join(root, '../fixtures/unit-app');
const viteSpa = join(root, '../fixtures/vite-spa');
const nextApp = join(root, '../fixtures/next-app');

export const recipes = defineRecipes(
  {
    ...nuxtMatrix(
      {
        id: 'unitApp',
        root: unitApp,
        run: 'server',
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
    ...viteMatrix(
      { id: 'viteSpa', root: viteSpa, run: 'preview' },
      {
        default: { env: { FIXTURE: 'a' } },
        alt: {
          env: { FIXTURE: 'b' },
          viteConfig: { define: { __UT_FIXTURE__: JSON.stringify('b') } },
        },
      },
    ),
    ...nextMatrix(
      { id: 'nextStatic', root: nextApp, run: 'static' },
      {
        default: {},
        previewEnv: {
          env: { NEXT_PUBLIC_MARK: '1' },
          nextConfig: { env: { UT_MARK: '1' } },
        },
      },
    ),
  },
  import.meta.url,
);
