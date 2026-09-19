---
title: Perf suite
description: Build + load benchmarks with untestutils/perf — not e2e harness speed.
outline: deep
---

# Perf suite

::: tip
This is **build/load benchmarking** (`untestutils/perf`), not the e2e shared-prepare story. Optional / not in CI dogfood — see [Roadmap](/roadmap). For CI speed of tests, see [Why](/why).
:::

```ts
import { definePerfSuite, consoleReporter, jsonReporter } from 'untestutils/perf'

export default definePerfSuite({
  runs: 1,
  artifactsDir: '.untestutils/perf',
  reporters: [consoleReporter(), jsonReporter()],
  targets: [
    {
      id: 'app',
      root: './playground',
      build: { command: 'pnpm', args: ['exec', 'nuxi', 'build'] },
      start: {
        command: 'node',
        args: ['.output/server/index.mjs'],
        port: 10000,
      },
      load: { autocannon: { connections: 10, durationSec: 10 } },
    },
  ],
  thresholds: { buildTimeSec: 120, responseTimeP95: 500 },
})
```

```bash
untestutils perf --config ./perf.config.ts
untestutils perf --config ./perf.config.ts --only app --skip-load
```

Optional peers: `autocannon` / `artillery` (else `npx` fallback). Custom reporters: `onStart` / `onTarget` / `onEnd`.
