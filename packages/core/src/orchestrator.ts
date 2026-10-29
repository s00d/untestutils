import { readdir, readFile, access, unlink } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'pathe';
import { ArtifactStore, pruneBuilds } from './artifact-store';
import { debug, envFlag, log } from './debug';
import { assertUniqueRecipeBinding, computeIdentity } from './identity';
import { FileLock, lockPathFor } from './lock';
import { loopbackUrl, resolveArtifactsRoot, resolveBindHost } from './paths';
import { getFreePort } from './ports';
import { progress } from './progress';
import { defaultReady } from './ready';
import { createRunHelper } from './run-helper';
import { TargetRegistry, type TargetEntry } from './target-registry';
import type { HarnessHandle, Recipe, Running, SharePolicy } from './types';
import { getRegisteredRecipe, listRegisteredRecipes } from './recipes';
import { adoptProcess, processStartToken, scrubTestEnv, type StopOpts } from './process';
import { ofetch } from 'ofetch';
import { constants } from 'node:fs';

export interface OrchestratorOptions {
  artifactsRoot?: string;
  cwd?: string;
}

export interface PreparedTarget {
  id: string;
  identity: string;
  hash: string;
  outDir: string;
  running: Running;
  recipe: Recipe;
}

const liveStops = new Map<string, (opts?: StopOpts) => Promise<void>>();
const liveRunning = new Map<string, Running>();
const liveMeta = new Map<string, { identity: string; hash: string; outDir: string }>();

/** Prefer ManagedProcess.stop / adopt so stopOpts (keepEventLoop) are not swallowed. */
function stopForLive(running: Running): ((opts?: StopOpts) => Promise<void>) | undefined {
  if (running.stop) {
    return (opts?: StopOpts) => running.stop!(opts);
  }
  const pid = running.pid;
  if (typeof pid === 'number' && pid > 1 && pid !== process.pid) {
    // Pin the identity now so a later stop cannot hit a recycled pid.
    const startToken = processStartToken(pid);
    return (opts?: StopOpts) => adoptProcess(pid, 'server', startToken).stop(opts);
  }
  return undefined;
}

function rememberLive(
  id: string,
  running: Running,
  meta: { identity: string; hash: string; outDir: string },
  stop?: (opts?: StopOpts) => Promise<void>,
): void {
  liveRunning.set(id, running);
  liveMeta.set(id, meta);
  if (stop) liveStops.set(id, stop);
}

export async function resolveRecipe(input: string | Recipe): Promise<Recipe> {
  if (typeof input === 'string') {
    const r = getRegisteredRecipe(input);
    if (!r) {
      const known = listRegisteredRecipes()
        .map((x) => x.id)
        .filter(Boolean)
        .sort();
      const hint =
        known.length > 0
          ? ` Known ids: ${known.join(', ')}.`
          : ' Did you call defineRecipes(..., import.meta.url)?';
      throw new Error(`[untestutils] unknown recipe id "${input}".${hint}`);
    }
    return r;
  }
  return input;
}

export async function ensurePrepared(
  recipeInput: string | Recipe,
  opts: OrchestratorOptions = {},
): Promise<PreparedTarget> {
  const prepared = await ensurePreparedInner(recipeInput, opts);
  // Mark the build actually served as used by this run — pruneBuilds keeps it.
  // (share:'never' registry reuse can serve an older identity's dir.)
  const store = new ArtifactStore(opts.artifactsRoot ?? resolveArtifactsRoot(opts.cwd));
  await store.touch(store.identityOf(prepared.outDir) ?? prepared.identity);
  return prepared;
}

