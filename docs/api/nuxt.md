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
| `nuxtConfig?` | Config overrides |

## matrix(base, variants)

Expand one fixture into many recipe ids (spread into `defineRecipes`).

See [Drivers](/guide/drivers).
