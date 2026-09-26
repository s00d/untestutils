import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'pathe';
import { loopbackUrl } from '../paths';
import { spawnManaged } from '../process';
import { waitForHttpReady } from '../ready';
import type { Running } from '../types';
import { frameworkRoots } from './cli-framework';

export type ViteApiModule = {
  createServer: (inline?: Record<string, unknown>) => Promise<{
    listen: () => Promise<unknown>;
    close: () => Promise<void>;
    resolvedUrls?: { local?: string[]; network?: string[] };
  }>;
  build: (inline?: Record<string, unknown>) => Promise<unknown>;
  preview: (inline?: Record<string, unknown>) => Promise<{
    httpServer?: { close: (cb?: (err?: Error) => void) => void };
    close?: () => Promise<void>;
    resolvedUrls?: { local?: string[]; network?: string[] };
  }>;
};

/** Resolve the app's `vite` package (not monorepo-hoisted guess). */
export async function importViteFromRoot(root: string): Promise<ViteApiModule> {
  const roots = frameworkRoots(root);
  let last: unknown;
  for (const r of roots) {
    try {
      const req = createRequire(join(r, 'package.json'));
      const id = req.resolve('vite');
      return (await import(pathToFileURL(id).href)) as ViteApiModule;
    } catch (err) {
      last = err;
    }
  }
  throw new Error(
    `[untestutils] cannot import vite from ${roots.join(', ')}: ${last instanceof Error ? last.message : String(last)}`,
  );
}

export type ViteProgrammaticOpts = {
  root: string;
  port: number;
  host?: string;
  /** Absolute path to ephemeral/merged vite config, or false to disable config file. */
  configFile?: string | false;
  env?: Record<string, string>;
  afterStop?: () => Promise<void> | void;
  readyTimeoutMs?: number;
};

function applyEnv(env?: Record<string, string>): () => void {
  if (!env || !Object.keys(env).length) return () => {};
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** SvelteKit (and some Vite plugins) resolve `src/app.html` from `process.cwd()`, not only `root`. */
function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.cwd();
  process.chdir(dir);
  return fn().finally(() => {
    try {
      process.chdir(prev);
    } catch {
      /* */
    }
  });
}

function resolveViteChildHost(): string {
  const beside = fileURLToPath(new URL('./vite-child-host.mjs', import.meta.url));
  if (existsSync(beside)) return beside;
  try {
    const pkg = createRequire(import.meta.url).resolve('@untestutils/core/package.json');
    const fromPkg = join(dirname(pkg), 'dist/drivers/vite-child-host.mjs');
    if (existsSync(fromPkg)) return fromPkg;
  } catch {
    /* self-resolve */
  }
  // Developing core from src/: walk up to package root.
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'dist/drivers/vite-child-host.mjs');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    '[untestutils] vite-child-host.mjs not found — run `pnpm --filter @untestutils/core build`',
  );
}

async function waitForReadyLine(
  logs: () => string,
  alive: () => boolean,
  timeoutMs: number,
): Promise<string> {
  const started = Date.now();
  for (;;) {
    if (!alive()) throw new Error('vite child exited before ready');
    // Match full buffer so split stdout chunks ("rea"+"dy …") still detect ready.
    const match = logs().match(/ready\s+(\S+)/);
    if (match?.[1]) return match[1];
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`vite child ready timeout\n--- logs ---\n${logs().slice(-4000)}`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function startViteChild(
  mode: 'dev' | 'preview',
  opts: ViteProgrammaticOpts,
): Promise<Running> {
  const host = opts.host ?? '127.0.0.1';
  const root = resolve(opts.root);
  const timeoutMs = opts.readyTimeoutMs ?? 120_000;
  const script = resolveViteChildHost();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...opts.env,
    PORT: String(opts.port),
    HOST: host,
    UNTESTUTILS_VITE_ROOT: root,
    UNTESTUTILS_VITE_PORT: String(opts.port),
    UNTESTUTILS_VITE_HOST: host,
    UNTESTUTILS_VITE_MODE: mode,
  };
  if (opts.configFile === false) env.UNTESTUTILS_VITE_CONFIG_FILE = 'false';
  else if (typeof opts.configFile === 'string') env.UNTESTUTILS_VITE_CONFIG_FILE = opts.configFile;
  else delete env.UNTESTUTILS_VITE_CONFIG_FILE;

  const managed = spawnManaged(process.execPath, [script], {
    cwd: root,
    env,
    captureLogs: true,
    server: true,
  });

  const fallbackUrl = loopbackUrl(opts.port, '/', host);
  try {
    const readyUrl = await waitForReadyLine(
      () => managed.logs(),
      () => managed.alive(),
      timeoutMs,
    );
    const url = readyUrl.startsWith('http') ? readyUrl : fallbackUrl;
    await waitForHttpReady(url, { timeoutMs: Math.min(timeoutMs, 60_000) });
    return {
      kind: 'url+dir',
      url,
      dir: root,
      pid: managed.pid,
      stop: async (stopOpts) => {
        await managed.stop(stopOpts);
        if (opts.afterStop) await opts.afterStop();
      },
    };
  } catch (err) {
    await managed.stop();
    throw new Error(
      `[untestutils] vite ${mode} ready failed:\n${err instanceof Error ? err.message : String(err)}\n--- logs ---\n${managed.logs().slice(-4000)}`,
    );
  }
}

export async function runViteBuild(opts: {
  root: string;
  configFile?: string | false;
  env?: Record<string, string>;
}): Promise<void> {
  const restore = applyEnv(opts.env);
  const root = resolve(opts.root);
  try {
    await withCwd(root, async () => {
      const vite = await importViteFromRoot(root);
      await vite.build({
        root,
        configFile: opts.configFile,
        logLevel: 'warn',
      });
    });
  } finally {
    restore();
  }
}

/** Start Vite dev in a child process (registry-reclaimable pid). */
export async function startViteDev(opts: ViteProgrammaticOpts): Promise<Running> {
  return startViteChild('dev', opts);
}

/** Start Vite preview in a child process (registry-reclaimable pid). */
export async function startVitePreview(opts: ViteProgrammaticOpts): Promise<Running> {
  return startViteChild('preview', opts);
}
