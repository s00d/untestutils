---
title: API overview
description: Public package export map.
outline: deep
---

# API overview

Packages are **lockstep-versioned**. Prefer scoped imports; the `untestutils` facade re-exports the same APIs for compatibility.

| Install | Import |
|---------|--------|
| `untestutils` + `@untestutils/vitest` | Core drivers + Vitest |
| `@untestutils/playwright` | Playwright helpers |
| `@untestutils/nuxt` (etc.) | Framework factories only when needed |

## Export map (facade subpaths ≈ scoped packages)

| Facade / scoped | Purpose |
|-----------------|---------|
| `untestutils` / `@untestutils/core` | `defineRecipes`, drivers |
| `untestutils/vitest` / `@untestutils/vitest` | Specs: `test`, `useHarness`, fixtures |
| `untestutils/vitest/plugin` / `@untestutils/vitest/plugin` | Vitest config plugin |
| `untestutils/playwright` / `@untestutils/playwright` | Config helpers + `test` |
| `untestutils/nuxt` / `@untestutils/nuxt` | `nuxt({ run })`, `matrix` (nitro-aware) |
| `untestutils/utils` / `@untestutils/utils` | Cookies, SEO, poll, … |
| `untestutils/perf` / `@untestutils/perf` | Build/load suite (**optional peer**) |
| `untestutils/ai` / `@untestutils/ai` | Codegen (**optional peer**) |
| `untestutils/vite` \| `next` \| `astro` \| … | Framework factories + `matrix` (`@untestutils/<name>`) |
| `untestutils/config` / `@untestutils/nuxt/config` | Nuxt unit Vitest helpers |
| `untestutils/runtime` / `@untestutils/nuxt/runtime` | `mountSuspended`, mocks, … |
| `untestutils/module` / `@untestutils/nuxt/module` | Nuxt module for unit env |
| `untestutils/vitest-environment` | `environment: 'untestutils'` |

## Package migration (0.5)

| Was | Now |
|-----|-----|
| `@untestutils/drivers` | `@untestutils/core` (also `./drivers`) |
| `@untestutils/runtime` | `@untestutils/nuxt/runtime` |
| `@untestutils/config` | `@untestutils/nuxt/config` |
| `@untestutils/module` | `@untestutils/nuxt/module` |

Facade subpaths (`untestutils/runtime`, `untestutils/config`, `untestutils/module`, …) are unchanged. Framework adapters (`@untestutils/vite`, `next`, …) stay separate packages.

Companions (`*/global-setup`, `*/setup-file`, `pw-global-*`) are injected by plugins — you rarely import them.

CLI: [Commands](/cli/) (`@untestutils/cli` via `untestutils` bin).
