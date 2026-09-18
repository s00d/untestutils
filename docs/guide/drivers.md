---
title: Drivers and recipes
description: Built-in drivers — staticDir, command, nodeEntry, host, nuxt — and stub status for other frameworks.
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
import { nuxt } from 'untestutils/nuxt'

nuxt({
  id: 'app',
  root: resolve('./fixtures/nuxt'),
  run: 'server', // 'server' | 'static' | 'dev'
})
```

Builds/starts a Nuxt app as a Recipe. Prefer `run: 'server'` for e2e shared builds.

## Stubs (not implemented yet)

| Import | Status |
|--------|--------|
| `untestutils/vite` | throws `notImplemented` |
| `untestutils/next` | throws |
| `untestutils/astro` | throws |
| `untestutils/sveltekit` | throws |
| `untestutils/config` | v0.2 — `defineVitestConfig` |
| `untestutils/runtime` | v0.2 — `mountSuspended` |

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
