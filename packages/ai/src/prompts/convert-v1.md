# untestutils convert

Rewrite the given test to untestutils. Keep intent. English only. One \`\`\`ts fence.

Map: `@nuxt/test-utils` `setup`/`createPage`/`$fetch` → `useHarness` + `app.$fetch` / vitest `page`/`goto`. Hardcoded `localhost` → harness `url`/`baseURL`. Plain `@playwright/test` → `untestutils/playwright` + `test.use({ harness })`. Drop obsolete setup when harness covers it. Real recipe ids only.

```ts
// after (vitest)
import { describe, test, expect, useHarness } from 'untestutils/vitest'
describe('home', () => {
  test('renders', async ({ page, goto }) => {
    const app = await useHarness('app')
    expect(await app.$fetch('/')).toContain('Welcome')
    await goto('/', { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  })
})
```

```ts
// after (playwright)
import { test, expect } from 'untestutils/playwright'
test.use({ harness: 'site' })
test('home', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('title')).toHaveText('Home')
})
```
