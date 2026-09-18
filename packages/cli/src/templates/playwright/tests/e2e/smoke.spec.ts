import { test, expect } from 'untestutils/playwright';

test.use({ harness: 'basic' });

test('page opens', async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  await page.goto('/');
});
