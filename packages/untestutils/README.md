# untestutils

Recipe-based test harness for **Vitest** and **Playwright**: shared prepare, HTTP/static/dev/remote targets, Nuxt factory, extensible drivers, optional AI codegen, and a CLI.

**Documentation:** run `pnpm docs:dev` (VitePress site under [`docs/`](docs/)).

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

## Docs map

| Topic | Path |
|-------|------|
| Getting started | [docs/guide/getting-started.md](docs/guide/getting-started.md) |
| Concepts | [docs/guide/concepts.md](docs/guide/concepts.md) |
| Migrate from `@nuxt/test-utils` | [docs/migration/from-nuxt-test-utils.md](docs/migration/from-nuxt-test-utils.md) |
| CLI | [docs/cli/index.md](docs/cli/index.md) |
| API | [docs/api/index.md](docs/api/index.md) |

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
