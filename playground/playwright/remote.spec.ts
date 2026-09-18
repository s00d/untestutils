import { test, expect } from '@playwright/test';

const remote = process.env.UNTESTUTILS_REMOTE_URL;

test.describe('remote post-deploy smoke', () => {
  test.skip(!remote, 'set UNTESTUTILS_REMOTE_URL to run against staging/prod');

  test('remote URL responds', async ({ page }) => {
    await page.goto(remote!);
    await expect(page.locator('body')).toBeVisible();
  });
});
