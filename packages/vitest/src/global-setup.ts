import { pathToFileURL } from 'node:url';
import type { TestProject } from 'vitest/node';
import {
  ensurePrepared,
  stopAllTargets,
  getRegisteredRecipe,
  listRegisteredRecipes,
  resolveArtifactsRoot,
  TargetRegistry,
  progress,
} from '@untestutils/core';

async function loadRecipesModule(): Promise<void> {
  const mod = process.env.UNTESTUTILS_RECIPES_MODULE;
  if (!mod) return;
  await import(pathToFileURL(mod).href);
}

export default async function globalSetup(_project: TestProject): Promise<() => Promise<void>> {
  await loadRecipesModule();

  const artifactsRoot = resolveArtifactsRoot();
  const prewarm: string[] = JSON.parse(process.env.UNTESTUTILS_PREWARM || '[]') as string[];

  // Prefer recipes export from the module (avoids dual-package Map when entries split)
  let recipesMap: Record<string, import('@untestutils/core').Recipe> | undefined;
  if (process.env.UNTESTUTILS_RECIPES_MODULE) {
    const loaded = (await import(pathToFileURL(process.env.UNTESTUTILS_RECIPES_MODULE).href)) as {
      recipes?: Record<string, import('@untestutils/core').Recipe>;
    };
    recipesMap = loaded.recipes;
  }

  if (prewarm.length) {
    progress.prewarm(prewarm);
    for (const id of prewarm) {
      const recipe = recipesMap?.[id] ?? getRegisteredRecipe(id);
      if (!recipe) {
        throw new Error(
          `[untestutils] prewarm id "${id}" not found. Pass recipesModule to untestutils() and call defineRecipes() in that module.`,
        );
      }
      await ensurePrepared(recipe, { artifactsRoot });
    }
  } else {
    const registry = new TargetRegistry(artifactsRoot);
    const map = await registry.read();
    registry.applyAllToEnv(map);
  }

  void listRegisteredRecipes();

  return async () => {
    progress.teardown();
    await stopAllTargets();
  };
}
