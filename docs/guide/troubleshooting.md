---
title: Troubleshooting
description: Common errors, env flags, and untestutils doctor.
outline: deep
---

# Troubleshooting

```bash
pnpm exec untestutils doctor
pnpm exec untestutils doctor --recipes
```

Checks Node, peers (Vitest major 4|5), configs, and `recipes.ts`. `doctor --recipes` lists registered ids.

## Common errors

**unknown recipe id** — `defineRecipes({ … }, import.meta.url)` and pass `recipes` into the plugin so workers re-import the module. Error messages list **known ids** when the registry is loaded.

**prewarm id not found** — same: id must exist in the recipes module; message lists known ids.

**no harness url** — call `useHarness` or list the id in `prewarm` before using `page` / `baseURL`.

**Playwright picked up `*.test.ts`** — `createPlaywrightConfig` defaults to `testMatch: '**/*.spec.ts'`. Override via `testMatch` if needed.

**Config pulled in fixtures** — use `untestutils/vitest/plugin` in config, not `untestutils/vitest`.

**Ready hang / readiness failed** — local servers bind `ctx.host` (default `127.0.0.1`, override with `UNTESTUTILS_BIND_HOST`). Ready probes TCP then HTTP; wildcard binds like `0.0.0.0` still probe `127.0.0.1`. For `host()`, set `readyTimeoutMs` / `readyPath`, or `skipReady: true` if the URL is already up. Drivers that wait inside `start` use a noop `ready` so the orchestrator does not probe twice.

**Orphan processes** — hard-killed runs leave locks; clear `.untestutils` and retry. Teardown must not kill pid ≤ 1.

**Empty setup / recipes never load** — published facade must keep `vitest/setup-file` side effects (re-export, not a dead `await import`). Upgrade to a release that includes that fix.

## Env

| Variable | Purpose |
|----------|---------|
| `UNTESTUTILS_DEBUG=1` | Verbose logs |
| `UNTESTUTILS_QUIET=1` / `PROGRESS=0` | Silence progress |
| `UNTESTUTILS_SHARE=0` | Disable share |
| `UNTESTUTILS_ARTIFACTS_DIR` | Custom artifacts root |
| `UNTESTUTILS_BIND_HOST` | Bind/probe host for local servers (default `127.0.0.1`; `localhost`/`::1` coerced to IPv4) |
| `UNTESTUTILS_REMOTE_URL` | Remote `host()` URL |
| `UNTESTUTILS_BROWSER` | Playwright engine for Vitest fixtures |

## Next

- [Getting started](/guide/getting-started)
- [How it works](/guide/how-it-works)
- [CLI](/cli/)
