---
title: Nuxt API
description: nuxt({ run }) and matrix.
outline: deep
---

# Nuxt API

```ts
import { nuxt, matrix } from 'untestutils/nuxt'
```

## nuxt(options)

| Option | Description |
|--------|-------------|
| `id` | Recipe id |
| `root` | App directory |
| `run` | `'server' \| 'static' \| 'dev'` |
| `preset?` | Nitro preset (in prepare hash) |
| `env?` | Build/runtime env |
| `nuxtConfig?` | `Partial<NuxtConfig>` overrides |

## matrix(base, variants)

Expand one fixture into many recipe ids (spread into `defineRecipes`).

Nuxt’s `matrix` is a thin wrapper over core `matrixRecipe` with **nitro-aware** `nuxtConfig` merge. Other frameworks export the same helper without Nitro (`untestutils/vite`, `next`, …). Generic helper: `matrixRecipe` from `untestutils`.

See [Drivers](/guide/drivers).
