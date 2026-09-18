import { describe, expect, test, useHarness } from 'untestutils/vitest';

const app = await useHarness('staticSite');

describe('static site dogfood', () => {
  test('serves title via $fetch', async () => {
    const html = await app.$fetch('/');
    expect(html).toContain('Playground Static');
  });
});
