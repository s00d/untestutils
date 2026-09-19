---
title: Drivers API
description: staticDir, command, nodeEntry, host, defineDriver.
outline: deep
---

# Drivers API

```ts
import { staticDir, command, nodeEntry, host, defineDriver } from 'untestutils'
```

| Factory | Key options |
|---------|-------------|
| `staticDir` | `id`, `root` |
| `command` | `id`, `prepare?`, `start` (`$PORT`, `$HOST`, `$OUT_DIR`), `readyPath?`, `readyTimeoutMs?` |
| `nodeEntry` | `id`, `entry`, `readyPath?`, `readyTimeoutMs?` |
| `host` | `id`, `url`, `readyPath?`, `readyTimeoutMs?`, `skipReady?` |
| `defineDriver` | `(opts) => Recipe` |

Framework factories: `untestutils/vite` \| `next` \| `astro` \| `sveltekit` \| `remix` \| `solidstart`.

See [Drivers guide](/guide/drivers) · [Nuxt API](/api/nuxt).
