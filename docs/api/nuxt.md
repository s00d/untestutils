---
title: Nuxt API
description: nuxt({ run }) Recipe factory.
outline: deep
---

# Nuxt API

```ts
import { nuxt } from 'untestutils/nuxt'
```

## nuxt(options)

| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | Recipe id |
| `root` | `string` | Nuxt app directory |
| `run` | `'server' \| 'static' \| 'dev'` | How to build/start |

Returns a **Recipe** suitable for `defineRecipes` / `useHarness` / Playwright `harness`.

```ts
import { defineRecipes } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  app: nuxt({
    id: 'app',
    root: resolve('./fixtures/nuxt'),
    run: 'server',
  }),
})
```

## Next

- [Drivers guide](/guide/drivers)
- [Migration from @nuxt/test-utils](/migration/from-nuxt-test-utils)
