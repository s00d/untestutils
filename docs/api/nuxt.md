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
| `run?` | Default **`'server'`**. Also `'static'` \| `'dev'` — see below |
| `preset?` | Nitro preset (in prepare hash) |
| `env?` | Build/runtime env |
| `nuxtConfig?` | `Partial<NuxtConfig>` overrides |
| `hashInputs?` | Extra paths for prepare identity |
| `workspaceDeps?` | `true` \| `'auto'` — include workspace `src/` in hash |
| `readyTimeoutMs?` | Ready probe timeout |

### `run`

| Value | Default? | Share | Notes |
|-------|----------|-------|-------|
| `'server'` | **yes** | `always` | Build → Nitro. Use for almost all e2e. |
| `'static'` | no | `always` | Generate → static files. |
| `'dev'` | no | `never` | `nuxi _dev` only. **Not** a speed shortcut — only for HMR / live file-watcher tests. |

Full guidance: [Drivers — nuxt run modes](/guide/drivers#run-modes-nuxt).

## matrix(base, variants)

Expand one fixture into many recipe ids (spread into `defineRecipes`).

Nuxt’s `matrix` is a thin wrapper over core `matrixRecipe` with **nitro-aware** `nuxtConfig` merge. Other frameworks export the same helper without Nitro (`untestutils/vite`, `next`, …). Generic helper: `matrixRecipe` from `untestutils`.

See [Drivers](/guide/drivers).
