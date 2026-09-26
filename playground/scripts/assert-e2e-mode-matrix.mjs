#!/usr/bin/env node
/**
 * Ensures every E2E_MODE_MARKERS id has a matching recipe and an e2e spec
 * that references the recipe id as a string literal.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const playground = fileURLToPath(new URL('..', import.meta.url));
const { E2E_MODE_MARKERS, recipes } = await import(
  pathToFileURL(join(playground, 'recipes.ts')).href
);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.spec\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const specs = walk(join(playground, 'e2e'));
const specText = specs.map((f) => readFileSync(f, 'utf8')).join('\n');
const recipeIds = Object.keys(recipes).filter((id) => id !== 'remote');

const missingRecipes = [];
const missingSpecs = [];
for (const id of Object.keys(E2E_MODE_MARKERS)) {
  if (!recipeIds.includes(id)) missingRecipes.push(id);
  if (!specText.includes(`'${id}'`) && !specText.includes(`"${id}"`)) missingSpecs.push(id);
}

if (missingRecipes.length || missingSpecs.length) {
  console.error(JSON.stringify({ missingRecipes, missingSpecs }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      modes: Object.keys(E2E_MODE_MARKERS).length,
      recipes: recipeIds.length,
      specs: specs.length,
    },
    null,
    2,
  ),
);
