# untestutils

Recipe-based test harness for **Vitest** and **Playwright**: shared prepare, HTTP/static/dev/remote targets, Nuxt factory, extensible drivers, optional AI codegen, and a CLI.

**Docs:** https://s00d.github.io/untestutils/

## Install

```bash
pnpm add -D untestutils vitest
# optional
pnpm add -D @playwright/test playwright-core nuxt
```

Scaffold:

```bash
pnpm dlx untestutils init --preset vitest
pnpm dlx untestutils doctor
```

## Quick start

```ts
// recipes.ts
import { defineRecipes, staticDir } from 'untestutils'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  site: staticDir({ id: 'site', root: resolve('./fixtures/static') }),
})
```

```ts
// vitest.config.ts
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
// tests/e2e/home.test.ts
import { describe, test, expect, useHarness } from 'untestutils/vitest'

describe('home', () => {
  test('html', async () => {
    const app = await useHarness('site')
    expect(await app.$fetch('/')).toContain('</html>')
  })
})
```

> Config: `untestutils/vitest/plugin`. Specs: `untestutils/vitest`.

## Docs

Site: https://s00d.github.io/untestutils/

| Topic | Link |
|-------|------|
| Getting started | https://s00d.github.io/untestutils/guide/getting-started |
| Concepts | https://s00d.github.io/untestutils/guide/concepts |
| Migrate from `@nuxt/test-utils` | https://s00d.github.io/untestutils/migration/from-nuxt-test-utils |
| CLI | https://s00d.github.io/untestutils/cli/ |
| API | https://s00d.github.io/untestutils/api/ |

## Develop

```bash
pnpm install
pnpm run build
pnpm run docs:dev
pnpm run preflight
```

## Roadmap

| Version | Scope |
|---------|--------|
| 0.1 | Harness, drivers, Nuxt, Vitest/Playwright, remote `host`, CLI, AI |
| 0.2 | Nuxt in-process (`mountSuspended`, config helpers) |
| 0.3 | Deeper AI workflows |

## License

MIT
