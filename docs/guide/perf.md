---
title: Perf
description: Build + load performance suites with pluggable targets and reporters.
outline: deep
---

# Perf

Import from `untestutils/perf` or run `untestutils perf --config ./perf.config.ts`.

Measures **build** (wall time + RSS/CPU + optional bundle sizes) and optional **load** (autocannon / artillery) against started servers. Targets are filesystem apps — not tied to Nuxt.

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
        env: { NITRO_PRESET: 'node-server' },
      },
      load: {
        autocannon: { connections: 10, durationSec: 10 },
        artillery: { config: './benchmark/artillery.yml' },
      },
      bundle: {
        dirs: ['.output/public', '.output/server'],
        classify: (p) => (p.includes('locales') ? 'asset' : 'code'),
      },
    },
  ],
  thresholds: { buildTimeSec: 120, responseTimeP95: 500 },
})
```

```bash
untestutils perf --config ./perf.config.ts
untestutils perf --config ./perf.config.ts --only app --skip-load
untestutils perf --config ./perf.config.ts --runs 3 --json
```

Optional peers: install `autocannon` / `artillery` for faster local runs; otherwise the harness falls back to `npx`.

Custom reporters implement `onStart` / `onTarget` / `onEnd` — markdown/charts stay in the consumer repo.
