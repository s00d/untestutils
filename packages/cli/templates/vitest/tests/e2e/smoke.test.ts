import { describe, test, expect, useHarness } from 'untestutils/vitest';

describe('smoke', () => {
  test('harness starts', async () => {
    const app = await useHarness('basic');
    expect(app.url).toBeTruthy();
  });
});
