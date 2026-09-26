import { expect, test } from 'vitest';
import { restartSharedNuxtApp, resetSharedNuxtApp } from 'untestutils/runtime';

declare global {
  // eslint-disable-next-line no-var
  var __UT_BOOTS: number | undefined;
}

/**
 * Lifecycle stress: repeated restart must not leave zombie apps / double-mounts.
 * Boot counter increments once per successful setupNuxt.
 */
test('double restartSharedNuxtApp keeps a single live boot path', async () => {
  const start = globalThis.__UT_BOOTS ?? 0;
  expect(start).toBeGreaterThanOrEqual(1);

  await restartSharedNuxtApp();
  const mid = globalThis.__UT_BOOTS ?? 0;
  expect(mid).toBe(start + 1);

  await restartSharedNuxtApp();
  expect(globalThis.__UT_BOOTS ?? 0).toBe(mid + 1);

  // Soft reset after hard restart must still work (no half-dead app).
  await resetSharedNuxtApp();
  const { useState } = await import('#imports');
  const flag = useState('ut-lifecycle-flag', () => 'ok');
  expect(flag.value).toBe('ok');
});
