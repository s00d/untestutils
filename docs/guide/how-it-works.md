---
title: How it works
description: Recipe lifecycle, artifacts, identity cache, and import map.
outline: deep
---

# How it works

```mermaid
flowchart LR
  recipes[recipes.ts] --> prepare[prepare optional]
  prepare --> artifacts[.untestutils/builds]
  artifacts --> start[start]
  start --> running[Running url / dir]
  running --> harness[useHarness]
  harness --> specs[Vitest / Playwright]
```

## Terms

| Term | Meaning |
|------|---------|
| **Recipe** | Optional `prepare`, required `start`, optional `ready` / `share` / `hashInputs` |
| **Driver** | Factory that returns a Recipe (`staticDir`, `nuxt`, `host`, …) |
| **Running** | `{ kind: 'url', url, stop }` and/or `{ kind: 'dir', dir }` |
| **HarnessHandle** | `url?`, `dir?`, `$fetch`, `files.*` |
| **Identity** | Hash of recipe id + inputs → cache key under `.untestutils` |

## Lifecycle

1. **Register** — `defineRecipes({ … }, import.meta.url)`
2. **Prepare** (optional) — build into an artifact dir; skipped when cache is warm
3. **Start** — local server, dir, or remote URL
4. **Ready** — HTTP (or custom) gate
5. **Teardown** — stop processes; clear registry

Local servers bind to **`127.0.0.1`**.

## Shared prepare (speed)

Prepare outputs live under `.untestutils/builds`, keyed by identity. Parallel workers take a file lock so they do not corrupt the same build. Running URLs are registered for Playwright/Vitest (`UNTESTUTILS_HOST_<ID>`).

| Env | Effect |
|-----|--------|
| `UNTESTUTILS_SHARE=0` | Disable sharing |
| `UNTESTUTILS_DEBUG=1` | Verbose logs |
| `UNTESTUTILS_ARTIFACTS_DIR` | Custom artifacts root |
| `UNTESTUTILS_SESSION` | Playwright session namespace (see [Playwright](/guide/playwright)) |

**CI:** cache `.untestutils/` when inputs are stable; use `prewarm`; always tear down.

## Imports

| Import | Use in |
|--------|--------|
| `untestutils` | `defineRecipes`, drivers |
| `untestutils/vitest/plugin` | Vitest **config** only |
| `untestutils/vitest` | Specs |
| `untestutils/playwright` | Playwright config + specs |
| `untestutils/nuxt` | `nuxt({ run })` |
| `untestutils/utils` | Cookies, SEO, poll, … |

## Next

- [Drivers](/guide/drivers)
- [Vitest](/guide/vitest)
- [API: Core](/api/core)
