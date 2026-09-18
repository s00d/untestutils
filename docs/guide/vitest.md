---
title: Vitest
description: Configure the untestutils Vitest plugin, prewarm, and browser fixtures.
outline: deep
---

# Vitest

## Plugin vs barrel

::: warning
Config files must import from `untestutils/vitest/plugin`.

Specs import from `untestutils/vitest`. Loading the barrel in config evaluates `test.extend` too early.
:::

```ts
// vitest.config.ts
import { untestutils } from 'untestutils/vitest/plugin'
```

```ts
// *.test.ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'
```

## Plugin options

```ts
import { recipes } from './recipes'

untestutils({
  recipes, // from defineRecipes(..., import.meta.url)
  prewarm: ['site'],
  artifactsRoot: undefined, // optional — sets UNTESTUTILS_ARTIFACTS_DIR
})
```

| Option | Required | Notes |
|--------|----------|-------|
| `recipes` | yes | Import the map from your recipes module |
| `prewarm` | no | Recipe ids to prepare/start in global setup |
| `artifactsRoot` | no | Artifacts directory |
| `recipesModule` | no | Rare override; normally inferred from `defineRecipes` |

In `recipes.ts`:

```ts
export const recipes = defineRecipes({
  site: /* … */,
}, import.meta.url)
```

Workers / globalSetup re-import that module automatically — no `fileURLToPath` in the Vitest config.

The plugin injects global setup / setup files so targets are prepared and registered before specs run.

## useHarness

```ts
const app = await useHarness('site')
// or: await useHarness(myInlineRecipe)

await app.$fetch('/')
app.url // string | undefined
app.dir // string | undefined
await app.files.read('index.html')
```

Call `useHarness` once per describe (or inside a test). Prefer recipe **ids** registered in `recipes.ts` so Playwright and Vitest share the same prepare cache.

## Fixtures

`test` from `untestutils/vitest` extends Vitest with:

| Fixture | Role |
|---------|------|
| `baseURL` | Current harness URL |
| `page` | Playwright `Page` (chromium via `playwright-core`) |
| `goto` | `page.goto` helper with Nuxt `waitUntil: 'hydration' \| 'route'` support |
| `request` | Playwright APIRequestContext |

```ts
import { describe, test, expect } from 'untestutils/vitest'

describe('ui', () => {
  test('home', async ({ page, goto }) => {
    await goto('/')
    await expect(page.locator('h1')).toBeVisible()
  })
})
```

Ensure `await useHarness('…')` ran first (or prewarm started the target) so `baseURL` resolves.

Prefer declaring the recipe on the suite:

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

`test` is typed as `TestAPI<HarnessFixtures>` so `harness` / `page` / `goto` / `baseURL` / `request` resolve in editors and `tsc`.

## Progress output

Harness prepare/start prints compact status lines (not Vitest `[error]`):

```
◆ untestutils
● prepare  async-components  building…
✔ prepare  async-components  6.5s
→ start    async-components  http://127.0.0.1:61239
✔ prepare  redirect          cache
→ start    redirect          http://127.0.0.1:61240
■ teardown
```

| Env | Effect |
|-----|--------|
| `UNTESTUTILS_QUIET=1` | Silence harness progress |
| `UNTESTUTILS_PROGRESS=0` | Same — force progress off |
| `UNTESTUTILS_PROGRESS=1` | Force progress on (even in CI) |
| `CI=true` / `GITHUB_ACTIONS` / … | Progress **off** by default; original Nuxt/Vite logs stay visible |
| `UNTESTUTILS_DEBUG=1` | Verbose internals; never mute build logs |

In CI (or with quiet/progress off) prepare does **not** mute `consola` — you get the original build output. Failures always rethrow; `progress.fail` still prints to stderr and is never suppressed by quiet/CI.

## Coverage

Use the built-in helper (or `coverage: true` on the plugin):

```ts
import { defineConfig } from 'vitest/config'
import { untestutils, createCoverageConfig } from 'untestutils/vitest/plugin'

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      coverage: true, // or { thresholds: { lines: 90 } }
    }),
  ],
  // or without plugin merge:
  // test: { coverage: createCoverageConfig() }
})
```

Peer: `@vitest/coverage-v8`. Defaults: 80% lines/functions/statements, 70% branches.

## Next

- [Playwright](/guide/playwright)
- [API: Vitest](/api/vitest)
- [Troubleshooting](/guide/troubleshooting)
