---
title: Core API
description: defineRecipes, useHarness, types, and artifact helpers.
outline: deep
---

# Core API

Import from `untestutils` (re-exports `@untestutils/core` + drivers).

## defineRecipes / defineRecipe

```ts
import { defineRecipes, defineRecipe } from 'untestutils'

export const recipes = defineRecipes({
  site: /* Recipe */,
})

const inline = defineRecipe({
  id: 'inline',
  start: async () => ({ kind: 'url', url: 'http://127.0.0.1:3000/', stop: async () => {} }),
})
```

### Recipe fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string?` | Required when registered by name |
| `prepare` | `(ctx) => Promise<void>` | Optional build step |
| `start` | `(ctx) => Promise<Running>` | Required |
| `ready` | ready options / fn | Optional HTTP gate |
| `hashInputs` | inputs for identity | Optional |
| `share` | share policy | Optional |

`Running`: `{ kind: 'url', url, stop }` and/or `{ kind: 'dir', dir }`.

## useHarness

```ts
import { useHarness } from 'untestutils'
// or from 'untestutils/vitest'

const app = await useHarness('site')
```

### HarnessHandle

| Member | Notes |
|--------|-------|
| `url?` | Base URL when running a server |
| `dir?` | Directory when kind includes dir |
| `$fetch` | ofetch against `url` |
| `files.read/exists/list` | Read fixture/output files |
| `dispose?` | Optional cleanup |

Also: `getCurrentHarness()`, `getHarness(id)`, `ensurePrepared()`, `stopAllTargets()`.

## Utilities (selected)

`resolveArtifactsRoot`, `normalizeBaseUrl`, `LOOPBACK_HOST`, `getFreePort`, `waitForHttpReady`, `contentHash`, `FileLock`, `TargetRegistry`, `ArtifactStore`, `envFlag`, `debug`, `SCHEMA_VERSION`.

## Next

- [Concepts](/guide/concepts)
- [Drivers API](/api/drivers)
