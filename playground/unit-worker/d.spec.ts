import { expect, test } from 'vitest';
import { registerEndpoint, clearRegisteredEndpoints } from 'untestutils/runtime';

test('worker-d can register endpoints', async () => {
  registerEndpoint('/ut-worker-probe', () => ({ ok: true }));
  const res = await $fetch('/ut-worker-probe');
  expect(res).toEqual({ ok: true });
  // Explicit clear is also exercised by resetSharedNuxtApp between tests in worker mode.
  clearRegisteredEndpoints();
});
