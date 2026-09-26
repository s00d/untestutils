import { expect, test } from 'vitest';
import {
  registerSharedNuxtReset,
  resetSharedNuxtApp,
  restartSharedNuxtApp,
} from 'untestutils/runtime';

declare global {
  // eslint-disable-next-line no-var
  var __UT_BOOTS: number | undefined;
}

/**
 * If a custom reset throws, dispose path must still allow restart recovery.
 */
test('recover via restartSharedNuxtApp after broken registerSharedNuxtReset', async () => {
  const before = globalThis.__UT_BOOTS ?? 0;
  const dispose = registerSharedNuxtReset(() => {
    throw new Error('custom reset boom');
  });

  await expect(resetSharedNuxtApp({ host: false, timers: false, stubs: false })).rejects.toThrow(
    'custom reset boom',
  );
  dispose();

  await restartSharedNuxtApp();
  expect(globalThis.__UT_BOOTS ?? 0).toBe(before + 1);

  const { useState } = await import('#imports');
  expect(useState('ut-lifecycle-recover', () => 1).value).toBe(1);
});
