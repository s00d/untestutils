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
| `preset` | `string?` | Nitro deploy preset (`node-server`, `azure`, …) → `nitro.preset` + hash |
| `env` | `Record<string, string>?` | Build/runtime env |
| `nuxtConfig` | `Record<string, unknown>?` | Overrides merged into Nuxt config |

Returns a **Recipe** suitable for `defineRecipes` / `useHarness` / Playwright `harness`.

```ts
import { defineRecipes } from 'untestutils'
import { nuxt, matrix } from 'untestutils/nuxt'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  app: nuxt({
    id: 'app',
    root: resolve('./fixtures/nuxt'),
    run: 'server',
    preset: 'node-server',
  }),
  ...matrix(
    { id: 'basic', root: resolve('./fixtures/basic'), run: 'server' },
    {
      default: { env: { STRATEGY: 'prefix' } },
      noSsr: { nuxtConfig: { ssr: false } },
    },
  ),
}, import.meta.url)
```

## matrix(base, variants)

Expands one Nuxt options object into many recipes. Key `default` keeps `base.id`; other keys → `${id}__${key}`.

## Next

- [Drivers guide](/guide/drivers)
- [Getting started](/guide/getting-started)
