[![npm version](https://img.shields.io/npm/v/untestutils/latest?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![npm downloads](https://img.shields.io/npm/dw/untestutils?style=for-the-badge)](https://www.npmjs.com/package/untestutils)
[![License](https://img.shields.io/npm/l/untestutils?style=for-the-badge)](https://github.com/s00d/untestutils/blob/master/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/s00d/untestutils/ci.yml?branch=master&style=for-the-badge&label=CI)](https://github.com/s00d/untestutils/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-2ea44f?style=for-the-badge)](https://s00d.github.io/untestutils/)

<p align="center">
  <img src="docs/public/logo.svg" alt="untestutils" width="140">
</p>

# untestutils

**Test the live app** — prepare → start → URL — shared across Vitest and Playwright. Shared prepare stays fast enough for CI.

**Docs:** [Why](https://s00d.github.io/untestutils/why) · [Get started](https://s00d.github.io/untestutils/guide/getting-started) · [Roadmap](https://s00d.github.io/untestutils/roadmap) · [Full site](https://s00d.github.io/untestutils/)

```bash
pnpm add -D untestutils vitest
pnpm dlx untestutils init --preset vitest
```

```ts
// recipes.ts
import { defineRecipes, staticDir } from 'untestutils'
import { resolve } from 'node:path'

export const recipes = defineRecipes({
  site: staticDir({ id: 'site', root: resolve('./fixtures/static') }),
}, import.meta.url)
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { untestutils } from 'untestutils/vitest/plugin'
import { recipes } from './recipes'

export default defineConfig({
  plugins: [untestutils({ recipes, prewarm: ['site'] })],
})
```

```ts
// tests/e2e/home.test.ts
import { test, expect, useHarness } from 'untestutils/vitest'

test('serves HTML', async () => {
  const app = await useHarness('site')
  expect(await app.$fetch('/')).toContain('</html>')
})
```

## Links

- [How it works](https://s00d.github.io/untestutils/guide/how-it-works)
- [Vitest](https://s00d.github.io/untestutils/guide/vitest) · [Playwright](https://s00d.github.io/untestutils/guide/playwright)
- [Migrate from @nuxt/test-utils](https://s00d.github.io/untestutils/migration/from-nuxt-test-utils)
- [Roadmap](https://s00d.github.io/untestutils/roadmap)
- [CONTRIBUTING](CONTRIBUTING.md)

## License

MIT