async function ensurePreparedInner(
  recipeInput: string | Recipe,
  opts: OrchestratorOptions,
): Promise<PreparedTarget> {
  const recipe = await resolveRecipe(recipeInput);
  const artifactsRoot = opts.artifactsRoot ?? resolveArtifactsRoot(opts.cwd);
  const root = (recipe as Recipe & { root?: string }).root;
  const { identity, hash, id } = await computeIdentity(recipe, artifactsRoot, root);

  const share: SharePolicy = envFlag('UNTESTUTILS_SHARE', true)
    ? (recipe.share ?? 'always')
    : 'never';

  // share:never (dev/HMR) mutates sources → hash drifts; still one live server per id.
  if (share !== 'never') {
    assertUniqueRecipeBinding(id, identity);
  }

  if (envFlag('UNTESTUTILS_SHARE', true) === false && recipe.share !== 'never') {
    // force private prepare path by suffixing identity — handled via share never below
  }

  const store = new ArtifactStore(artifactsRoot);
  const registry = new TargetRegistry(artifactsRoot);

  // Reuse live server in this process (workers still isolated; share:never is per-process).
  const live = liveRunning.get(id);
  if (live) {
    const bound = liveMeta.get(id);
    const outDir = bound?.outDir ?? store.buildDir(identity);
    if (recipe.verifyArtifact) {
      try {
        await recipe.verifyArtifact(outDir);
      } catch (err) {
        debug('prepare', `live artifact invalid ${id}`, err);
        const stop = liveStops.get(id);
        liveStops.delete(id);
        liveRunning.delete(id);
        liveMeta.delete(id);
        if (stop) {
          try {
            await stop();
          } catch {
            /* best-effort */
          }
        }
        // Fall through to warm/prepare path.
      }
    }
    if (liveRunning.get(id) === live) {
      return {
        id,
        identity: bound?.identity ?? identity,
        hash: bound?.hash ?? hash,
        outDir,
        running: live,
        recipe,
      };
    }
  }

  // Reuse registry URL from another worker / prior start — only if still reachable.
  // share:never also reuses URL (one _dev per fixture; forks must not each spawn).
  if (share === 'always' || share === 'never') {
    const reused = await tryReuseRegistry(registry, store, id, identity, hash, share, recipe);
    if (reused) return { ...reused, recipe };
  }

  // Serialize starts by recipe id for never (identity drifts under HMR).
  const lockKey = share === 'never' ? id : identity;
  const lock = new FileLock(lockPathFor(artifactsRoot, lockKey), lockKey);
  await lock.acquire();
  try {
    // Another worker may have registered while we waited for the lock.
    if (share === 'always' || share === 'never') {
      const reused = await tryReuseRegistry(registry, store, id, identity, hash, share, recipe);
      if (reused) return { ...reused, recipe };
    }

    let outDir = await store.ensureDir(identity);
    const run = createRunHelper({ cwd: root, env: scrubTestEnv() });

    let warm = await store.isWarm(identity, hash);
    // Hash can be warm while the real app build output was deleted (e.g. vite
    // dist-override). Re-verify and fall through to prepare when stale.
    if (warm && recipe.verifyArtifact) {
      try {
        await recipe.verifyArtifact(outDir);
      } catch (err) {
        debug('prepare', `warm artifact invalid ${id}`, err);
        await store.invalidate(identity);
        outDir = await store.ensureDir(identity);
        warm = false;
      }
    }

    if (!warm) {
      if (recipe.prepare) {
        progress.prepareStart(id);
        const started = Date.now();
        try {
          await recipe.prepare({
            root,
            outDir,
            artifactsRoot,
            env: scrubTestEnv(),
            run,
          });
          if (recipe.verifyArtifact) await recipe.verifyArtifact(outDir);
          await store.commit(identity, hash, id);
          progress.prepareDone(id, Date.now() - started);
        } catch (err) {
          progress.fail(id, err);
          throw err;
        }
      } else {
        await store.commit(identity, hash, id);
      }
    } else {
      progress.prepareCache(id);
      debug('prepare', `cache hit ${id}`);
    }

    if (share === 'prepare-only') {
      const running: Running = { kind: 'dir', dir: outDir };
      await registry.set({ id, identity, dir: outDir });
      rememberLive(id, running, { identity, hash, outDir });
      return { id, identity, hash, outDir, running, recipe };
    }

    const bindHost = resolveBindHost();
    // getFreePort closes its probe socket before the server binds — another process can
    // grab the port in between. Retry with a fresh port when the start hit EADDRINUSE.
    for (let attempt = 1; ; attempt++) {
      const port = await getFreePort(bindHost);
      try {
        return await startOnPort(port, bindHost, {
          id,
          identity,
          hash,
          outDir,
          root,
          artifactsRoot,
          share,
          recipe,
          registry,
        });
      } catch (err) {
        if (attempt < START_PORT_ATTEMPTS && isAddressInUseError(err)) {
          debug('prepare', `port ${port} taken while starting ${id}, retrying (${attempt})`);
          continue;
        }
        progress.fail(id, err);
        throw err;
      }
    }
  } finally {
    await lock.release();
  }
}

const START_PORT_ATTEMPTS = 3;

