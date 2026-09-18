---
title: Troubleshooting
description: Common errors, env flags, and untestutils doctor.
outline: deep
---

# Troubleshooting

## Run doctor

```bash
pnpm exec untestutils doctor
# or: pnpm dlx untestutils doctor
```

Checks Node version, peers (`untestutils`, `vitest`, optional Playwright/Nuxt), presence of Vitest/Playwright config, and `recipes.ts`.

## Common errors

### unknown recipe id / Did you call defineRecipes?

Register recipes with `defineRecipes({ … }, import.meta.url)` and pass the imported `recipes` map into the plugin — workers re-import that module automatically.

### no harness url — call await useHarness(...) first

Fixtures (`page`, `baseURL`) need a started target. Call `useHarness` or list the id in `prewarm`.

### missing UNTESTUTILS_HOST_\*

Playwright `baseURL` reads env set during setup. Ensure global setup ran and `harness` option matches a prepared id.

### Config import pulled in fixtures

Use `untestutils/vitest/plugin` in config, not `untestutils/vitest`.

### Ready hang / timeout

- Confirm the server listens on `127.0.0.1`.
- For `host()`, verify the URL is reachable or set `skipReady`.
- Increase ready timeout on `command` / custom recipes.

### Orphan processes

Teardown should kill process trees safely (never pid ≤ 1). If a run was killed hard, clear stale locks under `.untestutils` and retry.

### Peer dependency missing

Install optional peers for the features you use (`@playwright/test`, `nuxt`, `ai`, …).

## Useful env

| Variable | Purpose |
|----------|---------|
| `UNTESTUTILS_DEBUG=1` | Verbose logs + keep Nuxt/Vite prepare output |
| `UNTESTUTILS_QUIET=1` | Silence harness prepare/start progress |
| `UNTESTUTILS_PROGRESS=0` | Force progress off (same as quiet) |
| `UNTESTUTILS_PROGRESS=1` | Force progress on even in CI |
| `CI` / `GITHUB_ACTIONS` / … | Progress off by default; original build logs visible |
| `UNTESTUTILS_SHARE=0` | Disable share |
| `UNTESTUTILS_ARTIFACTS_DIR` | Custom artifacts root |
| `UNTESTUTILS_REMOTE_URL` | Remote `host()` URL |
| `UNTESTUTILS_AI=1` | Allow live AI generation |
| `UNTESTUTILS_AI_MOCK=1` | Mock AI for tests |

## Next

- [Getting started](/guide/getting-started)
- [CLI](/cli/)
- [Sharing & cache](/guide/sharing-and-cache)
