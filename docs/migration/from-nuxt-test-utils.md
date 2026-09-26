---
title: Migrate from @nuxt/test-utils
description: Clean-break mapping from @nuxt/test-utils to untestutils.
outline: deep
---

# Migrate from `@nuxt/test-utils`

Clean break, not a drop-in. Keep Vitest/Playwright; change how apps are prepared and shared. Why shared prepare matters: [Why](/why).

## Cheat sheet

| `@nuxt/test-utils` | untestutils |
|--------------------|-------------|
| `setup({ rootDir, browser })` | `await useHarness('id')` with `nuxt({ root, run: 'server' })` |
| `createPage` / `$fetch` | Fixtures `page` / `goto` / `$fetch` on harness |
| Playwright `test.use({ nuxt })` | `test.use({ harness: 'id' })` + shared `recipes.ts` |
| Per-file rebuild | Shared prepare → `.untestutils/builds` |

Keep **e2e** (`untestutils/vitest/plugin`) and Nuxt **unit** (`environment: 'untestutils'`) in **separate** Vitest projects. For large unit suites, set `environmentOptions.nuxt.appIsolation: 'worker'` (see [Vitest — appIsolation](/guide/vitest#appisolation-worker-opt-in)).

## After (e2e)

```ts
// recipes.ts
import { defineRecipes } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  basic: nuxt({ id: 'basic', root: resolve('./fixtures/basic'), run: 'server' }),
}, import.meta.url)
```

```ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'

describe('home', () => {
  test('html', async () => {
    const app = await useHarness('basic')
    expect(await app.$fetch('/')).toContain('Hello')
  })
})
```

## Next

- [Getting started](/guide/getting-started)
- [Vitest](/guide/vitest)
- [From raw Playwright](/migration/from-raw-playwright)
