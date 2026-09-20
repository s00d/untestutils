---
title: Perf suite
description: Build + load benchmarks with untestutils/perf — not e2e harness speed.
outline: deep
---

# Perf suite

::: tip
This is **build/load benchmarking** (`untestutils/perf`), not the e2e shared-prepare story. **Optional peer** — unit tests run on every PR; a tiny dogfood job is available via CI `workflow_dispatch` (`run_perf`). Not part of the 1.0 stability bar — see [Roadmap](/roadmap). For CI speed of tests, see [Why](/why).
:::

One load configuration for everyone (defaults: autocannon **10c × 5s** after [calibration](/guide/perf-calibration)). Builds reuse `.output` when the **content hash** of `hashInputs` (default: target root) matches — same idea as prepare cache, not a manual skip flag.

```ts
import { definePerfSuite, consoleReporter, jsonReporter } from 'untestutils/perf'

export default definePerfSuite({
  runs: 1,
  coolDownMs: 500,
  postBuildDelayMs: 200,
  artifactsDir: '.untestutils/perf',
  reporters: [consoleReporter(), jsonReporter()],
  targets: [
    {
      id: 'app',
      root: './playground',
      build: {
        command: 'pnpm',
        args: ['exec', 'nuxi', 'build'],
        // optional: hashInputs: ['./playground', '../packages/foo/src'],
      },
      start: {
        command: 'node',
        args: ['.output/server/index.mjs'],
        port: 10000,
      },
      load: { autocannon: { connections: 10, durationSec: 5 } },
    },
  ],
  thresholds: { buildTimeSec: 120, responseTimeP95: 500 },
})
```

```bash
untestutils perf --config ./perf.config.ts
untestutils perf --config ./perf.config.ts --only app --skip-load
untestutils perf --config ./perf.config.ts --force-build
untestutils perf --config ./perf.config.ts --runs 3 --json
```

- Build cache: sources unchanged → skip rebuild, still report bundle sizes (`build.cached: true`).
- `--force-build` — ignore warm cache.
- `--cool-down <ms>` — pause between runs/targets (suite default **500**).
- `postBuildDelayMs` — sleep after build before start (default **200**).

Optional peers (exact): `autocannon@8.0.0` (programmatic API) and `artillery@2.0.34` (in-process private core runner — version-locked). No `npx`/CLI fallback. Inline Artillery scripts: `load.artillery.script` (prefer `import type { TestScript } from 'artillery'` at the call site). Custom reporters: `onStart` / `onTarget` / `onEnd`.
