---
title: Vitest API
description: Plugin options and fixtures.
outline: deep
---

# Vitest API

## `untestutils/vitest/plugin`

| Option | Type | Description |
|--------|------|-------------|
| `recipes` | `RecipeRegistry` | From `defineRecipes(..., import.meta.url)` |
| `recipesModule` | `string?` | Rare path override |
| `artifactsRoot` | `string?` | Artifacts directory |
| `prewarm` | `string[]` | Ids to prepare/start |
| `browsers` | `HarnessBrowserName[]?` | Default `['chromium']` |
| `coverage` | `boolean \| CreateCoverageConfigOptions` | Merge Vitest coverage |

Also: `createCoverageConfig()`, `HARNESS_BROWSER_NAMES`, `normalizeHarnessBrowsers`.

## `untestutils/vitest` (specs)

Exports: `test`, `describe`, `expect`, `useHarness`, `defineRecipes`, fixtures (`harness`, `page`, `goto`, `baseURL`, `request`, `browserName`).

See [Vitest guide](/guide/vitest).
