[![npm version](https://img.shields.io/npm/v/untestutils/latest?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![npm downloads](https://img.shields.io/npm/dw/untestutils?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![License](https://img.shields.io/npm/l/untestutils?style=for-the-badge)](https://github.com/s00d/untestutils/blob/master/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/s00d/untestutils/ci.yml?branch=master&style=for-the-badge&label=CI)](https://github.com/s00d/untestutils/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-2ea44f?style=for-the-badge)](https://s00d.github.io/untestutils/)
[![Donate](https://img.shields.io/badge/Donate-Donationalerts-ff4081?style=for-the-badge)](https://www.donationalerts.com/r/s00d88)

<p align="center">
  <img src="docs/public/logo.svg" alt="untestutils" width="160">
</p>

# untestutils

Recipe-based test harness for **Vitest** and **Playwright**. Define how an app is prepared and started once (`Recipe`), share that prepare across files, and assert over HTTP, static files, or a browser — without reinventing setup for every suite.

Built for e2e and integration work: Nuxt and static sites, remote hosts, optional AI codegen (`fix` / `cover` / `generate`), and a small CLI.

## Why untestutils?

Typical Vitest/Playwright setups either restart the app per file or glue fragile global hooks. `untestutils` centers on a single contract:

- **Recipe** — `prepare?` → `start` → `{ url }` and/or `{ dir }`
- **Harness** — `useHarness('id')` / Playwright `test.use({ harness })`
- **Drivers** — thin factories (`staticDir`, `command`, `nuxt`, …), not a preset zoo

Shared prepare cache, readiness, and teardown stay in one place. Migrate from `@nuxt/test-utils` when you outgrow its setup model.

## Key Features

- 🧩 **Recipes, not presets** — compose targets; Nuxt is a factory, not a special universe
- 🧰 **Utils** — cookies, SEO head parse, domain emulation, redirect tracking, poll (`untestutils/utils`)
- ⚡ **Shared prepare** — warm once, reuse across Vitest workers / Playwright projects
- 🧪 **Vitest + Playwright** — same recipe ids; fixtures `page` / `goto` / `$fetch`
- 🌐 **Remote `host()`** — hit a deployed URL without local prepare
- 🛠 **CLI** — `init`, `doctor`, AI `fix` / `cover` / `ai`, monorepo helpers
- 🤖 **Optional AI** — generate, convert, fix, and cover tests with shared fs/browser tools

## Quick Setup

```bash
pnpm add -D untestutils vitest
# optional
pnpm add -D @playwright/test playwright-core

pnpm dlx untestutils init --preset vitest
```

```ts
// recipes.ts
import { defineRecipes, staticDir } from 'untestutils'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  site: staticDir({ id: 'site', root: resolve('./fixtures/static') }),
})
```

```ts
// vitest.config.ts — import plugin from untestutils/vitest/plugin
import { defineConfig } from 'vitest/config'
import { untestutils } from 'untestutils/vitest/plugin'
import { recipes } from './recipes'

export default defineConfig({
  plugins: [
    untestutils({
      recipes,
      prewarm: ['site'],
    }),
  ],
  test: { include: ['tests/e2e/**/*.test.ts'] },
})
```

```ts
// tests/e2e/home.test.ts — specs import from untestutils/vitest
import { describe, test, expect, useHarness } from 'untestutils/vitest'

describe('home', () => {
  test('html', async () => {
    const app = await useHarness('site')
    expect(await app.$fetch('/')).toContain('</html>')
  })
})
```

## Links

- [Docs](https://s00d.github.io/untestutils/)
- [Getting started](https://s00d.github.io/untestutils/guide/getting-started)
- [Concepts](https://s00d.github.io/untestutils/guide/concepts)
- [Vitest](https://s00d.github.io/untestutils/guide/vitest)
- [Playwright](https://s00d.github.io/untestutils/guide/playwright)
- [Migration from @nuxt/test-utils](https://s00d.github.io/untestutils/migration/from-nuxt-test-utils)
- [CLI](https://s00d.github.io/untestutils/cli/)
- [API](https://s00d.github.io/untestutils/api/)

## License

[MIT](./LICENSE)
