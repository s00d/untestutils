import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'pathe';
import {
  frameworkRoots,
  loopbackUrl,
  spawnManaged,
  waitForHttpReady,
  type Running,
} from '@untestutils/core';

type AstroApi = {
  build: (opts: Record<string, unknown>) => Promise<unknown>;
};

async function importAstroFromRoot(root: string): Promise<AstroApi> {
  const roots = frameworkRoots(root);
  let last: unknown;
  for (const r of roots) {
    try {
      const req = createRequire(join(r, 'package.json'));
      const id = req.resolve('astro');
      return (await import(pathToFileURL(id).href)) as AstroApi;
    } catch (err) {
      last = err;
    }
  }
  throw new Error(
    `[untestutils/astro] cannot import astro from ${roots.join(', ')}: ${
      last instanceof Error ? last.message : String(last)
    }`,
  );
}

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

export async function runAstroBuild(opts: {
  root: string;
  configFile?: string;
  env?: Record<string, string>;
}): Promise<void> {
  const restore = applyEnv(opts.env);
  try {
    const astro = await importAstroFromRoot(opts.root);
    await astro.build({
      root: resolve(opts.root),
      ...(opts.configFile ? { configFile: opts.configFile } : {}),
      logLevel: 'warn',
    });
  } finally {
    restore();
  }
}

export type AstroProgrammaticOpts = {
  root: string;
  port: number;
  host?: string;
  configFile?: string;
  env?: Record<string, string>;
  readyTimeoutMs?: number;
};

function resolveAstroChildHost(): string {
  const beside = fileURLToPath(new URL('./astro-child-host.mjs', import.meta.url));
  if (existsSync(beside)) return beside;
  try {
    const pkg = createRequire(import.meta.url).resolve('@untestutils/astro/package.json');
    const fromPkg = join(dirname(pkg), 'dist/astro-child-host.mjs');
    if (existsSync(fromPkg)) return fromPkg;
  } catch {
    /* self-resolve */
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'dist/astro-child-host.mjs');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    '[untestutils/astro] astro-child-host.mjs not found — run `pnpm --filter @untestutils/astro build`',
  );
}

async function waitForReadyLine(
  logs: () => string,
  alive: () => boolean,
  timeoutMs: number,
): Promise<string> {
  const started = Date.now();
  for (;;) {
    if (!alive()) throw new Error('astro child exited before ready');
    // Match full buffer so split stdout chunks ("rea"+"dy …") still detect ready.
    const match = logs().match(/ready\s+(\S+)/);
    if (match?.[1]) return match[1];
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`astro child ready timeout\n--- logs ---\n${logs().slice(-4000)}`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function startAstroChild(
  mode: 'dev' | 'preview',
  opts: AstroProgrammaticOpts,
): Promise<Running> {
  const host = opts.host ?? '127.0.0.1';
  const root = resolve(opts.root);
  const timeoutMs = opts.readyTimeoutMs ?? 120_000;
  const script = resolveAstroChildHost();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...opts.env,
    PORT: String(opts.port),
    HOST: host,
    UNTESTUTILS_ASTRO_ROOT: root,
    UNTESTUTILS_ASTRO_PORT: String(opts.port),
    UNTESTUTILS_ASTRO_HOST: host,
    UNTESTUTILS_ASTRO_MODE: mode,
  };
  if (mode === 'preview') env.ASTRO_PREVIEW_BACKGROUND = '0';
  if (opts.configFile) env.UNTESTUTILS_ASTRO_CONFIG_FILE = opts.configFile;
  else delete env.UNTESTUTILS_ASTRO_CONFIG_FILE;

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
      stop: managed.stop,
    };
  } catch (err) {
    await managed.stop();
    throw new Error(
      `[untestutils/astro] ${mode} ready failed:\n${err instanceof Error ? err.message : String(err)}\n--- logs ---\n${managed.logs().slice(-4000)}`,
    );
  }
}

/** Start Astro dev in a child process (registry-reclaimable pid). */
export async function startAstroDev(opts: AstroProgrammaticOpts): Promise<Running> {
  return startAstroChild('dev', opts);
}

/** Start Astro preview in a child process (registry-reclaimable pid). */
export async function startAstroPreview(opts: AstroProgrammaticOpts): Promise<Running> {
  return startAstroChild('preview', opts);
}
