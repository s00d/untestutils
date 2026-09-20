---
title: Perf suite
description: Build + load benchmarks with untestutils/perf — not e2e harness speed.
outline: deep
---

# Perf suite

::: tip
This is **build/load benchmarking** (`untestutils/perf`), not the e2e shared-prepare story. **Optional peer** — unit tests run on every PR; a tiny dogfood job is available via CI `workflow_dispatch` (`run_perf`). Not part of the 1.0 stability bar — see [Roadmap](/roadmap). For CI speed of tests, see [Why](/why).
:::

Builds reuse `.output` when the **content hash** of `hashInputs` (default: target root) matches — same idea as prepare cache.

## Load

Prefer **programmatic Artillery knobs** (no YAML). Autocannon remains an **optional** single-URL tool for other suites; when both run, top-level `LoadMetrics` prefer Artillery and the console shows **both** rows.

```ts
import {
  definePerfSuite,
  consoleReporter,
  jsonReporter,
  buildArtilleryScript,
} from 'untestutils/perf'

export default definePerfSuite({
  runs: 1,
  verbosity: 'default', // 'quiet' | 'default' | 'verbose'
  coolDownMs: 500,
  postBuildDelayMs: 200,
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
      load: {
        // Knobs → in-process Artillery script (paths, phases, maxVU)
        artillery: {
          durationSec: 10,
          arrivalRate: 40,
          maxVusers: 40,
          warmUpSec: 2,
          paths: ['/', '/page', '/ru'],
        },
        // Optional single-URL hammer (shows as a separate AC row in the console):
        // autocannon: { connections: 10, durationSec: 5 },
      },
    },
  ],
  thresholds: { buildTimeSec: 120, responseTimeP95: 500 },
})
```

### Console output

Progress goes through one `PerfUi` renderer (`consoleReporter`):

- **default** — target header, build/start/load phase lines, filtered build logs, result block, summary table
- **quiet** — one line per target + summary
- **verbose** — plus Artillery phase names and server stdout

Cache hits print `build cache hit` / `cached` (no fake `RSS 0 MB`). Busy ports print `start :bound (requested in use)` and the suite advances the next target from `bound+1`.

### Peers

`artillery: true` uses defaults. `{ script }` for a full inline TestScript. `{ config: 'file.yml' }` still works but is legacy.

```bash
untestutils perf --config ./perf.config.ts
untestutils perf --config ./perf.config.ts --only app --skip-load
untestutils perf --config ./perf.config.ts --force-build
```

Optional peers (exact): `autocannon@8.0.0`, `artillery@2.0.34` (in-process private core — version-locked). Install only what your suite enables. See [calibration](/guide/perf-calibration) and [Artillery verify](/guide/perf-artillery-verify).
