import { defineRecipes } from 'untestutils';
import { nuxt } from 'untestutils/nuxt';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const appRoot = join(root, 'fixtures/app');

/** Shared prepare: one recipe id for all files. */
export const recipes = defineRecipes(
  {
    app: nuxt({
      id: 'app',
      root: appRoot,
      run: 'server',
    }),
  },
  import.meta.url,
);

/** Naive prepare: one recipe identity per spec file (ordinary per-file boot). */
const naiveEntries = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    const id = `app${n}`;
    return [
      id,
      nuxt({
        id,
        root: appRoot,
        run: 'server',
      }),
    ];
  }),
);

export const naiveRecipes = defineRecipes(naiveEntries, import.meta.url);
