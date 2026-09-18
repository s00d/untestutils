import { test as base } from '@playwright/test';
import {
  ensurePrepared,
  getRegisteredRecipe,
  normalizeBaseUrl,
  resolveArtifactsRoot,
  type Recipe,
} from '@untestutils/core';

export async function resolvePlaywrightHarnessId(harness: string | Recipe): Promise<string> {
  const id = typeof harness === 'string' ? harness : harness.id;
  if (!id) throw new Error('[untestutils/playwright] test.use({ harness }) required');
  const recipe = typeof harness === 'string' ? getRegisteredRecipe(harness) : harness;
  if (!recipe) throw new Error(`[untestutils/playwright] unknown harness "${id}"`);
  await ensurePrepared(recipe, { artifactsRoot: resolveArtifactsRoot() });
  return id;
}

export function resolvePlaywrightBaseURL(harnessId: string): string {
  const key = `UNTESTUTILS_HOST_${harnessId.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase()}`;
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

export const test = base.extend<TestFixtures, WorkerFixtures>({
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
