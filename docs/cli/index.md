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
| `init --preset vitest\|playwright\|nuxt\|full` | Scaffold configs/tests/fixtures |
| `doctor` | Peers + configs check (Vitest major 4\|5, Playwright when config present, optional peer hints) |
| `doctor --recipes` | List recipe ids from `defineRecipes` export |
| `perf --config ./perf.config.ts` | Build/load suite (optional) |
| `ai` / `convert` / `fix` / `cover` | Optional AI workflows |

```bash
untestutils init --preset vitest
untestutils init --preset playwright --pm pnpm
untestutils init --preset nuxt --no-install
untestutils doctor
untestutils doctor --recipes
untestutils perf --config ./perf.config.ts --skip-load
```

### `init` flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--preset` / `-p` | `vitest` | `vitest` \| `playwright` \| `nuxt` \| `full` |
| `--install` | `true` | Install peers via nypm; use **`--no-install`** to skip |
| `--pm` | auto → `pnpm` | Force `pnpm` \| `npm` \| `yarn` \| `bun` |
| `--force` | `false` | Overwrite existing scaffold files |
| `--cwd` | `.` | Target directory |

`nuxt` preset writes a minimal `fixtures/nuxt` app so recipes point at a real root.

### `doctor` flags

| Flag | Meaning |
|------|---------|
| `--recipes` | List recipe ids from `defineRecipes` export |
| `--cwd` | Project directory |

See [Getting started](/guide/getting-started) · [Perf suite](/guide/perf) · [AI](/guide/ai).
