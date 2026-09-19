import { describe, expect, it } from 'vitest';
import { registerEndpoint } from 'untestutils/runtime';
import { mountSuspended } from 'untestutils/runtime';
import FetchCard from '../fixtures/unit-app/components/FetchCard.vue';

describe('registerEndpoint', () => {
  it('mocks a Nitro endpoint and is returned by $fetch', async () => {
    registerEndpoint('/api/mocked', () => ({ mocked: true, value: 42 }));
    const result = await $fetch('/api/mocked');
    expect(result).toEqual({ mocked: true, value: 42 });
  });

  it('supports method-specific handlers', async () => {
    registerEndpoint('/api/echo', {
      method: 'POST',
      handler: () => ({ method: 'post' }),
    });
    const result = await $fetch('/api/echo', { method: 'POST' });
    expect(result).toEqual({ method: 'post' });
  });

  it('supports once handlers that fire a single time', async () => {
    registerEndpoint('/api/once', {
      once: true,
      handler: () => ({ n: 1 }),
    });
    expect(await $fetch('/api/once')).toEqual({ n: 1 });
    await expect($fetch('/api/once')).rejects.toThrow();
  });

  it('unregister callback removes the mock', async () => {
    const stop = registerEndpoint('/api/temp', () => ({ ok: true }));
    expect(await $fetch('/api/temp')).toEqual({ ok: true });
    stop();
    await expect($fetch('/api/temp')).rejects.toThrow();
  });

  it('feeds useFetch inside mountSuspended', async () => {
    registerEndpoint('/api/card', () => ({ value: 'from-endpoint' }));
    const wrapper = await mountSuspended(FetchCard);
    expect(wrapper.get('[data-testid="fetch-card"]').text()).toBe('from-endpoint');
  });
});
