[![npm version](https://img.shields.io/npm/v/untestutils/latest?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![npm downloads](https://img.shields.io/npm/dw/untestutils?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![License](https://img.shields.io/npm/l/untestutils?style=for-the-badge)](https://github.com/s00d/untestutils/blob/master/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/s00d/untestutils/ci.yml?branch=master&style=for-the-badge&label=CI)](https://github.com/s00d/untestutils/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-2ea44f?style=for-the-badge)](https://s00d.github.io/untestutils/)
[![Donate](https://img.shields.io/badge/Donate-Donationalerts-ff4081?style=for-the-badge)](https://www.donationalerts.com/r/s00d88)

<p align="center">
  <img src="https://s00d.github.io/untestutils/logo.svg" alt="untestutils" width="140">
</p>

# untestutils

**Docs:** https://s00d.github.io/untestutils/

**Test the product the way it actually runs** — not a mock of a mock of a framework.

Most “test utils” help you write *more* tests. `untestutils` changes *what* you test: the same prepare → start → URL/dir path your users hit, with real cookies, SEO headers, redirects, locale payloads, and browser behavior — shared once across Vitest and Playwright.

<p align="center">
  <img src="https://raw.githubusercontent.com/s00d/untestutils/master/docs/public/demo.gif" alt="untestutils: prepare once, assert against a live app" width="640">
</p>

## The idea

Shipping software is not “a component mounted in happy-dom”. It is:

- a **built** (or generated) app
- a **running** process on a real URL
- **data and side effects** that only appear after prepare/start (i18n merges, cookies, sitemap, Nitro routes, …)

If your suite never walks that path, you are testing a parallel universe. Failures show up in staging instead.

`untestutils` is a harness around one contract:

```text
Recipe  →  prepare?  →  start  →  { url } and/or { dir }
Harness →  useHarness('id')  /  Playwright test.use({ harness })
```

You describe **how the real target comes up**. Specs assert against that live target. Prepare is cached and shared — so “test like production” stays fast enough for CI.

## Why not “just helpers”?

| Usual approach | With untestutils |
| --- | --- |
| Restart / re-mock the app per file | One prepare, many files |
| Framework-special APIs that hide the URL | Same Recipe ids in Vitest **and** Playwright |
| Assert on stubs and fixtures only | Assert on live `$fetch`, `page`, SEO, cookies, redirects |
| Glue globalSetup / webServer by hand | Drivers (`nuxt`, `vite`, `next`, `staticDir`, `command`, `host`, …) |

Utils (`untestutils/utils`) exist, but they are tools for **real-runtime** checks — not a second testing philosophy.

## What you get

- **Recipes, not preset zoos** — compose targets; Nuxt is a factory, not a special universe
- **Shared prepare** — warm once, reuse across workers / projects
- **Vitest + Playwright** — same ids; fixtures `page` / `goto` / `$fetch`
- **Remote `host()`** — post-deploy smoke against staging/prod
- **Reality-oriented utils** — cookies, SEO head, domain emulation, redirect tracking, poll
- **CLI** — `init`, `doctor`, optional AI `fix` / `cover` / `generate`
- **Perf suite** — build + load against the same recipe mindset (`untestutils/perf`)
- **Support matrix** — what is stable in CI vs optional / out of 1.0

## Quick start

```bash
pnpm add -D untestutils vitest
# optional
pnpm add -D @playwright/test playwright-core

pnpm dlx untestutils init --preset vitest
```

```ts
// recipes.ts — how the real app comes up
import { defineRecipes } from 'untestutils'
import { nuxt } from 'untestutils/nuxt'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  basic: nuxt({
    id: 'basic',
    root: resolve('./fixtures/basic'),
    run: 'server',
  }),
}, import.meta.url)
```

```ts
// vitest.config.ts — plugin from untestutils/vitest/plugin
import { defineConfig } from 'vitest/config'
import { untestutils } from 'untestutils/vitest/plugin'
import { recipes } from './recipes'

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['basic'],
    }),
  ],
  test: { include: ['tests/e2e/**/*.test.ts'] },
})
```

```ts
// tests/e2e/locale.test.ts — specs from untestutils/vitest
import { describe, test, expect, useHarness } from 'untestutils/vitest'
import { setLocaleCookie, getLocaleCookie } from 'untestutils/utils'

describe('locale', () => {
  test('cookie survives reload on the live app', async ({ page }) => {
    const app = await useHarness('basic')
    await page.goto(app.url)
    await setLocaleCookie(page, 'de')
    await page.reload()
    expect(await getLocaleCookie(page)).toBe('de')
  })
})
```

Same Recipe id works from Playwright via `createPlaywrightConfig` — one definition of “how the app runs”, two runners.

## Links

- [Docs](https://s00d.github.io/untestutils/)
- [Why](https://s00d.github.io/untestutils/why) · [Getting started](https://s00d.github.io/untestutils/guide/getting-started)
- [How it works](https://s00d.github.io/untestutils/guide/how-it-works)
- [Support matrix](https://s00d.github.io/untestutils/guide/support-matrix)
- [Vitest](https://s00d.github.io/untestutils/guide/vitest) · [Playwright](https://s00d.github.io/untestutils/guide/playwright)
- [Migration from @nuxt/test-utils](https://s00d.github.io/untestutils/migration/from-nuxt-test-utils)
- [CLI](https://s00d.github.io/untestutils/cli/) · [API](https://s00d.github.io/untestutils/api/)
- [Roadmap](https://s00d.github.io/untestutils/roadmap) · [CONTRIBUTING](https://github.com/s00d/untestutils/blob/master/CONTRIBUTING.md)

## License

[MIT](https://github.com/s00d/untestutils/blob/master/LICENSE)
