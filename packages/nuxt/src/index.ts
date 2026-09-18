import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'pathe';
import { pathToFileURL } from 'node:url';
import {
  defineRecipe,
  loopbackUrl,
  waitForHttpReady,
  spawnManaged,
  withQuietLogger,
  type Recipe,
} from '@untestutils/core';
import { assertAppRoot, staticDir } from '@untestutils/drivers';

type RecipeWithRoot = Recipe & { root?: string };

export type NuxtRun = 'server' | 'static' | 'dev';

export interface NuxtOptions {
  id?: string;
  root: string;
  run?: NuxtRun;
  nuxtConfig?: Record<string, unknown>;
  hashInputs?: string[];
  /** Include nearby monorepo package src dirs in prepare hash (auto when workspace exists). */
  workspaceDeps?: boolean | 'auto';
  /** Build/runtime env (e.g. STRATEGY=prefix for fixture variants). */
  env?: Record<string, string>;
  readyTimeoutMs?: number;
  /**
   * Nitro deploy preset (`node-server`, `azure`, `cloudflare_module`, …).
   * Merged into `nuxtConfig.nitro.preset` and included in the prepare hash.
   */
  preset?: string;
}

function resolveKit(rootDir: string): string {
  // Fixtures often omit package.json; createRequire still resolves from that path.
  assertAppRoot(rootDir, 'nuxt', { requirePackageJson: false });
  try {
    return createRequire(join(rootDir, 'package.json')).resolve('@nuxt/kit');
  } catch (e) {
    throw new Error(
      `[untestutils/nuxt] cannot resolve @nuxt/kit from ${rootDir} (install nuxt or @nuxt/kit in the fixture/workspace)`,
      { cause: e },
    );
  }
}

/**
 * Resolve Nuxt CLI entry for `run: 'dev'`.
 * Prefers legacy `nuxi/cli`; falls back to `nuxt/bin/nuxt.mjs` (Nuxt 4 / @nuxt/cli).
 * Walks fixture → cwd → workspace root so bare fixture package.json still works.
 */
function resolveNuxiEntry(rootDir: string): string {
  const roots = [rootDir, process.cwd(), findWorkspaceRoot(rootDir)].filter(
    (d): d is string => Boolean(d),
  );
  const seen = new Set<string>();
  for (const dir of roots) {
    const key = resolve(dir);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      return createRequire(join(dir, 'package.json')).resolve('nuxi/cli');
    } catch {
      /* try next */
    }
  }
  for (const dir of roots) {
    const key = resolve(dir);
    try {
      const nuxtPkg = createRequire(join(key, 'package.json')).resolve('nuxt/package.json');
      const bin = join(dirname(nuxtPkg), 'bin/nuxt.mjs');
      if (existsSync(bin)) return bin;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `[untestutils/nuxt] cannot resolve Nuxt CLI from ${rootDir} (tried nuxi/cli and nuxt/bin/nuxt.mjs)`,
  );
}