/** `EADDRINUSE` anywhere in the error chain or in captured server logs. */
export function isAddressInUseError(err: unknown): boolean {
  for (let e = err, depth = 0; e && depth < 5; depth++) {
    const code = (e as NodeJS.ErrnoException).code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === 'EADDRINUSE' || /EADDRINUSE|address already in use/i.test(msg)) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

async function startOnPort(
  port: number,
  bindHost: string,
  t: {
    id: string;
    identity: string;
    hash: string;
    outDir: string;
    root: string | undefined;
    artifactsRoot: string;
    share: SharePolicy;
    recipe: Recipe;
    registry: TargetRegistry;
  },
): Promise<PreparedTarget> {
  const { id, identity, hash, outDir, root, artifactsRoot, share, recipe, registry } = t;
  const startCtx = {
    root,
    outDir,
    artifactsRoot,
    port,
    host: bindHost,
    env: scrubTestEnv(),
    run: createRunHelper({
      cwd: root,
      env: { ...scrubTestEnv(), PORT: String(port), HOST: bindHost },
    }),
  };

  progress.start(id, loopbackUrl(port, '/', bindHost));
  const running = await recipe.start(startCtx);
  try {
    // Fail-closed: share always/never need a reclaimable child pid (mirror shouldSkipPid),
    // except remote `host` attach (kind:url, no local process / stop).
    const pid = running.pid;
    if (
      (share === 'always' || share === 'never') &&
      (pid === null || pid === undefined || pid <= 1 || pid === process.pid)
    ) {
      const remoteAttach = running.kind === 'url' && !running.stop;
      if (!remoteAttach) {
        throw new Error(
          `[untestutils] recipe "${id}" (share:${share}) started without a reclaimable child pid — ` +
            'registry orphan reclaim requires a child-process server',
        );
      }
    }
    if (recipe.ready) await recipe.ready(running);
    else await defaultReady(running);
  } catch (err) {
    // Pid-only servers (no stop()) are stopped via pid adoption too — no orphan on retry.
    const stop = stopForLive(running);
    if (stop) {
      try {
        await stop();
      } catch {
        /* best-effort */
      }
    }
    throw err;
  }

  rememberLive(id, running, { identity, hash, outDir }, stopForLive(running));

  await replaceRegistryEntry(registry, {
    id,
    identity,
    url: 'url' in running ? running.url : undefined,
    dir: 'dir' in running ? running.dir : outDir,
    pid: running.pid,
    pidStart: processStartToken(running.pid),
  });

  return { id, identity, hash, outDir, running, recipe };
}

/** `UNTESTUTILS_PREWARM_CONCURRENCY`, default half the cores (min 1). */
export function resolvePrewarmConcurrency(): number {
  const n = Number(process.env.UNTESTUTILS_PREWARM_CONCURRENCY);
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  return Math.max(1, Math.floor(availableParallelism() / 2));
}

/**
 * Prepare + start recipes in parallel (at most `concurrency` at once). After the first
 * failure no new recipe starts; in-flight ones finish (no orphan builds), every target this
 * process started is stopped (globalSetup's teardown never runs when setup throws), then it
 * rethrows.
 */
export async function prewarmTargets(
  recipes: Array<string | Recipe>,
  opts: OrchestratorOptions & { concurrency?: number } = {},
): Promise<void> {
  const limit = Math.max(1, opts.concurrency ?? resolvePrewarmConcurrency());
  let next = 0;
  let failed = false;
  let firstError: unknown;
  const lane = async () => {
    while (!failed && next < recipes.length) {
      const recipe = recipes[next++]!;
      try {
        await ensurePrepared(recipe, opts);
      } catch (err) {
        if (!failed) firstError = err;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, recipes.length) }, lane));
  if (failed) {
    await stopAllTargets(opts.artifactsRoot ?? resolveArtifactsRoot(opts.cwd)).catch(() => {});
    throw firstError;
  }
}

/** `UNTESTUTILS_GC`: `0`/`false` off, a number = keep N per recipe; default keep 2. */
export function resolveGcKeep(): number | undefined {
  const raw = process.env.UNTESTUTILS_GC?.trim();
  if (raw === '0' || raw === 'false') return undefined;
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

/** Global-teardown GC: prune stale builds, keeping everything this run (since `runStartedAt`) used. */
export async function pruneAfterRun(artifactsRoot: string, runStartedAt: number): Promise<void> {
  const keep = resolveGcKeep();
  if (keep === undefined) return;
  try {
    const { removed } = await pruneBuilds(artifactsRoot, { keep, usedSince: runStartedAt });
    if (removed.length) log('gc', `pruned ${removed.length} stale build(s), keep ${keep}/recipe`);
  } catch (e) {
    debug('gc', 'prune failed', e);
  }
}

/** Register a live target; kill any previous pid for the same recipe id. */
async function replaceRegistryEntry(registry: TargetRegistry, entry: TargetEntry): Promise<void> {
  const prev = await registry.set(entry);
  if (prev?.pid && prev.pid !== entry.pid) {
    const orphan = adoptProcess(prev.pid, 'server', prev.pidStart);
    if (orphan.alive()) {
      debug('teardown', `replacing ${entry.id} — stop old server`);
      await orphan.stop();
    }
  }
}

async function tryReuseRegistry(
  registry: TargetRegistry,
  store: ArtifactStore,
  id: string,
  identity: string,
  hash: string,
  share: SharePolicy,
  recipe?: Recipe,
): Promise<Omit<PreparedTarget, 'recipe'> | undefined> {
  const existing = await registry.get(id);
  if (!existing?.url) return undefined;
  const warmOk = share === 'never' ? true : await store.isWarm(identity, hash);
  if (!warmOk) return undefined;

  // Stale registry after a crashed worker: process gone → must not reuse the URL.
  if (
    existing.pid !== null &&
    existing.pid !== undefined &&
    !adoptProcess(existing.pid, 'server', existing.pidStart).alive()
  ) {
    debug('registry', `stale pid ${existing.pid} for ${id}`);
    return undefined;
  }
  if (!(await isUrlAlive(existing.url))) return undefined;

  const outDir = existing.dir ?? store.buildDir(identity);
  if (recipe?.verifyArtifact) {
    try {
      await recipe.verifyArtifact(outDir);
    } catch (err) {
      debug('registry', `artifact invalid for ${id}, skip reuse`, err);
      return undefined;
    }
  }

  const running: Running = {
    kind: 'url+dir',
    url: existing.url,
    dir: outDir,
    pid: existing.pid,
  };
  progress.prepareCache(id);
  progress.start(id, existing.url);
  // Adopt so any process that remembered this target can tear it down (honor stopOpts).
  const stop =
    existing.pid !== null && existing.pid !== undefined
      ? (opts?: StopOpts) => adoptProcess(existing.pid!, 'server', existing.pidStart).stop(opts)
      : undefined;
  rememberLive(id, running, { identity, hash, outDir }, stop);
  // Ensure this process sees UNTESTUTILS_HOST_* after cross-worker reuse.
  registry.applyEnv({
    ...existing,
    url: existing.url,
  });
  return { id, identity, hash, outDir, running };
}

async function isUrlAlive(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1_500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.status < 500;
  } catch {
    /* v8 ignore next */
    return false;
  }
}

