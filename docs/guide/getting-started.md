---
title: Getting started
description: Install untestutils and run your first Vitest e2e test with a shared Recipe.
outline: deep
---

# Getting started

untestutils is a **recipe-based test harness** for Vitest and Playwright. You declare targets once (`prepare` + `start`), share builds across specs, and reuse the same `recipes.ts` from both runners.

## Requirements

- Node.js **>= 20**
- Vitest **5+** (for e2e)
- Optional: `@playwright/test`, `playwright-core`, `nuxt`

## Install

::: code-group

```bash [pnpm]
pnpm add -D untestutils vitest
# optional peers
pnpm add -D @playwright/test playwright-core nuxt
```

```bash [npm]
npm install -D untestutils vitest
```

```bash [yarn]
yarn add -D untestutils vitest
```

:::

Or scaffold files with the CLI:

```bash
pnpm dlx untestutils init --preset vitest
# or: playwright | nuxt | full
```

Then run `untestutils doctor` to verify peers and configs.

## Minimal Vitest e2e

### 1. Recipes

```ts
// recipes.ts
import { defineRecipes, staticDir } from 'untestutils'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  site: staticDir({
    id: 'site',
    root: resolve('./fixtures/static'), // folder with index.html
  }),
})
```

### 2. Vitest config

Import the **plugin** from `untestutils/vitest/plugin` — not from `untestutils/vitest` (that entry loads fixtures and must stay out of config load).

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { untestutils } from 'untestutils/vitest/plugin'
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
import { describe, test, expect, useHarness } from 'untestutils/vitest'

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

Artifacts land under **`.untestutils/`** at the repo root (never inside a workspace package).

## Next

- [Concepts](/guide/concepts) — Recipe, Driver, prepare vs start
- [Vitest guide](/guide/vitest) — fixtures `page` / `goto` / `request`
- [Utils](/guide/utils) — cookies, SEO head, poll, domain emulation
- [Playwright](/guide/playwright) — shared recipes with Playwright Test
- [CLI](/cli/) — `init`, `convert`, `doctor`
