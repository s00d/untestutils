---
title: CLI
description: untestutils CLI — init, convert, ai, doctor, and monorepo helpers.
outline: deep
---

# CLI

Binary: `untestutils` (from the `untestutils` package or `@untestutils/cli`).

```bash
pnpm dlx untestutils --help
# monorepo dev:
pnpm cli --help
```

## init

Scaffold configs and example tests.

| Flag | Default | Description |
|------|---------|-------------|
| `--preset` / `-p` | `vitest` | `vitest` \| `playwright` \| `nuxt` \| `full` |
| `--cwd` | `.` | Project directory |
| `--force` | `false` | Overwrite existing files |
| `--install` | `true` | Install peers via nypm |

```bash
untestutils init --preset full
untestutils init --preset vitest --no-install
```

## fix

Repair a failing untestutils test with AI.

| Flag | Description |
|------|-------------|
| `<path>` | Failing test file |
| `--log` / `-l` | Failure log file |
| `--run` | Shell command that fails (captures stdout/stderr) |
| `--base-url` | Live app URL → enables Playwright page tools |
| `--browser` | Force browser tools |
| `--recipes` | Recipe ids hint |
| `--write` | Overwrite file (default true) |
| `--out` | Alternate output path |

```bash
UNTESTUTILS_AI=1 untestutils fix tests/e2e/home.test.ts \
  --run "pnpm exec vitest run tests/e2e/home.test.ts" \
  --base-url http://127.0.0.1:3000
```

## cover / write-tests

Author missing e2e tests (explores existing tests + optional live page).

| Flag | Description |
|------|-------------|
| `--root` | Project root |
| `--recipes` | Recipe ids |
| `--focus` | Path hints |
| `--base-url` | Enable browser snapshot tools |
| `--out-dir` | Default `tests/e2e` |
| `--write` | Write into the project (default true) |

```bash
UNTESTUTILS_AI=1 untestutils cover --recipes site --base-url http://127.0.0.1:3000
```

## convert

AI-convert an existing test file to untestutils APIs.

| Flag | Description |
|------|-------------|
| `<path>` | Source file |
| `--in-place` / `-i` | Overwrite (writes `.bak`) |
| `--root` | Project root for tools |

Requires `UNTESTUTILS_AI=1` on cache miss (or prior cached artifact).

```bash
UNTESTUTILS_AI=1 untestutils convert tests/legacy.spec.ts
```

## ai / generate

Generate a new e2e spec from a prompt or markdown file.

| Flag | Description |
|------|-------------|
| `--prompt` / `-p` | Scenario text |
| `--file` / `-f` | Markdown + frontmatter |
| `--id` | Generation id |
| `--root` | Project root |
| `--recipes` | Comma-separated ids |
| `--focus` | Comma-separated file hints |
| `--out` | Copy result to path |

```bash
untestutils ai --prompt "check /pricing" --recipes site --out tests/e2e/pricing.test.ts
```

## doctor

Environment and config checks (Node ≥ 20, packages, config, recipes). Exit code `1` on hard failures.

## Monorepo helpers

These commands detect the untestutils monorepo root (`pnpm-workspace.yaml` + `packages/untestutils`).

| Command | Role |
|---------|------|
| `build` | Build packages in dependency order |
| `api-surface` | Check/update facade export snapshot (`--update`) |
| `pack-test` | `pnpm pack` + consumer smoke |
| `preflight` | lint → format → types → tests → build → pack |

```bash
pnpm cli build
pnpm cli api-surface --update
pnpm cli preflight
```

## Next

- [Getting started](/guide/getting-started)
- [AI codegen](/guide/ai)
- [Troubleshooting](/guide/troubleshooting)
