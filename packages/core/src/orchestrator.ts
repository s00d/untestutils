import { mkdir, writeFile, readdir, readFile, access } from 'node:fs/promises';
import { join } from 'pathe';
import { ArtifactStore } from './artifact-store';
import { debug, envFlag } from './debug';
import { assertUniqueRecipeBinding, computeIdentity } from './identity';
import { FileLock, lockPathFor } from './lock';
import { LOOPBACK_HOST, resolveArtifactsRoot } from './paths';
import { getFreePort } from './ports';
import { progress } from './progress';
import { defaultReady } from './ready';
import { createRunHelper } from './run-helper';
import { TargetRegistry } from './target-registry';
import type { Recipe, Running, SharePolicy } from './types';
import { getRegisteredRecipe } from './recipes';
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

const liveStops = new Map<string, () => Promise<void>>();
const liveRunning = new Map<string, Running>();
const liveMeta = new Map<string, { identity: string; hash: string; outDir: string }>();

function rememberLive(
  id: string,
  running: Running,
  meta: { identity: string; hash: string; outDir: string },
  stop?: () => Promise<void>,
): void {
  liveRunning.set(id, running);
  liveMeta.set(id, meta);
  if (stop) liveStops.set(id, stop);
}

export async function resolveRecipe(input: string | Recipe): Promise<Recipe> {
  if (typeof input === 'string') {
    const r = getRegisteredRecipe(input);
    if (!r)
      throw new Error(`[untestutils] unknown recipe id "${input}". Did you call defineRecipes()?`);
    return r;
  }
  return input;
}

export async function ensurePrepared(
  recipeInput: string | Recipe,
  opts: OrchestratorOptions = {},
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
    return {
      id,
      identity: bound?.identity ?? identity,
      hash: bound?.hash ?? hash,
      outDir: bound?.outDir ?? store.buildDir(identity),
      running: live,
      recipe,
    };
  }

  // Reuse registry URL from another worker / prior start — only if still reachable
  if (share === 'always') {
    const existing = await registry.get(id);
    if (existing?.url && (await store.isWarm(identity, hash)) && (await isUrlAlive(existing.url))) {
      const outDir = store.buildDir(identity);
      const running: Running = {
        kind: 'url+dir',
        url: existing.url,
        dir: existing.dir ?? outDir,
      };
      progress.prepareCache(id);
      progress.start(id, existing.url);
      rememberLive(id, running, { identity, hash, outDir });
      return { id, identity, hash, outDir, running, recipe };
    }
  }

  const lock = new FileLock(lockPathFor(artifactsRoot, identity), identity);
  await lock.acquire();
  try {
    const outDir = await store.ensureDir(identity);
    const run = createRunHelper({ cwd: root, env: scrubEnv() });

    if (!(await store.isWarm(identity, hash))) {
      if (recipe.prepare) {
        progress.prepareStart(id);
        const started = Date.now();
        try {
          await recipe.prepare({
            root,
            outDir,
            artifactsRoot,
            env: scrubEnv(),
            run,
          });
          if (recipe.verifyArtifact) await recipe.verifyArtifact(outDir);
          await store.commit(identity, hash);
          progress.prepareDone(id, Date.now() - started);
        } catch (err) {
          progress.fail(id, err);
          throw err;
        }
      } else {
        await store.commit(identity, hash);
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

    const port = await getFreePort();
    const startCtx = {
      root,
      outDir,
      artifactsRoot,
      port,
      host: LOOPBACK_HOST,
      env: scrubEnv(),
      run: createRunHelper({
        cwd: root,
        env: { ...scrubEnv(), PORT: String(port), HOST: LOOPBACK_HOST },
      }),
    };

    const url = `http://${LOOPBACK_HOST}:${port}`;
    progress.start(id, url);
    try {
      const running = await recipe.start(startCtx);
      if (recipe.ready) await recipe.ready(running);
      else await defaultReady(running);

      rememberLive(id, running, { identity, hash, outDir }, running.stop);

      await registry.set({
        id,
        identity,
        url: 'url' in running ? running.url : undefined,
        dir: 'dir' in running ? running.dir : outDir,
      });

      await writeEnvSnapshot(outDir, { id, identity, port, hash });

      return { id, identity, hash, outDir, running, recipe };
    } catch (err) {
      progress.fail(id, err);
      throw err;
    }
  } finally {
    await lock.release();
  }
}

function scrubEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of ['VITEST', 'VITEST_WORKER_ID', 'TEST', 'JEST_WORKER_ID', 'JEST']) delete env[k];
  return env;
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

async function writeEnvSnapshot(
  outDir: string,
  info: { id: string; identity: string; port: number; hash: string },
): Promise<void> {
  try {
    await mkdir(outDir, { recursive: true });
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(scrubEnv())) {
      if (v !== undefined && !/secret|token|password|key/i.test(k)) env[k] = v;
    }
    await writeFile(
      join(outDir, 'env.snapshot.json'),
      JSON.stringify({ ...info, node: process.version, env }, null, 2),
      'utf8',
    );
  } catch {
    /* optional */
  }
}

export async function stopAllTargets(): Promise<void> {
  const stops = [...liveStops.entries()];
  liveStops.clear();
  liveRunning.clear();
  liveMeta.clear();
  await Promise.all(
    stops.map(async ([id, stop]) => {
      try {
        await stop();
        debug('teardown', `stopped ${id}`);
      } catch (e) {
        debug('teardown', `failed ${id}`, e);
      }
    }),
  );
}

/** @internal clear in-process maps without stopping servers (coverage of registry reuse). */
export function detachLiveTargetsForTests(): void {
  liveStops.clear();
  liveRunning.clear();
  liveMeta.clear();
}

export function createHarnessHandle(prepared: PreparedTarget): import('./types').HarnessHandle {
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
