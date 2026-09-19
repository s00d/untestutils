---
title: CLI
description: init, doctor, perf, AI workflows.
outline: deep
---

# CLI

```bash
pnpm dlx untestutils --help
```

| Command | Role |
|---------|------|
| `init --preset vitest\|playwright\|nuxt\|full` | Scaffold configs/tests |
| `doctor` | Peers + configs check |
| `perf --config ./perf.config.ts` | Build/load suite |
| `ai` / `convert` / `fix` / `cover` | Optional AI workflows |

```bash
untestutils init --preset vitest
untestutils doctor
untestutils perf --config ./perf.config.ts --skip-load
```

Flags vary by command (`--cwd`, `--force`, `--no-install`, …). Run `--help` on each.

See [Getting started](/guide/getting-started) · [Perf suite](/guide/perf) · [AI](/guide/ai).
