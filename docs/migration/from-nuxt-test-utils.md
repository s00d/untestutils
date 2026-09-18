---
title: Migrate from @nuxt/test-utils
description: Clean-break mapping from @nuxt/test-utils to untestutils with before/after examples.
outline: deep
---

# Migrate from `@nuxt/test-utils`

untestutils is a **clean break**, not a drop-in compatibility layer. You keep Vitest/Playwright skills; you change how apps are prepared and shared.

## Cheat sheet

| `@nuxt/test-utils` | untestutils |
|--------------------|-------------|
| `setup({ rootDir, browser })` | `await useHarness(nuxt({ root, run: 'server' }))` |
| `createPage` / `url` / `$fetch` | harness handle + Vitest fixtures `page` / `goto` / `baseURL` / `$fetch` |
| Playwright `test.use({ nuxt })` | `test.use({ harness: 'id' })` + shared `recipes.ts` |
| `defineVitestConfig` (unit env) | **v0.2** `untestutils/config` (stub today) |
| `mountSuspended` | **v0.2** `untestutils/runtime` (stub today) |
| Per-file rebuild | Shared `prepare` via Recipe identity + `.untestutils/builds` |

Put Vitest **e2e** (harness) and Nuxt **unit** environment in **separate** Vitest projects when you need both (unit lands in v0.2).

## Before / after — Vitest e2e

::: code-group

```ts [Before]
import { setup, $fetch, createPage } from '@nuxt/test-utils/e2e'
import { describe, test, expect } from 'vitest'

await setup({ rootDir: './fixtures/basic', browser: true })

describe('home', () => {
  test('html', async () => {
    expect(await $fetch('/')).toContain('Hello')
  })
  test('page', async () => {
    const page = await createPage('/')
    expect(await page.textContent('h1')).toContain('Hello')
  })
})
```

```ts [After]
import { describe, test, expect, useHarness } from 'untestutils/vitest'

describe('home', () => {
  test('html', async () => {
    const app = await useHarness('basic')
    expect(await app.$fetch('/')).toContain('Hello')
  })

  test('page', async ({ page, goto }) => {
    await useHarness('basic')
    await goto('/')
    expect(await page.textContent('h1')).toContain('Hello')
  })
})
```

:::

Register the Nuxt fixture once:

```ts
// recipes.ts
import { defineRecipes } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  basic: nuxt({
    id: 'basic',
    root: resolve('./fixtures/basic'),
    run: 'server',
  }),
})
```

## Before / after — Playwright

::: code-group

```ts [Before]
import { test, expect } from '@nuxt/test-utils/playwright'

test('home', async ({ page, goto }) => {
  await goto('/')
  await expect(page.getByRole('heading')).toBeVisible()
})
```

```ts [After]
import { test, expect } from 'untestutils/playwright'

test.use({ harness: 'basic' })

test('home', async ({ page, baseURL }) => {
  await page.goto(baseURL!)
  await expect(page.getByRole('heading')).toBeVisible()
})
```

:::

Wire Playwright with `createPlaywrightConfig({ recipes, recipesModule, prewarm })` — see [Playwright guide](/guide/playwright).

## Shared prepare vs per-file setup

`@nuxt/test-utils` often rebuilds per file / context. untestutils:

1. Hashes recipe inputs → identity.
2. Prepares once into `.untestutils/builds`.
3. Reuses the server URL across files via registry / prewarm.

That is the main CI time win for large Nuxt fixtures.

## Automated convert

```bash
UNTESTUTILS_AI=1 untestutils convert path/to/old.spec.ts
```

Review the generated `*.untestutils.test.ts` (or `--in-place`). Convert is best-effort — always verify.

## Still on the roadmap (v0.2+)

- In-process Nuxt environment (`mountSuspended`, macros)
- `defineVitestConfig` / project helpers

Until then, keep unit tests on your current stack; use untestutils for **e2e harness** flows.

## Next

- [Getting started](/guide/getting-started)
- [Pain points covered](/migration/pain-points)
- [AI convert](/guide/ai)
