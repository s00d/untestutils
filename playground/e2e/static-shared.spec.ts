import { describe, expect, test, useHarness } from 'untestutils/vitest';

const app = await useHarness('staticSite');

describe('static site dogfood again', () => {
  test('same shared host', async () => {
    expect(app.url).toBeTruthy();
    const html = await app.$fetch('/');
    expect(html).toContain('data-testid="title"');
  });
});
