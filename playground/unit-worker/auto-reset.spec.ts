import { expect, test } from 'vitest';

/**
 * Relies only on `resetBetweenTests` auto soft-reset (no local afterEach).
 * Two tests in one file prove the hook runs for every test in the suite.
 */
test('useState mutates', async () => {
  const { useState } = await import('#imports');
  const counter = useState('ut-auto-reset-counter', () => 0);
  counter.value = 99;
  expect(counter.value).toBe(99);
});

test('useState is soft-reset between tests', async () => {
  const { useState } = await import('#imports');
  const counter = useState('ut-auto-reset-counter', () => 0);
  expect(counter.value).not.toBe(99);
  expect(counter.value).toBe(0);
});
