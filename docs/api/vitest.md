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
| `prewarmConcurrency` | `number?` | Parallel prewarm limit (default `cpus / 2`) |
| `buildTimeout` | `number \| false` | `test.override({ harness })` build budget (default `hookTimeout`; `false` = build in first test) |
| `gc` | `boolean \| { keep?: number }` | Build cache GC at teardown (default keep 2 per recipe; `keep` ≥ 1) |
| `hydration` | `'strict' \| 'lenient'` | Implicit `goto` hydration timeout throws (default) or is ignored; explicit `waitUntil: 'hydration' \| 'route'` stays strict |
| `retryInfra` | `number?` | Sets `retry: { count, condition: INFRA_ERROR_PATTERN }` unless `retry` is set |

Also: `RetryReporter`, `infraRetry(count)`, `INFRA_ERROR_PATTERN`, `createCoverageConfig()`, `createVitestProjects({ e2e, unit })`, `HARNESS_BROWSER_NAMES`, `normalizeHarnessBrowsers`.

Session context is `provide`/`inject` (`untestutils`, `untestutilsBrowser`); env remains fallback for CLI/PW.

## `untestutils/vitest` (specs)

Exports: `test`, `describe`, `expect`, `useHarness`, `defineRecipes`, fixtures (`harness`, `page`, `goto`, `baseURL`, `request`, `browserName`).

See [Vitest guide](/guide/vitest).
