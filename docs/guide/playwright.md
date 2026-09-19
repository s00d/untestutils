---
title: Playwright
description: Share recipes with Playwright Test via createPlaywrightConfig.
outline: deep
---

# Playwright

Same `recipes.ts` as Vitest. Companion global setup/teardown prepare and stop targets.

## Config

```ts
import { defineConfig } from '@playwright/test'
import { createPlaywrightConfig } from 'untestutils/playwright'
import { recipes } from './recipes'

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    session: 'app-pw', // .untestutils/sessions/app-pw
    prewarm: ['site'],
    browsers: ['chromium', 'firefox'], // auto projects if you omit `projects`
    workers: 2,
    fullyParallel: true,
    testDir: './tests/e2e',
  }),
)
```

Injects `pw-global-setup` / `pw-global-teardown`. Defaults: `fullyParallel: true`; `workers: 2` under `CI` if unset.

## Session isolation

`session` (or `artifactsRoot`) namespaces locks/registry so parallel jobs do not kill each other's servers. Env: `UNTESTUTILS_SESSION`.

Workers **share** the live server for a recipe id; browser contexts stay per-test. Mutable backends that cannot share state need a different session or recipe id.

## Specs

```ts
import { test, expect } from 'untestutils/playwright'

test.use({ harness: 'site' })

test('home', async ({ page, baseURL }) => {
  expect(baseURL).toContain('127.0.0.1')
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
})
```

## Projects

```ts
createPlaywrightConfig({
  recipes,
  session: 'ci-pw',
  prewarm: ['staticSite'],
  workers: 2,
  projects: [
    { name: 'static', testMatch: /static\.spec\.ts/, use: { harness: 'staticSite' } },
    { name: 'remote', testMatch: /remote\.spec\.ts/, use: { harness: 'staging' } },
  ],
})
```

## Next

- [Drivers](/guide/drivers) (`host()` for remote)
- [API: Playwright](/api/playwright)
