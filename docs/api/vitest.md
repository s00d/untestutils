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
| `session` | `string?` | Isolate under `.untestutils/sessions/<session>/` (shared with Playwright) |
| `prewarm` | `string[]` | Ids to prepare/start |
| `browsers` | `HarnessBrowserName[]?` | Default `['chromium']`; multiple → `injectTestProjects` |
| `coverage` | `boolean \| CreateCoverageConfigOptions` | Merge Vitest coverage |

Also: `createCoverageConfig()`, `createVitestProjects({ e2e, unit })`, `HARNESS_BROWSER_NAMES`, `normalizeHarnessBrowsers`.

Session context is `provide`/`inject` (`untestutils`, `untestutilsBrowser`); env remains fallback for CLI/PW.

## `untestutils/vitest` (specs)

Exports: `test`, `describe`, `expect`, `useHarness`, `defineRecipes`, fixtures (`harness`, `page`, `goto`, `baseURL`, `request`, `browserName`).

See [Vitest guide](/guide/vitest).
