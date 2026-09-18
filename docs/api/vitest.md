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

`baseURL`, `page`, `goto`, `request` — see [Vitest guide](/guide/vitest).

## Next

- [Vitest guide](/guide/vitest)
- [Playwright API](/api/playwright)
