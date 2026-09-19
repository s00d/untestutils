---
title: Core API
description: defineRecipes, useHarness, Recipe fields.
outline: deep
---

# Core API

Import from `untestutils`.

## defineRecipes / defineRecipe

```ts
export const recipes = defineRecipes({
  site: /* Recipe */,
}, import.meta.url)
```

| Field | Notes |
|-------|--------|
| `id` | Set when registering by key |
| `prepare?` | Build into artifact dir |
| `start` | Required → `Running` |
| `ready?` | HTTP / custom gate |
| `hashInputs?` | Identity inputs |
| `share?` | Share policy |

`Running`: `{ kind: 'url', url, stop }` and/or `{ kind: 'dir', dir }`.

## useHarness

```ts
const app = await useHarness('site')
// app.url, app.dir, app.$fetch, app.files.*
```

Also: `getCurrentHarness()`, `ensurePrepared()`, `stopAllTargets()`, `resolveArtifactsRoot()`, `waitForHttpReady()`, `TargetRegistry`, `SCHEMA_VERSION`.

See [How it works](/guide/how-it-works) · [Drivers API](/api/drivers).
