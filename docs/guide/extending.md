---
title: Extending
description: Custom Driver with defineDriver.
outline: deep
---

# Extending

Core stays framework-free. New frameworks = Driver packages + facade re-export.

`defineDriver` wraps your factory so every recipe gets a non-empty `id` and a valid `share` (`always` by default when omitted).

```ts
import { defineDriver, defineRecipe } from 'untestutils'

export const myFw = defineDriver((opts: { id: string; root: string }) =>
  defineRecipe({
    id: opts.id,
    prepare: async (ctx) => {
      /* build into ctx.outDir */
    },
    start: async (ctx) => ({
      kind: 'url',
      url: `http://127.0.0.1:${ctx.port}/`,
      stop: async () => {},
    }),
  }),
)
```

Contract: Recipe (`prepare?`, `start`, `ready?`, `hashInputs?`, `share?`). Add a playground fixture + one e2e, document under [Drivers](/guide/drivers).

Do not import Nuxt/Vite into `@untestutils/core`.

See [API: Drivers](/api/drivers) · [CONTRIBUTING](https://github.com/s00d/untestutils/blob/master/CONTRIBUTING.md).
