---
title: Getting started
description: Install untestutils and run your first Vitest e2e test with a shared Recipe.
outline: deep
---

# Getting started

Declare targets once (`prepare` + `start`), share builds across specs, reuse the same `recipes.ts` from Vitest and Playwright.

New here? Read [Why](/why) first (one page).

## Requirements

- Node.js **>= 20**
- Vitest **4+** or **5+**
- Optional: `@playwright/test`, `playwright-core`, `nuxt`

## Install

Always install facade / adapters at the **same version** (lockstep).

::: code-group

```bash [pnpm]
pnpm add -D untestutils @untestutils/vitest vitest
# Nuxt recipes:
pnpm add -D @untestutils/nuxt
# Playwright:
pnpm add -D @untestutils/playwright @playwright/test playwright-core
```

```bash [npm]
npm install -D untestutils @untestutils/vitest vitest
```

:::

| Need | Packages |
|------|----------|
| Core + Vitest e2e | `untestutils`, `@untestutils/vitest` |
| Playwright | `@untestutils/playwright` (+ Playwright peers) |
| Nuxt / Vite / Next / … | `@untestutils/<framework>` only for that stack |

Preferred imports: `@untestutils/vitest/plugin`, `@untestutils/nuxt`. Facade subpaths (`untestutils/vitest/plugin`, …) still work when peers are installed.

Scaffold:

```bash
pnpm dlx untestutils init --preset vitest
# playwright | nuxt | full
pnpm dlx untestutils doctor
```

## Minimal Vitest e2e

### 1. Recipes

```ts
// recipes.ts
import { defineRecipes, staticDir } from 'untestutils'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  site: staticDir({
    id: 'site',
    root: resolve('./fixtures/static'),
  }),
}, import.meta.url)
```

### 2. Vitest config

Import the plugin from `@untestutils/vitest/plugin` (or `untestutils/vitest/plugin`) — **not** the specs entry.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { untestutils } from '@untestutils/vitest/plugin'
import { recipes } from './recipes'

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['site'],
    }),
  ],
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
```

### 3. Spec

```ts
// tests/e2e/home.test.ts
import { describe, test, expect, useHarness } from '@untestutils/vitest'

describe('home', () => {
  test('serves HTML', async () => {
    const app = await useHarness('site')
    expect(await app.$fetch('/')).toContain('</html>')
  })
})
```

### 4. Run

```bash
pnpm exec vitest run
```

Artifacts: **`.untestutils/`** at the repo root (never inside a published package).

## Examples

Monorepo playground: [playground/](https://github.com/s00d/untestutils/tree/master/playground) (Vitest + Playwright dogfood).

## Next

- [How it works](/guide/how-it-works)
- [Vitest](/guide/vitest) · [Playwright](/guide/playwright)
- [Drivers](/guide/drivers)
- [Roadmap](/roadmap)
- [CLI](/cli/)
