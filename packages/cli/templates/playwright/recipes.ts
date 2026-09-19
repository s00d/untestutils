import { defineRecipes, staticDir } from 'untestutils';
import { resolve } from 'node:path';

export const recipes = defineRecipes(
  {
    basic: staticDir({
      id: 'basic',
      root: resolve('./fixtures/basic'),
    }),
  },
  import.meta.url,
);
