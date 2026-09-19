---
title: Migrate from raw Playwright
description: Replace webServer configs with shared recipes.
outline: deep
---

# Migrate from raw Playwright

## Before

```ts
export default defineConfig({
  webServer: {
    command: 'pnpm preview',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

One server, no shared Nuxt build cache with Vitest, awkward multi-app, rebuilds every job.

## After

1. Recipes (`staticDir` / `nuxt` / `command` / `host`)
2. `createPlaywrightConfig` + `prewarm`
3. `test.use({ harness: 'id' })`

```ts
import { defineConfig } from '@playwright/test'
import { createPlaywrightConfig } from 'untestutils/playwright'
import { recipes } from './recipes'

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    session: 'app-pw',
    prewarm: ['site'],
    testDir: './e2e',
  }),
)
```

Multi-app: multiple recipe ids + `projects` / `test.use({ harness })`. Remote: `host()` + `UNTESTUTILS_REMOTE_URL`.

## Next

- [Playwright](/guide/playwright)
- [Drivers](/guide/drivers)
