---
title: Playwright API
description: createPlaywrightConfig and Playwright test fixtures.
outline: deep
---

# Playwright API

```ts
import {
  createPlaywrightConfig,
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
  ...playwrightConfigFields
})
```

Sets `globalSetup` / `globalTeardown` companion entry points automatically.

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
