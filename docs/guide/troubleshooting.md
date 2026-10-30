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

**no harness url** — call `useHarness` or list the id in `prewarm` before using `page` / `baseURL`. (In 0.8.0 a `test.override({ harness })` suite could also hit this on a cold build; upgrade to a release after 0.8.0, where the fixture reads the harness's own handle.)

**Run exits 0 with zero tests** — in 0.8.0, global setup could drain the event loop while stopping servers, and Node exited 0 before any test ran. Releases after 0.8.0 print `global setup aborted before tests ran` and exit 1 instead (vitest and playwright).

**Playwright picked up `*.test.ts`** — `createPlaywrightConfig` defaults to `testMatch: '**/*.spec.ts'`. Override via `testMatch` if needed.

**Config pulled in fixtures** — use `untestutils/vitest/plugin` in config, not `untestutils/vitest`.

**Ready hang / readiness failed** — local servers bind `ctx.host` (default `127.0.0.1`, override with `UNTESTUTILS_BIND_HOST`). Ready probes TCP then HTTP; wildcard binds like `0.0.0.0` still probe `127.0.0.1`. For `host()`, set `readyTimeoutMs` / `readyPath`, or `skipReady: true` if the URL is already up. Drivers that wait inside `start` use a noop `ready` so the orchestrator does not probe twice.

**Tempted to use `run: 'dev'` to skip builds?** Don’t — that mode is for HMR / file-watcher specs only (`share: 'never'`). Normal e2e should use `server` / `preview` / `static` so shared prepare stays warm. See [Drivers](/guide/drivers#run-modes-nuxt).

Paths below use the default artifacts root `.untestutils`; with `UNTESTUTILS_ARTIFACTS_DIR` / `artifactsRoot` or a `session` (`.untestutils/sessions/<session>/`) use that root instead.

**`timed out … waiting for lock`** — the holder stopped heartbeating for the whole timeout; the message names its pid and last heartbeat. Kill that process and confirm it exited before deleting the lock under `<root>/run/locks/` — removing a live builder's lock lets a second builder write the same artifact. A live builder is waited on indefinitely.

**`goto(...): Nuxt hydration not ready`** — the page never finished hydrating (check the browser console). Use `waitUntil: 'domcontentloaded'` for pages that legitimately never hydrate, or set `untestutils({ hydration: 'lenient' })`.

**Orphan processes / leftover servers** — hard-killed runs can leave registry entries and ports. Just rerun first: global setup (`beginRun`) reclaims registry orphans from runs whose vitest/playwright process is gone (`<root>/run/runs/<runId>/`). It also drains the shared `<root>/run/targets.json` used without a run id, which has no owner check. A concurrent live plugin-managed run is left alone. Only delete `<root>/run` after those servers are stopped (deleting it first loses the pids). Teardown (`endRun`) calls `stopAllTargets` for this run's servers. For ad-hoc servers use handles from `@untestutils/core`:

| API | Use |
|-----|-----|
| `spawnManaged(cmd, args)` | Start → `stop()` / `alive()` / `logs()` |
| `stopAllTargets()` | Drain live handles + registry |

Do not dig for PIDs or process groups — tear down via the handle.

## Warm cache / stale artifacts

Prepare reuse (`.ready` + content hash) does **not** hash build outputs like `.next/`, `dist/`, or `.output/`. Warm and registry-reuse paths call `recipe.verifyArtifact` when present — if the check throws, cache is invalidated and prepare runs again.

| Hook | When |
|------|------|
| `verifyAfterPrepare` | Cold prepare only (also promoted to `verifyArtifact` when the latter is unset) |
| `verifyArtifact(outDir)` | After prepare **and** on warm / live / registry reuse |

**Shared fixture roots:** do not run `dev` and a built mode (`server` / `preview` / `static`) against the same app directory if both write the same output (e.g. Next `.next` / `out`). Split fixtures (`next-dev` / `next-server` / `next-app-override`) or set distinct `distDir` / `outDir`. Playground `nextStaticOverride` uses its own fixture root.

**Next `distDir`:** `verifyArtifact` / `BUILD_ID` checks respect `nextConfig.distDir`.

## Reset failure (unit worker)

If `resetSharedApp` throws under `appIsolation: 'worker'`, the shared app is disposed and the next test fails with **call `restartSharedApp()`** until you restart.

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
