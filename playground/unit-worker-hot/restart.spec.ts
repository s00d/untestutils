import { expect, test } from 'vitest';
import { restartSharedNuxtApp } from 'untestutils/runtime';

declare global {
  // eslint-disable-next-line no-var
  var __UT_BOOTS: number | undefined;
}

test('restartSharedNuxtApp increments boot counter', async () => {
  const before = globalThis.__UT_BOOTS ?? 0;
  expect(before).toBeGreaterThanOrEqual(1);
  await restartSharedNuxtApp();
  expect(globalThis.__UT_BOOTS ?? 0).toBe(before + 1);
});
