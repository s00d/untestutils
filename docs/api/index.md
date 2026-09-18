---
title: API overview
description: Public package exports for the untestutils facade.
outline: deep
---

# API overview

Public npm package: **`untestutils`**. Private workspace packages (`@untestutils/*`) are implementation details.

## Export map

| Subpath | Purpose |
|---------|---------|
| `untestutils` | Core + drivers (`defineRecipes`, `staticDir`, `host`, …) |
| `untestutils/vitest` | Specs: `test`, `useHarness`, fixtures |
| `untestutils/vitest/plugin` | Vitest config plugin |
| `untestutils/vitest/global-setup` | Companion (injected) |
| `untestutils/vitest/setup-file` | Companion (injected) |
| `untestutils/playwright` | Playwright helpers + `test` |
| `untestutils/playwright/pw-global-setup` | Companion |
| `untestutils/playwright/pw-global-teardown` | Companion |
| `untestutils/nuxt` | `nuxt({ run })` |
| `untestutils/command` | `command` driver only |
| `untestutils/ai` | Codegen |
| `untestutils/vite` \| `next` \| `astro` \| `sveltekit` | Stubs |
| `untestutils/config` \| `runtime` \| `module` | v0.2 stubs / placeholders |

CLI binary: `untestutils` → see [CLI](/cli/).

## Pages

- [Core](/api/core)
- [Vitest](/api/vitest)
- [Playwright](/api/playwright)
- [Drivers](/api/drivers)
- [Nuxt](/api/nuxt)
- [AI](/api/ai)
