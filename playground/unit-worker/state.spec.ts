import { afterEach, expect, test } from 'vitest';
import { resetSharedNuxtApp } from 'untestutils/runtime';

afterEach(async () => {
  await resetSharedNuxtApp();
});

/**
 * Single-test phases so shuffle / file order cannot make the suite pass accidentally.
 */
test('useState mutate → reset → assert (order-proof)', async () => {
  const { useState } = await import('#imports');
  const counter = useState('ut-worker-counter', () => 0);
  counter.value = 42;
  expect(counter.value).toBe(42);

  await resetSharedNuxtApp();

  const after = useState('ut-worker-counter', () => 0);
  expect(after.value).not.toBe(42);
});
