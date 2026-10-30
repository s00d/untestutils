---
title: Core API
description: defineRecipes, useHarness, Recipe fields.
outline: deep
---

# Core API

Import from `untestutils`.

## defineRecipes / defineRecipe

```ts
export const recipes = defineRecipes({
  site: /* Recipe */,
}, import.meta.url)
```

| Field | Notes |
|-------|--------|
| `id` | Set when registering by key |
| `prepare?` | Build into artifact dir |
| `start` | Required → `Running` |
| `ready?` | HTTP / custom gate |
| `hashInputs?` | Identity inputs |
| `share?` | Share policy |

`Running`: `{ kind: 'url', url, stop?, pid? }` and/or `{ kind: 'dir', dir }`. Local `share: always|never` servers must set `pid` (e.g. via `spawnManaged`); remote attach omits `stop`/`pid`.

## useHarness / leaseTarget / withHarness

```ts
const app = await useHarness('site')
// app.url, app.dir, app.$fetch, app.files.*

const leased = await leaseTarget('site')
await leased.release()

await withHarness('site', async (app) => {
  /* … */
})
```

`prepareOnce(id)` returns the prepared target without ALS bookkeeping.

Also: `getCurrentHarness()`, `ensurePrepared()`, `stopAllTargets()`, `resolveArtifactsRoot()`, `resolveSessionArtifactsRoot()`, `sanitizeSession()`, `waitForHttpReady()`, `TargetRegistry`, `SCHEMA_VERSION`, `prewarmTargets(recipes, { concurrency })` (parallel prepare/start), `pruneBuilds(artifactsRoot, { keep, usedSince })` (build cache GC; skips locked/in-flight builds), `runStateDir(artifactsRoot)` (`<root>/run` — registry + locks), `runDir(artifactsRoot, runId)`, `beginRun(artifactsRoot)` / `endRun(artifactsRoot)` (global setup/teardown: run-scoped registry; setup reclaims runs whose owner died plus the shared no-run-id and legacy `targets.json` registries, which have no owner check; `UNTESTUTILS_RUN_ID`, `ensureRunId()`), `failIfSetupDrains(fn)` (global-setup wrapper: exit 1 if the event loop drains mid-setup), `isAddressInUseError(err)`.

## Process handles

Users manage **instances**, not PIDs / process groups:

| Export | Semantics |
|--------|-----------|
| `spawnManaged(cmd, args, opts?)` | Long-lived process → `ManagedProcess` (`stop` / `alive` / `logs`) |
| `runCommand(cmd, args, opts?)` | Foreground one-shot (build / CLI tools) |
| `stopAllTargets()` | Drain live handles + this run's registry (keeps the event loop alive until servers exit) |

`ManagedProcess.stop(opts?)`: `{ graceMs?, signal?, keepEventLoop? }` (defaults 2000 / `SIGTERM`). Servers use process-group / `taskkill /T` internally — callers never pass negative PIDs. Orphan reclaim: [Troubleshooting](/guide/troubleshooting).

See [How it works](/guide/how-it-works) · [Drivers API](/api/drivers).
