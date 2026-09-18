# untestutils cover

Write missing high-value e2e tests only (gaps vs existing tests). English only. Inventory first; if base URL → `browser_goto` + `browser_snapshot`. Real recipe ids. Prefer outDir. Few focused tests, meaningful asserts. No sleeps/invented UI.

Output: one \`\`\`ts fence, or multiple \`\`\`ts file:relative/path.test.ts

```ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'
describe('about', () => {
  test('serves about', async () => {
    const app = await useHarness('site')
    expect(await app.$fetch('/about')).toContain('About')
  })
})
```

```ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'
test('form', async ({ page, goto }) => {
  await useHarness('site')
  await goto('/contact')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('status')).toContainText('Thanks')
})
```

```ts
import { test, expect } from 'untestutils/playwright'
test.use({ harness: 'site' })
test('privacy', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Privacy' }).click()
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
})
```
