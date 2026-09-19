---
title: Drivers API
description: staticDir, command, nodeEntry, host, defineDriver, matrixRecipe.
outline: deep
---

# Drivers API

```ts
import { staticDir, command, nodeEntry, host, defineDriver, matrixRecipe } from 'untestutils'
```

| Factory | Key options |
|---------|-------------|
| `staticDir` | `id`, `root` |
| `command` | `id`, `prepare?`, `start` (`$PORT`, `$HOST`, `$OUT_DIR`), `readyPath?`, `readyTimeoutMs?` |
| `nodeEntry` | `id`, `entry`, `readyPath?`, `readyTimeoutMs?` |
| `host` | `id`, `url`, `readyPath?`, `readyTimeoutMs?`, `skipReady?` |
| `defineDriver` | `(opts) => Recipe` — normalizes `id` / `share` |
| `matrixRecipe` | `(factory, base, variants, { label, merge? })` → `Record<string, Recipe>` |

## Framework packages

| Package | Factory | `matrix` |
|---------|---------|----------|
| `untestutils/vite` | `vite` | yes |
| `untestutils/next` | `next` | yes |
| `untestutils/astro` | `astro` | yes |
| `untestutils/sveltekit` | `sveltekit` | yes |
| `untestutils/remix` | `remix` | yes |
| `untestutils/solidstart` | `solidstart` | yes |
| `untestutils/nuxt` | `nuxt` | yes (nitro-aware merge) |

Shared base options: `id?`, `root`, `env?`, `hashInputs?`, `readyPath?`, `readyTimeoutMs?`, `workspaceDeps?` (`true` \| `'auto'`).

Typed config overrides (hashed; deep-merged in `matrix`):

| Package | Option | Mechanism |
|---------|--------|-----------|
| `vite` / `sveltekit` / `remix` | `viteConfig` | `mergeConfig` + `--config` |
| `astro` | `astroConfig` | Astro `mergeConfig` + `--config` |
| `solidstart` | `appConfig` | `withEphemeralFile` on `app.config.*` |
| `next` | `nextConfig` | `withEphemeralFile` on `next.config.*` |
| `nuxt` | `nuxtConfig` | `loadNuxt({ overrides })` |

Core helpers: `withEphemeralFile`, `installEphemeralFile`, `writeEphemeralConfig`, `deepMergePlain`, `configOverrideHashInput`.

See [Drivers guide](/guide/drivers) · [Nuxt API](/api/nuxt).
