import { test as base } from '@playwright/test';
import {
  ensurePrepared,
  getRegisteredRecipe,
  listRegisteredRecipes,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  envKey,
  TargetRegistry,
  type Recipe,
} from '@untestutils/core';

function formatKnownIds(): string {
  const known = listRegisteredRecipes()
    .map((r) => r.id)
    .filter(Boolean)
    .sort();
  return known.length ? ` Known ids: ${known.join(', ')}.` : '';
}

/**
 * Prepare (or reuse) the harness and ensure `UNTESTUTILS_HOST_*` is set in
 * *this* worker process. Cross-process reuse only writes `targets.json`;
 * workers must apply env locally before reading `baseURL`.
 */
export async function resolvePlaywrightHarnessId(harness: string | Recipe): Promise<string> {
  const id = typeof harness === 'string' ? harness : harness.id;
  if (!id) throw new Error('[untestutils/playwright] test.use({ harness }) required');
  const recipe = typeof harness === 'string' ? getRegisteredRecipe(harness) : harness;
  if (!recipe) {
    throw new Error(`[untestutils/playwright] unknown harness "${id}".${formatKnownIds()}`);
  }
  const artifactsRoot = resolveArtifactsRoot();
  const prepared = await ensurePrepared(recipe, { artifactsRoot });
  const runningUrl = 'url' in prepared.running ? prepared.running.url : undefined;
  if (runningUrl) {
    process.env[envKey(id)] = normalizeBaseUrl(runningUrl);
  } else {
    const registry = new TargetRegistry(artifactsRoot);
    const entry = await registry.get(id);
    if (entry) registry.applyEnv(entry);
  }
  return id;
}

export function resolvePlaywrightBaseURL(harnessId: string): string {
  const key = envKey(harnessId);
  const url = process.env[key];
  if (!url) throw new Error(`[untestutils/playwright] missing ${key}`);
  return normalizeBaseUrl(url);
}

export async function usePlaywrightHarnessId(
  harness: string | Recipe,
  use: (id: string) => Promise<void>,
): Promise<void> {
  await use(await resolvePlaywrightHarnessId(harness));
}

type TestFixtures = {
  baseURL: string;
};

type WorkerFixtures = {
  harness: string | Recipe;
  harnessId: string;
};

export const test: ReturnType<typeof base.extend<TestFixtures, WorkerFixtures>> = base.extend<
  TestFixtures,
  WorkerFixtures
>({
  harness: ['', { option: true, scope: 'worker' }],
  harnessId: [
    async ({ harness }, use) => {
      await usePlaywrightHarnessId(harness, use);
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ harnessId }, use) => {
    await use(resolvePlaywrightBaseURL(harnessId));
  },
});
