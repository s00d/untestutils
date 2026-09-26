import { afterEach, expect, test } from 'vitest';
import { registerEndpoint, resetSharedNuxtApp, registerSharedNuxtReset } from 'untestutils/runtime';

afterEach(async () => {
  await resetSharedNuxtApp();
});

test('endpoint + custom reset (order-proof)', async () => {
  let customRan = 0;
  const dispose = registerSharedNuxtReset(() => {
    customRan += 1;
  });

  registerEndpoint('/ut-worker-leak', () => ({ leaked: true }));
  await resetSharedNuxtApp();
  expect(customRan).toBe(1);

  const result = await $fetch('/ut-worker-leak').catch((error: unknown) => error);
  expect(result).not.toEqual({ leaked: true });
  dispose();
});
