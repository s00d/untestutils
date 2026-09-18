---
title: Drivers and recipes
description: Built-in drivers — staticDir, command, nodeEntry, host, nuxt, vite, next, astro, sveltekit, remix, solidstart.
outline: deep
---

# Drivers and recipes

Drivers are factories that return a **Recipe**. Import them from `untestutils` (or `untestutils/nuxt` for Nuxt).

```ts
import { defineRecipes, staticDir, command, nodeEntry, host } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
```

## staticDir

Serve a directory over HTTP on loopback.

```ts
staticDir({
  id: 'docs',
  root: resolve('./dist'),
})
```

## command

Shell prepare/start with placeholders:

| Token | Expands to |
|-------|------------|
| `$PORT` | Free port |
| `$OUT_DIR` | Artifact output dir |

```ts
command({
  id: 'spa',
  prepare: 'pnpm build --outDir $OUT_DIR',
  start: 'pnpm preview --port $PORT',
  ready: { url: 'http://127.0.0.1:$PORT/', timeout: 60_000 },
})
```

## nodeEntry

Spawn a Node entry file (HTTP server) with `$PORT` / env injection.

```ts
nodeEntry({
  id: 'api',
  entry: resolve('./server.mjs'),
})
```

## host

Attach to an **already running** URL — no prepare. Used for staging/prod smoke.

```ts
host({
  id: 'staging',
  url: process.env.UNTESTUTILS_REMOTE_URL!,
  // skipReady: true // if the URL is up but readiness probe should be skipped
})
```

See [Remote host](/guide/remote-host).

## nuxt

```ts
import { nuxt, matrix } from 'untestutils/nuxt'

nuxt({
  id: 'app',
  root: resolve('./fixtures/nuxt'),
  run: 'server', // 'server' | 'static' | 'dev'
  preset: 'node-server', // optional Nitro deploy preset
})
```

Builds/starts a Nuxt app as a Recipe. Prefer `run: 'server'` for e2e shared builds.

### `preset`

Passed through as `nuxtConfig.nitro.preset` and included in the prepare hash.

| Preset | Notes |
|--------|--------|
| `node-server` | Default Node listener (dogfood / local CI) |
| `azure` | Azure SWA / Functions — build smoke; host-specific start is out of scope |
| `cloudflare_module` / `cloudflare_pages` | Documented for identity/hash; use platform wrangler for full deploy e2e |

### `matrix(base, variants)`

Expand one fixture into many recipe ids (i18n-style):

```ts
export const recipes = defineRecipes({
  ...matrix(
    { id: 'basic', root: resolve('./fixtures/basic'), run: 'server' },
    {
      default: { env: { STRATEGY: 'prefix' } },
      noSsr: { env: { STRATEGY: 'prefix' }, nuxtConfig: { ssr: false } },
    },
  ),
}, import.meta.url)
// → recipes basic, basic__noSsr with distinct identity / HOST env
```

Variant key `default` keeps `base.id`; other keys become `${id}__${key}`. Merges `env`, `nuxtConfig`, `preset`, `hashInputs`. See playground `examples/matrix-recipes.ts`.

## Framework CLIs (e2e Recipes)

Shared options: `id?`, `root`, `run?`, `env?`, `hashInputs?`, `readyPath?`, `readyTimeoutMs?`.
Install the framework in the app under test (optional peers on the published package).

| Import | Default `run` | Modes |
|--------|---------------|--------|
| `untestutils/vite` | `preview` | `preview`, `dev` |
| `untestutils/next` | `server` | `server`, `dev`, `static` (`output: 'export'` → `out/`) |
| `untestutils/astro` | `preview` | `preview`, `server` (Node adapter entry), `dev` |
| `untestutils/sveltekit` | `preview` | `preview`, `server` (adapter-node), `dev` |
| `untestutils/remix` | `server` | `server` (remix-serve), `dev` |
| `untestutils/solidstart` | `preview` | `preview` / `server` (Vinxi), `dev` |

```ts
import { vite } from 'untestutils/vite'
import { next } from 'untestutils/next'
import { astro } from 'untestutils/astro'
import { sveltekit } from 'untestutils/sveltekit'
import { remix } from 'untestutils/remix'
import { solidstart } from 'untestutils/solidstart'

vite({ id: 'spa', root: resolve('./apps/spa'), run: 'preview' })
next({ id: 'web', root: resolve('./apps/web'), run: 'server' })
```

`dev` uses `share: 'never'`. Build modes share prepare cache via TargetRegistry like Nuxt.

Playground dogfood: `fixtures/vite-spa`, `next-app`, `astro-site`, `sveltekit-app`. Remix/SolidStart examples: `playground/examples/remix-solid-recipes.ts`.

## In-process unit (Nuxt)

| Import | Role |
|--------|------|
| `untestutils/config` | `defineVitestConfig` / `defineVitestProject` |
| `untestutils/runtime` | `mountSuspended`, mocks, `registerEndpoint` |
| `untestutils/module` | Required in `nuxt.config` for macros |

Keep unit env and e2e harness in **separate** Vitest configs.

## defineRecipes

```ts
export const recipes = defineRecipes({
  site: staticDir({ id: 'site', root: '…' }),
  app: nuxt({ id: 'app', root: '…', run: 'server' }),
})
```

Ids must be unique. Use the same string in `prewarm`, `useHarness('id')`, and `test.use({ harness: 'id' })`.

## Next

- [Extending](/guide/extending) — custom `defineDriver`
- [API: Drivers](/api/drivers)
- [API: Nuxt](/api/nuxt)
