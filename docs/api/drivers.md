---
title: Drivers API
description: staticDir, command, nodeEntry, host, and defineDriver.
outline: deep
---

# Drivers API

```ts
import {
  staticDir,
  command,
  nodeEntry,
  host,
  defineDriver,
} from 'untestutils'
// or: import { command } from 'untestutils/command'
```

## staticDir(options)

| Option | Description |
|--------|-------------|
| `id` | Recipe id |
| `root` | Directory to serve |

## command(options)

| Option | Description |
|--------|-------------|
| `id` | Recipe id |
| `prepare?` | Shell string (`$PORT`, `$OUT_DIR`) |
| `start` | Shell string to launch server |
| `ready?` | Readiness config |

## nodeEntry(options)

| Option | Description |
|--------|-------------|
| `id` | Recipe id |
| `entry` | Path to Node entry |

## host(options)

| Option | Description |
|--------|-------------|
| `id` | Recipe id |
| `url` | Absolute remote URL |
| `skipReady?` | Skip HTTP readiness |

## Framework factories

Import from `untestutils/vite`, `untestutils/next`, `untestutils/astro`, `untestutils/sveltekit`, `untestutils/remix`, `untestutils/solidstart`.

Common options: `id?`, `root`, `run?`, `env?`, `hashInputs?`, `readyPath?`, `readyTimeoutMs?`.

See [Drivers guide](/guide/drivers) for run-mode tables.

## defineDriver(factory)

Helper to name and type a `(opts) => Recipe` factory. See [Extending](/guide/extending).

## Next

- [Drivers guide](/guide/drivers)
- [Nuxt API](/api/nuxt)
