import { defineRecipes, staticDir } from 'untestutils';
import { resolve } from 'node:path';

/** Replace root with your fixture app path (static folder or Nuxt). */
export const recipes = defineRecipes(
  {
    basic: staticDir({
      id: 'basic',
      root: resolve('./fixtures/basic'),
    }),
  },
  import.meta.url,
);