function findWorkspaceRoot(from: string): string | undefined {
  let dir = resolve(from);
  for (let i = 0; i < 12; i++) {
    if (
      existsSync(join(dir, 'pnpm-workspace.yaml')) ||
      existsSync(join(dir, 'pnpm-workspace.yml'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

async function workspacePackageSrcDirs(from: string): Promise<string[]> {
  const ws = findWorkspaceRoot(from);
  if (!ws) return [];
  const packagesDir = join(ws, 'packages');
  if (!existsSync(packagesDir)) return [];
  const names = await readdir(packagesDir, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const e of names) {
    if (!e.isDirectory()) continue;
    const src = join(packagesDir, e.name, 'src');
    if (existsSync(src)) out.push(src);
  }
  return out;
}

async function resolveHashInputs(opts: NuxtOptions, root: string): Promise<string[]> {
  const inputs = [...(opts.hashInputs ?? [root])];
  const wantWs =
    opts.workspaceDeps === true ||
    (opts.workspaceDeps !== false && Boolean(findWorkspaceRoot(root)));
  if (wantWs) {
    inputs.push(...(await workspacePackageSrcDirs(root)));
  }
  if (opts.env && Object.keys(opts.env).length) {
    inputs.push(`env:${JSON.stringify(opts.env)}`);
  }
  if (opts.nuxtConfig) {
    inputs.push(`nuxtConfig:${JSON.stringify(opts.nuxtConfig)}`);
  }
  if (opts.preset) {
    inputs.push(`preset:${opts.preset}`);
  }
  return inputs;
}

function mergeNuxtConfig(opts: NuxtOptions): Record<string, unknown> {
  const base = { ...(opts.nuxtConfig ?? {}) };
  if (!opts.preset) return base;
  const nitro = {
    ...((base.nitro as Record<string, unknown> | undefined) ?? {}),
    preset: opts.preset,
  };
  return { ...base, nitro };
}

async function withEnv<T>(
  env: Record<string, string> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!env || !Object.keys(env).length) return fn();
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function buildNuxtApp(
  rootDir: string,
  outDir: string,
  nuxtConfig?: Record<string, unknown>,
  ssr = true,
) {
  return withQuietLogger(async () => {
    const kit = (await import(pathToFileURL(_internals.resolveKit(rootDir)).href)) as {
      loadNuxt: (opts: Record<string, unknown>) => Promise<{ close: () => Promise<void> }>;
      buildNuxt: (nuxt: { close: () => Promise<void> }) => Promise<void>;
    };
    const nuxt = await kit.loadNuxt({
      cwd: rootDir,
      dev: false,
      overrides: {
        ...(nuxtConfig ?? {}),
        ssr,
        buildDir: join(outDir, '.nuxt'),
        sourcemap: { server: false, client: false },
        vite: { build: { minify: false } },
        nitro: {
          output: { dir: join(outDir, 'output') },
          minify: false,
          ...((nuxtConfig?.nitro as Record<string, unknown> | undefined) ?? {}),
        },
      },
    });
    try {
      if (!ssr) {
        // generate path uses nitro prerender — call build then rely on generate via nuxi for static
      }
      await kit.buildNuxt(nuxt);
    } finally {
      await nuxt.close().catch(() => {});
    }
  });
}

async function generateNuxtApp(
  rootDir: string,
  outDir: string,
  nuxtConfig?: Record<string, unknown>,
) {
  return withQuietLogger(async () => {
    const kit = (await import(pathToFileURL(_internals.resolveKit(rootDir)).href)) as {
      loadNuxt: (opts: Record<string, unknown>) => Promise<{ close: () => Promise<void> }>;
      buildNuxt: (nuxt: { close: () => Promise<void> }) => Promise<void>;
    };
    const nuxt = await kit.loadNuxt({
      cwd: rootDir,
      dev: false,
      overrides: {
        ...(nuxtConfig ?? {}),
        ssr: true,
        buildDir: join(outDir, '.nuxt'),
        nitro: {
          output: { dir: join(outDir, 'output') },
          static: true,
          prerender: { crawlLinks: true },
          ...((nuxtConfig?.nitro as Record<string, unknown> | undefined) ?? {}),
        },
      },
    });
    try {
      await kit.buildNuxt(nuxt);
    } finally {
      await nuxt.close().catch(() => {});
    }
  });
}

function findServerEntry(outDir: string): string {
  const candidates = [
    join(outDir, 'output', 'server', 'index.mjs'),
    join(outDir, 'output', 'server', 'index.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`[untestutils/nuxt] server entry not found under ${outDir}/output/server`);
}

function findPublicDir(outDir: string): string {
  const candidates = [join(outDir, 'output', 'public'), join(outDir, 'dist')];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`[untestutils/nuxt] public dir not found under ${outDir}`);
}

/** @internal test seams */
export const _internals = {
  resolveKit,
  resolveNuxiEntry,
  buildNuxtApp,
  generateNuxtApp,
  findServerEntry,
  findPublicDir,
  findWorkspaceRoot,
  workspacePackageSrcDirs,
  resolveHashInputs,
  withEnv,
};

/**
 * Nuxt Recipe factory.
 * `run: 'server'` — buildNuxt + node nitro server
 * `run: 'static'` — generate + static file server
 * `run: 'dev'` — nuxi `_dev` only (HMR fixtures; never shared). Default path is still build → nitro.
 */
export function nuxt(opts: NuxtOptions): Recipe {
  const root = resolve(opts.root);
  const runMode: NuxtRun = opts.run ?? 'server';
  const id = opts.id ?? `nuxt-${runMode}-${root.split('/').pop()}`;
  const startEnv = { ...(opts.env ?? {}) };
  const ensureRoot = () => assertAppRoot(root, 'nuxt', { requirePackageJson: false });

  if (runMode === 'dev') {
    const recipe = defineRecipe({
      id,
      share: 'never',
      /* v8 ignore next */
      hashInputs: async () => _internals.resolveHashInputs(opts, root),
      ready: async () => {},
      start: async ({ port }) => {
        ensureRoot();
        return _internals.withEnv(opts.env, async () => {
          const nuxi = _internals.resolveNuxiEntry(root);
          const managed = spawnManaged(process.execPath, [nuxi, '_dev'], {
            cwd: root,
            env: {
              ...process.env,
              ...startEnv,
              PORT: String(port),
              HOST: '127.0.0.1',
              NODE_ENV: 'development',
              // Harness may restart after a hard kill left a Nuxt lock file.
              NUXT_IGNORE_LOCK: '1',
            },
            captureLogs: true,
          });
          const url = loopbackUrl(port);
          try {
            await waitForHttpReady(url, {
              timeoutMs: opts.readyTimeoutMs ?? 180_000,
              rejectBodyIncludes: ['__NUXT_LOADING__'],
            });
          } catch (e) {
            await managed.stop();
            /* v8 ignore next */
            throw new Error(
              `[untestutils/nuxt] ready failed:\n${e}\n--- logs ---\n${managed.logs().slice(-4000)}`,
            );
          }
          return { kind: 'url', url, stop: managed.stop, pid: managed.pid };
        });
      },
    }) as RecipeWithRoot;
    recipe.root = root;
    return recipe;
  }

  if (runMode === 'static') {
    const recipe = defineRecipe({
      id,
      share: 'always',
      hashInputs: async () => _internals.resolveHashInputs(opts, root),
      ready: async () => {},
      prepare: async ({ outDir }) => {
        ensureRoot();
        await _internals.withEnv(opts.env, () =>
          _internals.generateNuxtApp(root, outDir, mergeNuxtConfig(opts)),
        );
      },
      start: async (ctx) => {
        const publicDir = _internals.findPublicDir(ctx.outDir);
        const serving = staticDir({ id: `${id}-static-serve`, root: publicDir });
        return serving.start(ctx);
      },
    }) as RecipeWithRoot;
    recipe.root = root;
    return recipe;
  }

  const recipe = defineRecipe({
    id,
    share: 'always',
    hashInputs: async () => _internals.resolveHashInputs(opts, root),
    ready: async () => {},
    prepare: async ({ outDir }) => {
      ensureRoot();
      await _internals.withEnv(opts.env, () =>
        _internals.buildNuxtApp(root, outDir, mergeNuxtConfig(opts), true),
      );
    },
    start: async ({ port, outDir }) => {
      ensureRoot();
      const entry = _internals.findServerEntry(outDir);
      const managed = spawnManaged(process.execPath, [entry], {
        cwd: root,
        env: {
          ...process.env,
          ...startEnv,
          PORT: String(port),
          HOST: '127.0.0.1',
          NODE_ENV: 'production',
        },
        captureLogs: true,
      });
      const url = loopbackUrl(port);
      try {
        await waitForHttpReady(url, { timeoutMs: opts.readyTimeoutMs ?? 60_000 });
      } catch (e) {
        await managed.stop();
        throw new Error(
          `[untestutils/nuxt] ready failed:\n${e}\n--- logs ---\n${managed.logs().slice(-4000)}`,
        );
      }
      return { kind: 'url+dir', url, dir: outDir, stop: managed.stop, pid: managed.pid };
    },
  }) as RecipeWithRoot;
  recipe.root = root;
  return recipe;
}

export { waitForHttpReady };

export type MatrixVariant = Partial<
  Pick<
    NuxtOptions,
    'env' | 'nuxtConfig' | 'hashInputs' | 'run' | 'preset' | 'readyTimeoutMs' | 'workspaceDeps'
  >
>;

/**
 * Expand one Nuxt recipe base into many recipes with distinct ids / identity.
 * Variant key `default` keeps `base.id`; other keys become `${baseId}__${key}`.
 */
export function matrix(
  base: NuxtOptions,
  variants: Record<string, MatrixVariant>,
): Record<string, Recipe> {
  if (!base.root) {
    throw new Error('[untestutils/nuxt] matrix() requires base.root');
  }
  const baseId = base.id ?? `nuxt-${base.run ?? 'server'}`;
  const out: Record<string, Recipe> = {};
  for (const [name, patch] of Object.entries(variants)) {
    const id = name === 'default' ? baseId : `${baseId}__${name}`;
    if (out[id]) {
      throw new Error(`[untestutils/nuxt] matrix() duplicate id "${id}"`);
    }
    const baseNitro = (base.nuxtConfig?.nitro as Record<string, unknown> | undefined) ?? {};
    const patchNitro = (patch.nuxtConfig?.nitro as Record<string, unknown> | undefined) ?? {};
    const merged: NuxtOptions = {
      ...base,
      ...patch,
      id,
      env: { ...(base.env ?? {}), ...(patch.env ?? {}) },
      nuxtConfig: {
        ...(base.nuxtConfig ?? {}),
        ...(patch.nuxtConfig ?? {}),
        nitro: { ...baseNitro, ...patchNitro },
      },
      hashInputs: [
        ...(base.hashInputs ?? [base.root]),
        ...(patch.hashInputs ?? []),
        `variant:${name}`,
      ],
    };
    out[id] = nuxt(merged);
  }
  return out;
}

/** Nuxt-aware goto wait helpers are provided by vitest/playwright runners via playwright page. */
export default nuxt;
