---
title: Playwright
description: Share recipes with Playwright Test via createPlaywrightConfig and harness fixtures.
outline: deep
---

# Playwright

Use the **same** `recipes.ts` as Vitest. Playwright gets companion `globalSetup` / `globalTeardown` that prepare prewarmed recipes and stop targets.

## Config

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'
import { createPlaywrightConfig } from 'untestutils/playwright'
import { recipes } from './recipes'

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    prewarm: ['site'],
    testDir: './tests/e2e',
    use: { headless: true },
  }),
)
```

`createPlaywrightConfig` merges your Playwright options and sets:

- `globalSetup` → `untestutils/playwright/pw-global-setup`
- `globalTeardown` → `untestutils/playwright/pw-global-teardown`

## Specs

```ts
import { test, expect } from 'untestutils/playwright'

test.use({ harness: 'site' })

test('opens home', async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy()
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})
```

| Fixture / option | Scope | Notes |
|------------------|-------|-------|
| `harness` | worker option | Recipe id **or** Recipe object |
| `harnessId` | worker | Resolved id after prepare |
| `baseURL` | test | From `UNTESTUTILS_HOST_<ID>` env set by the harness |

Also re-exported: `expect`, `defineRecipes`, `useHarness`.

## Vitest + Playwright together

Keep one `recipes.ts` (`defineRecipes(..., import.meta.url)`). Import `recipes` into both configs. Prewarm the same ids so CI does not rebuild twice unnecessarily.

## Next

- [Remote host](/guide/remote-host)
- [Sharing & cache](/guide/sharing-and-cache)
- [Troubleshooting](/guide/troubleshooting)
