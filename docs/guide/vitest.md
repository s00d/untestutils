---
title: Vitest
description: Plugin, prewarm, useHarness, and browser fixtures.
outline: deep
---

# Vitest

## Plugin vs barrel

::: warning
Config: `untestutils/vitest/plugin`. Specs: `untestutils/vitest`. Do not load the barrel in config.
:::

## Plugin options

```ts
untestutils({
  recipes,              // from defineRecipes(..., import.meta.url)
  prewarm: ['site'],
  browsers: ['chromium'],
  artifactsRoot: undefined,
})
```

| Option | Notes |
|--------|--------|
| `recipes` | Map from your recipes module |
| `prewarm` | Ids to prepare/start in global setup |
| `browsers` | Engines for `page` / `goto` (default `['chromium']`) |
| `artifactsRoot` | Sets `UNTESTUTILS_ARTIFACTS_DIR` |

Override engine per run: `UNTESTUTILS_BROWSER=firefox`.

## useHarness

```ts
const app = await useHarness('site')
await app.$fetch('/')
app.url
app.dir
await app.files.read('index.html')
```

Prefer registered **ids** so Vitest and Playwright share the prepare cache.

## Fixtures

| Fixture | Role |
|---------|------|
| `harness` | Recipe id via `test.override({ harness })` |
| `browserName` | `chromium` \| `firefox` \| `webkit` |
| `baseURL` | Current harness URL |
| `page` | Playwright `Page` |
| `goto` | `page.goto` (+ Nuxt `waitUntil: 'hydration' \| 'route'`) |
| `request` | APIRequestContext |

```ts
import { describe, test, expect } from 'untestutils/vitest'

describe('ui', () => {
  test.override({ harness: 'site' })

  test('home', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
```

Ensure `useHarness` or `prewarm` started the target so `baseURL` resolves.

## Nuxt unit (separate project)

E2e plugin and Nuxt unit env do **not** share one Vitest config:

- E2e: `untestutils/vitest/plugin`
- Unit: `environment: 'untestutils'` + `untestutils/config` / `untestutils/runtime`

See [API overview](/api/) (`config`, `runtime`, `module`).

## Next

- [Playwright](/guide/playwright)
- [Utils](/guide/utils)
- [API: Vitest](/api/vitest)
