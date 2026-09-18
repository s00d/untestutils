import { describe, expect, it } from 'vitest';
import { registerEndpoint } from 'untestutils/runtime';

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
});
