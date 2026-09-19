import { describe, test, expect, useHarness } from 'untestutils/vitest';

describe('nuxt smoke', () => {
  test('app returns HTML', async () => {
    const app = await useHarness('app');
    const res = await fetch(app.url!);
    expect(res.ok).toBe(true);
  });
});
