import { test, expect } from 'untestutils/playwright';

// harness comes from project.use in playwright.config.ts

test('playwright harness serves static site', async ({ page, baseURL }) => {
  expect(baseURL).toContain('127.0.0.1');
  await page.goto('/');
  await expect(page.getByTestId('title')).toHaveText('Playground Static');
});
