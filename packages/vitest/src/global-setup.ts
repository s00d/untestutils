import { pathToFileURL } from 'node:url';
import type { TestProject } from 'vitest/node';
import {
  ensurePrepared,
  stopAllTargets,
  reclaimStaleTargets,
  getRegisteredRecipe,
  listRegisteredRecipes,
  resolveArtifactsRoot,
  TargetRegistry,
  progress,
} from '@untestutils/core';
import { providedContextAugmentation, type UntestutilsProvidedSession } from './provided-context';

void providedContextAugmentation;

async function loadRecipesModule(): Promise<void> {
  const mod = process.env.UNTESTUTILS_RECIPES_MODULE;
  if (!mod) return;
  await import(pathToFileURL(mod).href);
}

function readRegistryUrls(artifactsRoot: string, map: Awaited<ReturnType<TargetRegistry['read']>>) {
  const urls: Record<string, string> = {};
  for (const [id, entry] of Object.entries(map)) {
    if (entry?.url) urls[id] = entry.url;
  }
  void artifactsRoot;
  return urls;
}

export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  await loadRecipesModule();

  const artifactsRoot = resolveArtifactsRoot();
  // Previous vitest forks leave nitro/_dev orphans; kill by registry pid before reuse.
  await reclaimStaleTargets(artifactsRoot);
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
    progress.waveStart(prewarm);
    for (const id of prewarm) {
      const recipe = recipesMap?.[id] ?? getRegisteredRecipe(id);
      if (!recipe) {
        throw new Error(
          `[untestutils] prewarm id "${id}" not found. Pass recipesModule to untestutils() and call defineRecipes() in that module.`,
        );
      }
      await ensurePrepared(recipe, { artifactsRoot });
    }
    progress.waveReady();
    progress.massRun();
  }

  const registry = new TargetRegistry(artifactsRoot);
  const map = await registry.read();
  registry.applyAllToEnv(map);
  const urls = readRegistryUrls(artifactsRoot, map);

  const browsers = JSON.parse(
    process.env.UNTESTUTILS_BROWSERS || '["chromium"]',
  ) as UntestutilsProvidedSession['browsers'];
  const payload: UntestutilsProvidedSession = {
    recipesModule: process.env.UNTESTUTILS_RECIPES_MODULE,
    artifactsRoot,
    session: process.env.UNTESTUTILS_SESSION,
    browsers,
    urls,
  };
  if (typeof project?.provide === 'function') {
    project.provide('untestutils', payload);
  }

  void listRegisteredRecipes();

  return async () => {
    progress.teardown();
    await stopAllTargets(artifactsRoot);
  };
}
