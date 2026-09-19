---
title: Drivers
description: Built-in Recipe factories — staticDir, command, nodeEntry, host, nuxt, and other frameworks.
outline: deep
---

# Drivers

Drivers return a **Recipe**. Import from `untestutils` (Nuxt from `untestutils/nuxt`).

```ts
import { defineRecipes, staticDir, command, nodeEntry, host } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
```

Full option lists: [API: Drivers](/api/drivers) · [API: Nuxt](/api/nuxt).

## staticDir

```ts
staticDir({ id: 'docs', root: resolve('./dist') })
```

## command

Placeholders: `$PORT`, `$OUT_DIR`.

```ts
command({
  id: 'spa',
  prepare: 'pnpm build --outDir $OUT_DIR',
  start: 'pnpm preview --port $PORT',
  ready: { url: 'http://127.0.0.1:$PORT/', timeout: 60_000 },
})
```

## nodeEntry

```ts
nodeEntry({ id: 'api', entry: resolve('./server.mjs') })
```

## host (remote / staging)

No local prepare — attach to a deployed URL.

```ts
host({
  id: 'staging',
  url: process.env.UNTESTUTILS_REMOTE_URL!,
  // readyTimeoutMs: 120_000,
  // readyPath: '/health',
  // skipReady: true,
})
```

```bash
UNTESTUTILS_REMOTE_URL=https://staging.example.com pnpm exec playwright test
```

Use for post-deploy smoke (e.g. `workflow_dispatch`), not every PR. Playground: `playground/playwright/remote.spec.ts`.

| Driver | Prepare | Use case |
|--------|---------|----------|
| `staticDir` / `nuxt` / `command` | yes | Local / CI e2e |
| `host` | no | Staging / prod smoke |

## nuxt

```ts
import { nuxt, matrix } from 'untestutils/nuxt'

nuxt({
  id: 'app',
  root: resolve('./fixtures/nuxt'),
  run: 'server', // 'server' | 'static' | 'dev'
  preset: 'node-server', // optional Nitro preset (part of prepare hash)
})
```

Prefer `run: 'server'` for shared e2e builds. `matrix(base, variants)` expands one fixture into many recipe ids (Nuxt merges `nuxtConfig.nitro`).

## Other frameworks

| Export | Status |
|--------|--------|
| `untestutils/vite` \| `next` \| `astro` \| `sveltekit` \| `remix` \| `solidstart` | Dogfood’d in CI |

Same Recipe idea. Each package exports `matrix()` (merges `env` / `hashInputs` / `run`, and **deep-merges** typed config overrides). Optional `workspaceDeps: true \| 'auto'` adds monorepo `packages/*/src` to the prepare hash.

### Typed config overrides

Same role as Nuxt [`nuxtConfig`](/api/nuxt): JSON-serializable patches hashed into prepare identity.

| Adapter | Option | How applied |
|---------|--------|-------------|
| `vite` / `sveltekit` / `remix` | `viteConfig` | Ephemeral `vite.untestutils.mjs` + `vite --config` (`mergeConfig`) |
| `astro` | `astroConfig` | Ephemeral `--config` + Astro `mergeConfig` |
| `solidstart` | `appConfig` | `withEphemeralFile` on `app.config.*` (TS-safe; vinxi discovers root config) |
| `next` | `nextConfig` | `withEphemeralFile` on `next.config.*` (backup → merge wrapper → restore; Next has no `--config`) |

```ts
import { vite } from 'untestutils/vite'

vite({
  id: 'spa',
  root: resolve('./fixtures/vite-spa'),
  run: 'preview',
  viteConfig: { define: { __UT_MARK__: JSON.stringify('1') } },
})
```

```ts
import { matrix } from 'untestutils/vite'

export const recipes = defineRecipes({
  ...matrix(
    { id: 'spa', root: resolve('./fixtures/vite-spa'), run: 'preview' },
    {
      default: { env: { FIXTURE: 'a' } },
      alt: { env: { FIXTURE: 'b' } },
    },
  ),
}, import.meta.url)
```

Core also exports `matrixRecipe` / `defineDriver` for custom adapters. Options: [API: Drivers](/api/drivers).

## defineRecipes

```ts
export const recipes = defineRecipes({
  site: staticDir({ id: 'site', root: resolve('./public') }),
  app: nuxt({ id: 'app', root: resolve('./fixtures/app'), run: 'server' }),
}, import.meta.url)
```

Pass `import.meta.url` so workers can re-import the module.

## Next

- [How it works](/guide/how-it-works)
- [Vitest](/guide/vitest) · [Playwright](/guide/playwright)
