---
title: Getting started
description: Install untestutils and run your first Vitest e2e test with a shared Recipe.
outline: deep
---

# Getting started

Declare targets once (`prepare` + `start`), share builds across specs, reuse the same `recipes.ts` from Vitest and Playwright.

New here? Read [Why](/why) first (one page).

## Requirements

- Node.js **>= 20** (CI primary **22**, smoke **20**)
- Vitest **4+** or **5+** (peer `^4 || ^5`)
- Optional: `@playwright/test`, `playwright-core`, Nuxt stack

## Install

Always install facade / adapters at the **same version** (lockstep).

`untestutils` pulls **core + vitest + playwright + utils + cli**. **Nuxt**, framework adapters (`vite` / `next` / …), **AI**, and **Perf** are optional peers.

::: code-group

```bash [pnpm]
pnpm add -D untestutils vitest
# Nuxt recipes + unit:
pnpm add -D @untestutils/nuxt vitest-environment-untestutils nuxt
# Optional peers when needed:
pnpm add -D @untestutils/vite          # or next / astro / …
pnpm add -D @untestutils/ai            # codegen
pnpm add -D @untestutils/perf          # build/load suite
pnpm add -D @playwright/test playwright-core
```

```bash [npm]
npm install -D untestutils vitest
```

:::

| Need | Comes with `untestutils`? | Extra install |
|------|---------------------------|---------------|
| Core recipes + drivers | Yes | — |
| Vitest e2e plugin / fixtures | Yes | `vitest` peer |
| Playwright config | Yes | Playwright peers |
| Nuxt recipes + unit | No (optional peer) | `@untestutils/nuxt` + `vitest-environment-untestutils` + `nuxt` |
| Vite / Next / Astro / … | No | `@untestutils/<name>` |
| AI / Perf | No (optional) | `@untestutils/ai` / `@untestutils/perf` |

See [Support matrix](/guide/support-matrix).

Scaffold:

```bash
pnpm dlx untestutils init --preset vitest
# playwright | nuxt | full
# Flags: --no-install, --pm pnpm|npm|yarn|bun, --force
pnpm dlx untestutils doctor
pnpm dlx untestutils doctor --recipes
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
