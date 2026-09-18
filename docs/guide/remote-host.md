---
title: Remote host
description: Post-deploy smoke tests with host() and UNTESTUTILS_REMOTE_URL.
outline: deep
---

# Remote host

Use `host()` when the app is **already deployed**. There is no local `prepare` — untestutils only waits for readiness (unless skipped) and exposes the URL to specs.

## Recipe

```ts
import { defineRecipes, host } from 'untestutils'

export const recipes = defineRecipes({
  staging: host({
    id: 'staging',
    url: process.env.UNTESTUTILS_REMOTE_URL!,
  }),
})
```

Optional: `skipReady: true` if the readiness probe should be skipped (for example when only a subset of routes is up).

## Playwright

```bash
UNTESTUTILS_REMOTE_URL=https://staging.example.com pnpm exec playwright test
```

Point `test.use({ harness: 'staging' })` at the host recipe. See the monorepo playground: `playground/playwright/remote.spec.ts`.

## CI pattern

Run remote smoke on **workflow_dispatch** (or after deploy), not on every PR:

1. Build and deploy.
2. Dispatch CI with `remote_url` input.
3. Playwright job sets `UNTESTUTILS_REMOTE_URL` and runs the remote project.

## Vs staticDir / nuxt

| Driver | Prepare | Use case |
|--------|---------|----------|
| `staticDir` / `nuxt` / `command` | yes | Local / CI e2e |
| `host` | no | Staging / prod smoke |

## Next

- [Playwright](/guide/playwright)
- [Drivers](/guide/drivers)
- [Examples](/examples)