export async function stopAllTargets(
  artifactsRoot?: string,
  stopOpts: StopOpts = {},
): Promise<void> {
  if (artifactsRoot !== undefined && typeof artifactsRoot !== 'string') {
    throw new Error(
      '[untestutils] stopAllTargets(artifactsRoot?, stopOpts?) — pass artifacts root string, not an options object',
    );
  }
  const stops = [...liveStops.entries()];
  liveStops.clear();
  liveRunning.clear();
  liveMeta.clear();
  await Promise.all(
    stops.map(async ([id, stop]) => {
      try {
        await stop(stopOpts);
        debug('teardown', `stopped ${id}`);
      } catch (e) {
        debug('teardown', `failed ${id}`, e);
      }
    }),
  );

  // Vitest forks start servers in workers; main-process liveStops is often empty.
  // Drain targets.json under lock so concurrent set() cannot drop pids mid-teardown.
  const root = artifactsRoot ?? resolveArtifactsRoot();
  const registry = new TargetRegistry(root);
  const entries = [...Object.values(await registry.drain()), ...(await drainLegacyRegistry(root))];
  const targets = entries.filter((e) => typeof e.pid === 'number' && e.pid > 1);
  await Promise.all(
    targets.map(async ({ pid, pidStart }) => {
      try {
        await adoptProcess(pid!, 'server', pidStart).stop(stopOpts);
        debug('teardown', `stopped registry orphan ${pid}`);
      } catch (e) {
        debug('teardown', `failed registry orphan ${pid}`, e);
      }
    }),
  );
}

/** Pre-0.8 `<artifactsRoot>/targets.json` (now under `run/`) — reclaim its pids once, then drop it. */
async function drainLegacyRegistry(root: string): Promise<TargetEntry[]> {
  const legacy = join(root, 'targets.json');
  try {
    const map = JSON.parse(await readFile(legacy, 'utf8')) as Record<string, TargetEntry>;
    await unlink(legacy);
    return Object.values(map);
  } catch {
    return [];
  }
}

/** @internal clear in-process maps without stopping servers (coverage of registry reuse). */
export function detachLiveTargetsForTests(): void {
  liveStops.clear();
  liveRunning.clear();
  liveMeta.clear();
}

export function createHarnessHandle(prepared: PreparedTarget): HarnessHandle {
  const url = 'url' in prepared.running ? prepared.running.url : undefined;
  const dir = 'dir' in prepared.running ? prepared.running.dir : prepared.outDir;

  return {
    id: prepared.id,
    url,
    dir,
    $fetch: ((request: string, opts?: Parameters<typeof ofetch>[1]) => {
      if (!url) throw new Error(`[untestutils] recipe "${prepared.id}" has no url for $fetch`);
      const target = request.startsWith('http') ? request : new URL(request, url).toString();
      return ofetch(target, opts);
    }) as typeof ofetch,
    files: {
      read: async (rel: string) => readFile(join(dir!, rel), 'utf8'),
      exists: async (rel: string) => {
        try {
          await access(join(dir!, rel), constants.F_OK);
          return true;
        } catch {
          return false;
        }
      },
      list: async (rel = '.') => readdir(join(dir!, rel)),
    },
  };
}
