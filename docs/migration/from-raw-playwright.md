---
title: Migrate from raw Playwright
description: Replace ad-hoc webServer configs with shared recipes and global setup companions.
outline: deep
---

# Migrate from raw Playwright

## Typical before

```ts
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'pnpm preview',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

Problems at scale: one server only, no shared Nuxt build cache with Vitest, awkward multi-app setups, rebuilds on every job.

## After

1. Declare recipes (`staticDir` / `nuxt` / `command` / `host`).
2. Use `createPlaywrightConfig` so global setup prepares prewarm ids.
3. `test.use({ harness: 'id' })` for `baseURL`.

```ts
import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
import { createPlaywrightConfig } from 'untestutils/playwright'
import { recipes } from './recipes'

export default defineConfig(
  createPlaywrightConfig({
    recipes,
    recipesModule: resolve('./recipes.ts'),
    prewarm: ['site'],
    testDir: './e2e',
  }),
)
```

## Multi-app

Define multiple recipe ids and switch per file:

```ts
test.use({ harness: 'admin' })
```

Each id gets its own prepare identity and host env key.

## Keep raw Playwright when…

- You only need a single static preview and no Vitest sharing.
- You are not ready to adopt recipes yet.

Otherwise prefer recipes so Vitest e2e and Playwright share one prepare pipeline.

## Next

- [Playwright guide](/guide/playwright)
- [Remote host](/guide/remote-host)
- [Drivers](/guide/drivers)
