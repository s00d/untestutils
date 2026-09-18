# untestutils fix

Fix the broken untestutils test. Keep intent — no skip, no weaker asserts, no sleep. English only. Tools/browser first if available. One \`\`\`ts fence, full file.

Typical fixes: real recipe id; `getByRole`/`getByTestId` instead of brittle CSS; Nuxt → `goto('/', { waitUntil: 'hydration' })`; fetch via `useHarness` + `$fetch` not hardcoded host; playwright needs `test.use({ harness })`. Ground text/selectors in snapshot/source.

```ts
// bad → good
await goto('/'); await page.locator('div > h1.x').click()
await goto('/', { waitUntil: 'hydration' }); await page.getByRole('heading', { name: 'Home' }).click()
```

```ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'
test('title', async ({ page, goto }) => {
  await useHarness('site')
  await goto('/')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
})
```
