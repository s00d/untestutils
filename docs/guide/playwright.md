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
    session: 'app-pw', // isolated artifacts under .untestutils/sessions/app-pw
    prewarm: ['site'],
    workers: 2,
    fullyParallel: true,
    testDir: './tests/e2e',
    use: { headless: true },
  }),
)
```

`createPlaywrightConfig` merges your Playwright options and sets:

- `globalSetup` → `untestutils/playwright/pw-global-setup`
- `globalTeardown` → `untestutils/playwright/pw-global-teardown`
- `fullyParallel: true` by default (override with `fullyParallel: false`)
- `workers: 2` when `CI` is set and you did not pass `workers`

### Session isolation

`session` namespaces TargetRegistry / locks / builds:

```text
.untestutils/sessions/<session>/targets.json
```

Teardown only stops servers in **that** root — parallel Playwright jobs (or Playwright + Vitest) with different sessions do not kill each other. Explicit `artifactsRoot` overrides session namespacing.

```bash
# job A
playwright test -c playwright.a.config.ts   # session: 'ci-a'
# job B
playwright test -c playwright.b.config.ts   # session: 'ci-b'
```

Or set `UNTESTUTILS_SESSION=ci-a` in the environment.

### Projects + workers

Use Playwright `projects` to split suites; workers are one pool for the whole run (Playwright does not support per-project worker limits):

```ts
createPlaywrightConfig({
  recipes,
  session: 'playground-pw',
  prewarm: ['staticSite'],
  workers: 2,
  fullyParallel: true,
  projects: [
    { name: 'static', testMatch: /static\.spec\.ts/, use: { harness: 'staticSite' } },
    { name: 'remote', testMatch: /remote\.spec\.ts/ },
  ],
})
```

Within one session, workers **share** the live server for a recipe id (prepare once). Browser contexts stay isolated per test. For mutable backends that cannot share state, use a **different** `session` (or recipe id), not more workers on the same session.

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

Keep one `recipes.ts` (`defineRecipes(..., import.meta.url)`). Import `recipes` into both configs. Give Playwright a dedicated `session` (e.g. `app-pw`) so its teardown does not drain Vitest targets in the default `.untestutils` root.

## Next

- [Remote host](/guide/remote-host)
- [Sharing & cache](/guide/sharing-and-cache)
- [Troubleshooting](/guide/troubleshooting)
