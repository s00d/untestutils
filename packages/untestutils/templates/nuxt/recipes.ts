import { defineRecipes } from 'untestutils';
import { nuxt } from 'untestutils/nuxt';
import { resolve } from 'node:path';

/** root — Nuxt app directory (e.g. playground or fixtures/nuxt). */
export const recipes = defineRecipes(
  {
    app: nuxt({
      id: 'app',
      root: resolve('./fixtures/nuxt'),
    }),
  },
  import.meta.url,
);
