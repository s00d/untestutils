import { expect, useHarness } from 'untestutils/vitest';
import { E2E_MODE_MARKERS } from '../recipes.ts';

export async function assertHarnessHtml(recipeId: keyof typeof E2E_MODE_MARKERS | string) {
  const marker = E2E_MODE_MARKERS[recipeId];
  if (!marker) throw new Error(`missing E2E_MODE_MARKERS for ${recipeId}`);
  const app = await useHarness(recipeId);
  const html = await app.$fetch('/');
  expect(html).toContain(marker);
  return { app, html };
}
