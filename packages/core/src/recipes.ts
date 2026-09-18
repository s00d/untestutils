import { fileURLToPath } from 'node:url';
import type { Recipe, RecipeRegistry } from './types';

const globalRecipes = new Map<string, Recipe>();
/** Absolute filesystem path of the module that last called defineRecipes (for Vitest/PW workers). */
let recipesModulePath: string | undefined;

/** Validate a recipe object (does not register). Prefer wrapping with defineRecipes. */
export function defineRecipe(recipe: Recipe): Recipe {
  if (!recipe.id) {
    throw new Error('[untestutils] defineRecipe requires recipe.id');
  }
  if (!recipe.start) {
    throw new Error('[untestutils] defineRecipe requires recipe.start');
  }
  return recipe;
}

/**
 * Register recipes. Optionally pass `import.meta.url` so workers/globalSetup can
 * re-import the same file — otherwise the caller path is inferred from the stack.
 *
 * Prefer: `export const recipes = defineRecipes({ … }, import.meta.url)`
 */
export function defineRecipes<T extends Record<string, Recipe>>(
  recipes: T,
  moduleUrl?: string | URL,
): T & RecipeRegistry {
  rememberRecipesModule(moduleUrl);
  const ids = new Set<string>();
  for (const [key, recipe] of Object.entries(recipes)) {
    const id = recipe.id ?? key;
    if (ids.has(id) || globalRecipes.has(id)) {
      throw new Error(`[untestutils] duplicate recipe id "${id}" in defineRecipes`);
    }
    ids.add(id);
    if (!recipe.id) (recipe as Recipe).id = key;
    if (!recipe.start) {
      throw new Error(`[untestutils] recipe "${id}" requires start()`);
    }
    globalRecipes.set(recipe.id!, recipe);
  }
  return recipes;
}

/**
 * Idempotent register for plugin options: skip ids already registered
 * (typical when recipes.ts already called defineRecipes and config passes the same map).
 */
export function ensureRecipes(recipes: Record<string, Recipe>): void {
  const pending: Record<string, Recipe> = {};
  for (const [key, recipe] of Object.entries(recipes)) {
    const id = recipe.id ?? key;
    if (globalRecipes.has(id)) continue;
    pending[key] = recipe;
  }
  if (Object.keys(pending).length) defineRecipes(pending);
}

/** Absolute path to the recipes source module (for child processes). */
export function getRecipesModulePath(): string | undefined {
  return recipesModulePath;
}

export function getRegisteredRecipe(id: string): Recipe | undefined {
  return globalRecipes.get(id);
}

export function listRegisteredRecipes(): Recipe[] {
  return [...globalRecipes.values()];
}

export function clearRegisteredRecipes(): void {
  globalRecipes.clear();
  recipesModulePath = undefined;
}

function rememberRecipesModule(moduleUrl?: string | URL): void {
  if (moduleUrl) {
    recipesModulePath = toFsPath(moduleUrl);
    return;
  }
  if (recipesModulePath) return;
  const inferred = captureCallerPath();
  if (inferred) recipesModulePath = inferred;
}

function toFsPath(moduleUrl: string | URL): string {
  const href = typeof moduleUrl === 'string' ? moduleUrl : moduleUrl.href;
  return href.startsWith('file:') ? fileURLToPath(href) : href;
}

/** Walk V8 call sites past defineRecipes / this helper to the user module. */
function captureCallerPath(): string | undefined {
  const previous = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_err, stack) => stack;
    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];
    for (let i = 2; i < stack.length; i++) {
      const file = stack[i]?.getFileName();
      if (!file || file.startsWith('node:')) continue;
      if (/[/\\]recipes\.[cm]?[jt]s$/.test(file) && /[/\\](core|@untestutils)[/\\]/.test(file)) {
        continue;
      }
      if (file.includes(`${'node_modules'}/@untestutils/core`)) continue;
      return file.startsWith('file:') ? fileURLToPath(file) : file;
    }
  } catch {
    /* ignore */
  } finally {
    Error.prepareStackTrace = previous;
  }
  return undefined;
}
