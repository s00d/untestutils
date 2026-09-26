---
title: Vitest
description: Plugin, prewarm, useHarness, and browser fixtures.
outline: deep
---

# Vitest

## Plugin vs barrel

::: warning
Config: `untestutils/vitest/plugin`. Specs: `untestutils/vitest`. Do not load the barrel in config.
:::

## Plugin options

```ts
untestutils({
  recipes,              // from defineRecipes(..., import.meta.url)
  prewarm: ['site'],
  browsers: ['chromium'],
  artifactsRoot: undefined,
})
```

| Option | Notes |
|--------|--------|
| `recipes` | Map from your recipes module |
| `prewarm` | Ids to prepare/start in global setup |
| `browsers` | Engines for `page` / `goto` (default `['chromium']`) |
| `artifactsRoot` | Sets `UNTESTUTILS_ARTIFACTS_DIR` |

Override engine per run: `UNTESTUTILS_BROWSER=firefox`.

## useHarness

```ts
const app = await useHarness('site')
await app.$fetch('/')
app.url
app.dir
await app.files.read('index.html')
```

Prefer registered **ids** so Vitest and Playwright share the prepare cache.

## Fixtures

| Fixture | Role |
|---------|------|
| `harness` | Recipe id via `test.override({ harness })` |
| `browserName` | `chromium` \| `firefox` \| `webkit` |
| `baseURL` | Current harness URL |
| `page` | Playwright `Page` |
| `goto` | `page.goto` (+ Nuxt `waitUntil: 'hydration' \| 'route'`) |
| `request` | APIRequestContext |

```ts
import { describe, test, expect } from 'untestutils/vitest'

describe('ui', () => {
  test.override({ harness: 'site' })

  test('home', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await expect(page.getByRole('heading')).toBeVisible()
  })
})
```

Ensure `useHarness` or `prewarm` started the target so `baseURL` resolves.

## Unit environments (multi-framework)

`environment: 'untestutils'` is a **router** (`vitest-environment-untestutils`) that loads `@untestutils/<framework>/environment`.

```ts
// Vite example — same pattern for next / astro / sveltekit / remix / solidstart
import { defineVitestProject } from '@untestutils/vite/config'

export default defineVitestProject({
  test: {
    environmentOptions: {
      untestutils: {
        framework: 'vite', // set automatically by defineVitestProject
        appIsolation: 'worker', // opt-in; soft reset between tests
        domEnvironment: 'happy-dom',
      },
    },
  },
})
```

| Option | Notes |
|--------|--------|
| `untestutils.framework` | `nuxt` \| `vite` \| `next` \| `astro` \| `sveltekit` \| `remix` \| `solidstart` |
| Legacy `environmentOptions.nuxt` | Still resolves Nuxt (no `framework` required) |
| Shared DOM | `@untestutils/vitest/unit-dom` |
| Lifecycle | `@untestutils/vitest/unit-lifecycle` (`registerSetupEntry`, host reset) |

Contract helpers (where the adapter exports them): `setupApp` / `resetSharedApp` / `restartSharedApp` / mount helper. Nuxt also keeps `resetSharedNuxtApp` / `restartSharedNuxtApp` and aliases `resetSharedApp` / `restartSharedApp`.

Honest boundaries (client unit ≠ full SSR): Next/Remix — no RSC/loader SSR; SvelteKit — no load/actions; SolidStart — no Vinxi SSR; Astro — island/container only. Status: [Support matrix](/guide/support-matrix).

E2e plugin and unit env still do **not** share one Vitest project.

## Nuxt unit (separate project)

E2e plugin and Nuxt unit env do **not** share one Vitest config:

- E2e: `untestutils/vitest/plugin`
- Unit: `environment: 'untestutils'` + `untestutils/config` / `untestutils/runtime` (or `@untestutils/nuxt/config`)

See [API overview](/api/) (`config`, `runtime`, `module`).

### `appIsolation: 'worker'` (opt-in)

Today this surface is the **Nuxt unit adapter** (`environment: 'untestutils'`). Framework-agnostic hooks live in `@untestutils/vitest/unit-lifecycle` (`registerSetupEntry`, `disposeBestEffort`, host/timers reset, `applyWorkerIsolationDefaults`) so future unit environments can reuse the same worker/file lifecycle without Nuxt imports.

By default each unit file pays for a full `setupNuxt()` boot. For large component suites, reuse one Nuxt app per Vitest worker:

```ts
export default defineVitestProject({
  test: {
    environment: 'untestutils',
    pool: 'threads',
    environmentOptions: {
      nuxt: {
        appIsolation: 'worker', // auto-sets isolate: false when unset
        // resetBetweenTests: true  // default in worker mode
      },
    },
  },
})
```

| | Default `file` | `worker` |
|--|--|--|
| `setupNuxt` | once per test file (remounts even with `isolate: false`) | once per Vitest worker |
| `isolate` | Vitest default (`true`) | `false` (auto) |
| State between files | fresh window / remount | shared app — soft-reset between tests |
| Soft reset | n/a | `resetSharedNuxtApp` (auto when `resetBetweenTests`) |

`resetSharedNuxtApp` (also run automatically after each test when `resetBetweenTests` is on) clears route/state/data/errors, VTU mounts, `registerEndpoint` handlers, **cookies**, **localStorage/sessionStorage**, **fake timers**, and **Vitest env/global stubs**. Opt out per layer: `resetSharedNuxtApp({ host: false, timers: false, stubs: false })`. Custom cleanups: `registerSharedNuxtReset(fn)`.

After Vite HMR / full reload in watch, call `restartSharedNuxtApp()` (or rely on `enableSharedNuxtHotRestart`, registered automatically in worker mode) to invalidate the memoized boot.

Per-file `mockNuxtImport` after the shared boot is unreliable; prefer worker-level wrappers + `clearNuxtImportMocks()` when needed (`mocks` stay off in the default reset).

### Alignment with nuxt/test-utils

| Concern | [PR #1821](https://github.com/nuxt/test-utils/pull/1821) | [#1750](https://github.com/nuxt/test-utils/issues/1750) | untestutils |
|--|--|--|--|
| Memoize `setupNuxt` | always (window promise) | opt-in `appIsolation: 'worker'` | **opt-in** `appIsolation: 'worker'` |
| Soft reset API | docs caveat only | route/state/host checklist | **shipped** (`resetSharedNuxtApp` + host/timers/stubs) |
| Browser entry | `setupWindow` + promise + skip node entry | n/a | same shape + worker-aware `registerNuxtSetupEntry` |

Keep the Vitest project **homogeneous** (`environment: 'untestutils'` only). Mixing `@vitest-environment node` in the same project tears the DOM env down between files and kills reuse.

Measured on this repo (`pnpm test:unit-bench`, 12 files, `maxWorkers: 1`, mean-of-3): file-scoped **~9.6 s** vs worker-scoped **~2.8 s** (~3.5×). See `playground/unit-bench/results.json`.

## Next

- [Playwright](/guide/playwright)
- [Utils](/guide/utils)
- [API: Vitest](/api/vitest)
