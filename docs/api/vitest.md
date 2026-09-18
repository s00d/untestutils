---
title: Vitest API
description: Plugin options and Vitest fixture exports.
outline: deep
---

# Vitest API

## Plugin — `untestutils/vitest/plugin`

```ts
import { untestutils } from 'untestutils/vitest/plugin'
import type { UntestutilsPluginOptions } from 'untestutils/vitest/plugin'
```

### UntestutilsPluginOptions

| Option | Type | Description |
|--------|------|-------------|
| `recipes` | `RecipeRegistry` | From `defineRecipes(..., import.meta.url)` |
| `recipesModule` | `string?` | Rare override of recipes file path |
| `artifactsRoot` | `string?` | Override artifacts directory |
| `prewarm` | `string[]` | Ids to prepare/start in global setup |
| `browsers` | `HarnessBrowserName[]?` | Engines for `page`/`goto` (default `['chromium']`) |
| `coverage` | `boolean \| CreateCoverageConfigOptions` | Merge Vitest coverage (thresholds + include). `true` = app `src/**` defaults |

### createCoverageConfig(options?)

Build a Vitest `test.coverage` object without the plugin:

```ts
import {
  createCoverageConfig,
  UNTESTUTILS_WORKSPACE_PACKAGES,
} from 'untestutils/vitest/plugin'

export default defineConfig({
  test: {
    coverage: createCoverageConfig({
      workspacePackages: [...UNTESTUTILS_WORKSPACE_PACKAGES],
      thresholds: { lines: 80, branches: 70 },
    }),
  },
})
```

Default thresholds for apps: lines/functions/statements **80**, branches **70**. The monorepo dogfood config may use a lower floor until suites catch up.

## Specs — `untestutils/vitest`

Exports: `untestutils` (plugin re-export), `useHarness`, `defineRecipes`, `defineRecipe`, `test`, `describe`, `expect`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`, types `HarnessHandle`, `Recipe`, `UntestutilsPluginOptions`.

### Fixtures on `test`

`baseURL`, `page`, `goto`, `request`, `browserName`, `harness` — see [Vitest guide](/guide/vitest).

## Unit — `untestutils/config` + `untestutils/runtime`

| Export | Package | Role |
|--------|---------|------|
| `defineVitestConfig` | `untestutils/config` | Vitest config with Nuxt unit env |
| `defineVitestProject` | `untestutils/config` | Single project helper |
| `getVitestConfigFromNuxt` | `untestutils/config` | Low-level Nuxt→Vite merge |
| `mountSuspended` / `renderSuspended` | `untestutils/runtime` | Suspended mount helpers |
| `mockNuxtImport` / `unmockNuxtImport` / `mockComponent` | `untestutils/runtime` | Compile-time macros (need `untestutils/module`) |
| `registerEndpoint` | `untestutils/runtime` | In-process h3 routes (mock **or** real Nitro handlers) |

Environment: `vitest-environment-untestutils` — Vitest resolves `environment: 'untestutils'`. Compat alias: `environment: 'nuxt'` via nested `vitest-environment-nuxt`.

Standalone installs resolve runtime entry / `nuxt-root` / mocks through `untestutils/runtime/*` facade exports (no separate `@untestutils/runtime` package required).

## Next

- [Vitest guide](/guide/vitest)
- [Playwright API](/api/playwright)
