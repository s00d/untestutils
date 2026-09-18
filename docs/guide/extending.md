---
title: Extending
description: Add a custom Driver with defineDriver without importing frameworks into core.
outline: deep
---

# Extending

`@untestutils/core` stays **framework-free**. New frameworks belong in Driver packages.

## Checklist

1. Implement a Driver with `defineDriver` (in `@untestutils/drivers` or a new package).
2. Re-export from the public facade (`packages/untestutils`) subpath.
3. Declare optional peers + `peerDependenciesMeta`.
4. Add a playground fixture + one e2e spec.
5. Document the driver in [Drivers](/guide/drivers).

## defineDriver example

```ts
import { defineDriver, defineRecipe } from 'untestutils'

export const myFw = defineDriver((opts: { id: string; root: string }) =>
  defineRecipe({
    id: opts.id,
    prepare: async (ctx) => {
      // build into ctx.outDir
    },
    start: async (ctx) => ({
      kind: 'url',
      url: `http://127.0.0.1:${ctx.port}/`,
      stop: async () => {},
    }),
  }),
)
```

`defineDriver` is a thin helper: it documents intent and keeps factory typing consistent. The important contract is the **Recipe** shape (`prepare?`, `start`, `ready?`, `hashInputs?`, `share?`).

## Built-in drivers

| Driver | Package | Role |
|--------|---------|------|
| `command` / `staticDir` / `nodeEntry` / `host` | `@untestutils/drivers` | generic |
| `nuxt({ run })` | `@untestutils/nuxt` | Nuxt Recipe factory |
| `vite` / `next` / `astro` / `sveltekit` / `remix` / `solidstart` | matching packages | CLI Recipe factories — see [Drivers](/guide/drivers) |

## Forbidden

Do **not** import Nuxt, Vite, or other frameworks from `@untestutils/core`. Keep core process/artifact logic portable.

## Next

- [Drivers](/guide/drivers)
- [API: Drivers](/api/drivers)
- [Pain points](/migration/pain-points)
