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
  run: 'server', // default — omit or set explicitly
  preset: 'node-server', // optional Nitro preset (part of prepare hash)
})
```

### `run` modes (Nuxt)

| Mode | What it does | Share | Use when |
|------|----------------|-------|----------|
| **`server` (default)** | `buildNuxt` → Nitro `node` | `always` | **Normal e2e / CI** — real production-like build |
| **`static`** | `nuxi generate` → static dir | `always` | SSG / `output: 'static'` fixtures |
| **`dev`** | `nuxi _dev` only (no prepare) | `never` | **Niche only** — HMR / file-watcher specs that must mutate sources live |

Do **not** pick `run: 'dev'` to “skip the build” or speed up CI. It disables shared prepare (the whole point of the harness), drifts under HMR, and does not match production. Keep it for the rare suite that *asserts* hot reload (e.g. translation watcher). Everyone else: `server` (or `static`).

`matrix(base, variants)` expands one fixture into many recipe ids (Nuxt merges `nuxtConfig.nitro`).

## Other frameworks

| Export | Status |
|--------|--------|
| `untestutils/vite` \| `next` \| `astro` \| `sveltekit` \| `remix` \| `solidstart` | Dogfood’d in CI |

Same Recipe idea. **Stable** run modes are exactly those listed in [Support matrix — E2e run modes](/guide/support-matrix#e2e-run-modes) (each has a playground recipe + `e2e/<fw>/*.spec.ts` + `pnpm test:playground`). SolidStart `run: 'server'` is **Experimental** until vinxi server dogfood is reliable — use `preview` for built mode.

`run: 'dev'` is dogfood’d for every Stable adapter (`share: 'never'`, short home-URL smoke). Prefer built modes (`preview` / `server` / `static`) for normal CI suites; keep `dev` for HMR / live-mutation specs.

Each package exports `matrix()` (merges `env` / `hashInputs` / `run`, and **deep-merges** typed config overrides). Optional `workspaceDeps: true \| 'auto'` adds monorepo `packages/*/src` **and** workspace-root `src/` (when present) to the prepare hash — so module packages that live outside `packages/` still invalidate e2e caches.

### Typed config overrides

Same role as Nuxt [`nuxtConfig`](/api/nuxt): **JSON-serializable** patches hashed into prepare identity.

::: tip Serialization
Overrides are stringified into the prepare hash and into ephemeral merge modules. Stick to plain data (`define`, `env`, nested objects/arrays). **Functions, classes, and `Symbol`s are not supported** — wrap those in your own ephemeral config file if you need them.
:::

| Adapter | Option | How applied |
|---------|--------|-------------|
| `vite` / `remix` (vite branches) | `viteConfig` | Programmatic Vite JS API (`createServer` / `build` / `preview`) + ephemeral merge config |
| `sveltekit` | `viteConfig` / `kitConfig` | Vite CLI (subprocess cwd); `kitConfig` via `withMergedConfigOverride` |
| `astro` | `astroConfig` | Programmatic `astro` `dev` / `build` / `preview` + ephemeral merge config |
| `solidstart` | `appConfig` | `withEphemeralFile` on `app.config.*` (TS-safe; vinxi discovers root config) |
| `next` | `nextConfig` | `withEphemeralFile` on `next.config.*` (backup → merge wrapper → restore; Next build stays CLI) |

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
// → recipes: spa, spa__alt  (id + `__` + variant name)
```

### `matrix()` vs explicit `app()` ids

- Use **`matrix()`** when variants share one base and differ by `env` / config overrides — ids become `id__variant` (e.g. `spa__alt`). Fine for strategy matrices.
- Prefer **explicit** `vite({ id: 'spa-no-prefix', … })` (or `app('…')` style) when harness ids are part of test contracts, CI filters, or docs — avoid inventing consumer-side merge helpers that reimplement `matrix`.

`listRegisteredRecipes()` (core) and `untestutils doctor --recipes` list what is registered.

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
