/**
 * Runs in each Vitest worker before specs load.
 * Loads recipes module + applies TargetRegistry URLs to process.env.
 * Prefers Vitest `inject('untestutils')` when available; env remains fallback.
 */
import { pathToFileURL } from 'node:url';
import { envKey, resolveArtifactsRoot, TargetRegistry } from '@untestutils/core';
import { providedContextAugmentation, type UntestutilsProvidedSession } from './provided-context';

void providedContextAugmentation;

async function tryInjectSession(): Promise<UntestutilsProvidedSession | undefined> {
  try {
    const { inject } = await import('vitest');
    return inject('untestutils');
  } catch {
    return undefined;
  }
}

/** Apply provided recipe URLs into process.env when keys are missing. */
export function applySessionUrls(urls: Record<string, string>): void {
  for (const [id, url] of Object.entries(urls)) {
    const key = envKey(id);
    if (!process.env[key]) process.env[key] = url;
  }
}

/** @internal */
export async function applyWorkerSetup(
  sessionOverride?: UntestutilsProvidedSession,
): Promise<void> {
  const session = sessionOverride ?? (await tryInjectSession());
  const recipesModule = session?.recipesModule ?? process.env.UNTESTUTILS_RECIPES_MODULE;
  if (recipesModule) {
    await import(pathToFileURL(recipesModule).href);
    if (!process.env.UNTESTUTILS_RECIPES_MODULE) {
      process.env.UNTESTUTILS_RECIPES_MODULE = recipesModule;
    }
  }

  const artifactsRoot = session?.artifactsRoot ?? resolveArtifactsRoot();
  if (session?.artifactsRoot && !process.env.UNTESTUTILS_ARTIFACTS_DIR) {
    process.env.UNTESTUTILS_ARTIFACTS_DIR = session.artifactsRoot;
  }

  const registry = new TargetRegistry(artifactsRoot);
  const map = await registry.read();
  registry.applyAllToEnv(map);

  if (session?.urls) applySessionUrls(session.urls);
}

await applyWorkerSetup();
