/**
 * Runs in each Vitest worker before specs load.
 * Loads recipes module + applies TargetRegistry URLs to process.env.
 */
import { pathToFileURL } from 'node:url';
import { resolveArtifactsRoot, TargetRegistry } from '@untestutils/core';

/** @internal */
export async function applyWorkerSetup(): Promise<void> {
  const recipesModule = process.env.UNTESTUTILS_RECIPES_MODULE;
  if (recipesModule) {
    await import(pathToFileURL(recipesModule).href);
  }

  const artifactsRoot = resolveArtifactsRoot();
  const registry = new TargetRegistry(artifactsRoot);
  const map = await registry.read();
  registry.applyAllToEnv(map);
}

await applyWorkerSetup();
