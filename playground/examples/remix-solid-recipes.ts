/**
 * Example recipes for Remix / SolidStart (install fixture deps first).
 *
 *   import { recipes } from './examples/remix-solid-recipes.ts'
 */
import { defineRecipes } from 'untestutils';
import { remix } from 'untestutils/remix';
import { solidstart } from 'untestutils/solidstart';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

const root = dirname(fileURLToPath(import.meta.url));

export const recipes = defineRecipes({
  remixApp: remix({
    id: 'remixApp',
    root: join(root, '../fixtures/remix-app'),
    run: 'server',
  }),
  solidApp: solidstart({
    id: 'solidApp',
    root: join(root, '../fixtures/solid-app'),
    run: 'preview',
  }),
}, import.meta.url);
