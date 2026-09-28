import { expect, test } from 'vitest';
import { resetSharedNuxtApp } from 'untestutils/runtime';

/**
 * Mid-test explicit reset still works; no suite-level afterEach needed for
 * cross-test isolation when resetBetweenTests is on.
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
