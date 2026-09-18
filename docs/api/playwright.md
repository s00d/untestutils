---
title: Playwright API
description: createPlaywrightConfig and Playwright test fixtures.
outline: deep
---

# Playwright API

```ts
import {
  createPlaywrightConfig,
  resolvePlaywrightArtifactsRoot,
  sanitizePlaywrightSession,
  test,
  expect,
  defineRecipes,
  useHarness,
  playwrightGlobalSetup,
  playwrightGlobalTeardown,
} from 'untestutils/playwright'
```

## createPlaywrightConfig

```ts
createPlaywrightConfig({
  recipes?,
  recipesModule?,
  prewarm?,
  artifactsRoot?,
  session?,
  workers?,
  fullyParallel?,
  projects?,
  ...playwrightConfigFields
})
```

| Option | Description |
|--------|-------------|
| `session` | Namespace under `.untestutils/sessions/<session>/` |
| `artifactsRoot` | Explicit root (wins over `session`) |
| `prewarm` | Recipe ids to prepare/start in global setup |
| `workers` / `fullyParallel` | Playwright concurrency; defaults `fullyParallel: true`, and `workers: 2` when `CI` is set |

Sets `globalSetup` / `globalTeardown` companion entry points automatically.

## Helpers

- `resolvePlaywrightArtifactsRoot({ session?, artifactsRoot?, cwd? })`
- `sanitizePlaywrightSession(session)`

## test fixtures

| Name | Scope | Description |
|------|-------|-------------|
| `harness` | worker option | Recipe id or Recipe |
| `harnessId` | worker | Resolved id |
| `baseURL` | test | From host env |

## Companions

- `untestutils/playwright/pw-global-setup`
- `untestutils/playwright/pw-global-teardown`

## Next

- [Playwright guide](/guide/playwright)
- [Remote host](/guide/remote-host)
