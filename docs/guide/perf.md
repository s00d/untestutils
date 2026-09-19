---
title: Perf suite
description: Build + load benchmarks with untestutils/perf — not e2e harness speed.
outline: deep
---

# Perf suite

::: tip
This is **build/load benchmarking** (`untestutils/perf`), not the e2e shared-prepare story. **Optional peer** — unit tests run on every PR; a tiny dogfood job is available via CI `workflow_dispatch` (`run_perf`). Not part of the 1.0 stability bar — see [Roadmap](/roadmap). For CI speed of tests, see [Why](/why).
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

Optional peers (exact): `autocannon@8.0.0` (programmatic API) and `artillery@2.0.34` (in-process private core runner — version-locked). No `npx`/CLI fallback. Inline Artillery scripts: `load.artillery.script` (prefer `import type { TestScript } from 'artillery'` at the call site). Custom reporters: `onStart` / `onTarget` / `onEnd`.
