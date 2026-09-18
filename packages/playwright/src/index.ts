import {
  ensureRecipes,
  getRegisteredRecipe,
  getRecipesModulePath,
  ensurePrepared,
  stopAllTargets,
  resolveArtifactsRoot,
  progress,
  type Recipe,
  type RecipeRegistry,
} from '@untestutils/core';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';

export interface PlaywrightHarnessOptions {
  /** Recipe map from `defineRecipes(...)` — import and pass it. */
  recipes?: RecipeRegistry;
  /** Override recipes module path; usually inferred from `defineRecipes`. */
  recipesModule?: string;
  prewarm?: string[];
  artifactsRoot?: string;
}

type PWConfig = Record<string, unknown> & {
  use?: Record<string, unknown>;
  globalSetup?: string;
  globalTeardown?: string;
};

/**
 * Build a Playwright Test config that shares the same recipes.ts as Vitest.
 */
export function createPlaywrightConfig(opts: PlaywrightHarnessOptions & PWConfig): PWConfig {
  const { recipes, recipesModule, prewarm = [], artifactsRoot, ...rest } = opts;
  if (recipes) ensureRecipes(recipes as Record<string, Recipe>);
  if (artifactsRoot) process.env.UNTESTUTILS_ARTIFACTS_DIR = artifactsRoot;
  process.env.UNTESTUTILS_PREWARM = JSON.stringify(prewarm);
  const mod = recipesModule ?? getRecipesModulePath();
  if (mod) process.env.UNTESTUTILS_RECIPES_MODULE = mod;

  return {
    ...rest,
    use: {
      ...(rest.use ?? {}),
    },
    globalSetup: companion('pw-global-setup'),
    globalTeardown: companion('pw-global-teardown'),
  };
}

function companion(name: 'pw-global-setup' | 'pw-global-teardown'): string {
  return resolvePlaywrightCompanion(name);
}

/** @internal */
export const playwrightCompanionIo = {
  createRequire,
  existsSync,
  fileURLToPath,
};

/** @internal */
export function resolvePlaywrightCompanion(name: 'pw-global-setup' | 'pw-global-teardown'): string {
  const req = playwrightCompanionIo.createRequire(join(process.cwd(), 'package.json'));
  for (const id of [`untestutils/playwright/${name}`, `@untestutils/playwright/${name}`]) {
    try {
      return req.resolve(id);
    } catch {
      /* try next */
    }
  }
  try {
    const pkgRoot = dirname(req.resolve('@untestutils/playwright/package.json'));
    const mjs = join(pkgRoot, 'dist', `${name}.mjs`);
    if (playwrightCompanionIo.existsSync(mjs)) return mjs;
    const ts = join(pkgRoot, 'src', `${name}.ts`);
    if (playwrightCompanionIo.existsSync(ts)) return ts;
  } catch {
    /* */
  }
  const here = dirname(playwrightCompanionIo.fileURLToPath(import.meta.url));
  const localTs = join(here, `${name}.ts`);
  if (playwrightCompanionIo.existsSync(localTs)) return localTs;
  throw new Error(`[untestutils/playwright] missing ${name}`);
}

export async function playwrightGlobalSetup(): Promise<void> {
  const modPath = process.env.UNTESTUTILS_RECIPES_MODULE;
  let recipesFromModule: Record<string, Recipe> | undefined;
  if (modPath) {
    const { pathToFileURL } = await import('node:url');
    const loaded = (await import(pathToFileURL(modPath).href)) as {
      recipes?: Record<string, Recipe>;
    };
    recipesFromModule = loaded.recipes;
  }
  const artifactsRoot = resolveArtifactsRoot();
  await stopAllTargets(artifactsRoot);
  const prewarm: string[] = JSON.parse(process.env.UNTESTUTILS_PREWARM || '[]') as string[];
  if (prewarm.length) {
    progress.waveStart(prewarm);
    for (const id of prewarm) {
      const recipe = recipesFromModule?.[id] ?? getRegisteredRecipe(id);
      if (!recipe) {
        throw new Error(
          `[untestutils/playwright] prewarm "${id}" missing — import recipes via defineRecipes(..., import.meta.url)`,
        );
      }
      await ensurePrepared(recipe, { artifactsRoot });
    }
    progress.waveReady();
    progress.massRun();
  }
}

export async function playwrightGlobalTeardown(): Promise<void> {
  progress.teardown();
  await stopAllTargets(resolveArtifactsRoot());
}

export {
  resolvePlaywrightHarnessId,
  resolvePlaywrightBaseURL,
  usePlaywrightHarnessId,
  test,
} from './harness';

export { expect } from '@playwright/test';
export { defineRecipes, useHarness } from '@untestutils/core';
