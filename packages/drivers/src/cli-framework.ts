import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';
import {
  defineRecipe,
  loopbackUrl,
  waitForHttpReady,
  spawnManaged,
  runCommand,
  type Recipe,
  type PrepareCtx,
  type StartCtx,
  type SharePolicy,
} from '@untestutils/core';

export interface ResolveBinOptions {
  roots: string[];
  packageJsonIds?: string[];
  binRelative?: string[];
  directIds?: string[];
  label: string;
}

/**
 * Resolve a CLI entry from the app under test (or cwd).
 */
export function resolveBin(opts: ResolveBinOptions): string {
  const seen = new Set<string>();
  for (const root of opts.roots) {
    const key = resolve(root);
    if (seen.has(key)) continue;
    seen.add(key);
    const pkgPath = join(key, 'package.json');
    if (!existsSync(pkgPath)) continue;
    let req: NodeRequire;
    try {
      req = createRequire(pkgPath);
    } catch {
      continue;
    }
    for (const id of opts.directIds ?? []) {
      try {
        return req.resolve(id);
      } catch {
        /* try next */
      }
    }
    for (const pkgId of opts.packageJsonIds ?? []) {
      try {
        const pkgJson = req.resolve(pkgId);
        const pkgRoot = dirname(pkgJson);
        for (const rel of opts.binRelative ?? []) {
          const bin = join(pkgRoot, rel);
          if (existsSync(bin)) return bin;
        }
      } catch {
        /* try next */
      }
    }
  }
  throw new Error(
    `[untestutils/${opts.label}] cannot resolve CLI from ${opts.roots.join(', ')}`,
  );
}

export type SpawnSpec = {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export interface CliFrameworkRecipeOptions {
  id: string;
  root: string;
  label: string;
  share?: SharePolicy;
  env?: Record<string, string>;
  hashInputs?: string[];
  readyPath?: string;
  readyTimeoutMs?: number;
  prepare?: (ctx: PrepareCtx & { root: string }) => Promise<SpawnSpec | void> | SpawnSpec | void;
  start: (ctx: StartCtx & { root: string }) => SpawnSpec | Promise<SpawnSpec>;
  verifyAfterPrepare?: (ctx: PrepareCtx & { root: string }) => Promise<void>;
}

export type FrameworkBaseOptions = {
  id?: string;
  root: string;
  env?: Record<string, string>;
  hashInputs?: string[];
  readyPath?: string;
  readyTimeoutMs?: number;
};

export function frameworkRoots(root: string): string[] {
  return [root, process.cwd()];
}

/**
 * Fail early with a clear message when a fixture root (or its package.json) is missing.
 * Call from prepare/start — not at Recipe factory time (hashInputs may use placeholder roots).
 */
export function assertAppRoot(
  root: string,
  label: string,
  opts: { requirePackageJson?: boolean } = {},
): string {
  const resolved = resolve(root);
  if (!existsSync(resolved)) {
    throw new Error(`[untestutils/${label}] root not found: ${resolved}`);
  }
  if (opts.requirePackageJson !== false) {
    const pkg = join(resolved, 'package.json');
    if (!existsSync(pkg)) {
      throw new Error(`[untestutils/${label}] package.json not found in root: ${resolved}`);
    }
  }
  return resolved;
}

/**
 * Shared Recipe shell for framework CLI drivers (vite/next/astro/…).
 */
export function cliFrameworkRecipe(opts: CliFrameworkRecipeOptions): Recipe {
  const root = resolve(opts.root);
  const ensureRoot = () => assertAppRoot(root, opts.label);
  const recipe = defineRecipe({
    id: opts.id,
    share: opts.share ?? (opts.prepare ? 'always' : 'never'),
    hashInputs: async () => {
      const inputs = [...(opts.hashInputs ?? [root])];
      if (opts.env && Object.keys(opts.env).length) {
        inputs.push(`env:${JSON.stringify(opts.env)}`);
      }
      return inputs;
    },
    ready: async () => {},
    prepare: opts.prepare
      ? async (ctx) => {
          ensureRoot();
          const enriched = { ...ctx, root };
          const spec = await opts.prepare!(enriched);
          if (spec) {
            const result = await runCommand(spec.command, spec.args, {
              cwd: spec.cwd ?? root,
              env: { ...process.env, ...opts.env, ...spec.env, OUT_DIR: ctx.outDir },
              timeoutMs: opts.readyTimeoutMs ?? 300_000,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `[untestutils/${opts.label}] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
              );
            }
          }
          if (opts.verifyAfterPrepare) await opts.verifyAfterPrepare(enriched);
        }
      : undefined,
    start: async (ctx) => {
      ensureRoot();
      const spec = await opts.start({ ...ctx, root });
      const managed = spawnManaged(spec.command, spec.args, {
        cwd: spec.cwd ?? root,
        env: {
          ...process.env,
          ...opts.env,
          ...spec.env,
          PORT: String(ctx.port),
          HOST: '127.0.0.1',
        },
        captureLogs: true,
      });
      const url = loopbackUrl(ctx.port);
      try {
        await waitForHttpReady(url, {
          path: opts.readyPath ?? '/',
          timeoutMs: opts.readyTimeoutMs ?? 120_000,
        });
      } catch (e) {
        await managed.stop();
        throw new Error(
          `[untestutils/${opts.label}] ready failed:\n${e}\n--- logs ---\n${managed.logs().slice(-4000)}`,
        );
      }
      return {
        kind: 'url+dir',
        url,
        dir: ctx.outDir,
        stop: managed.stop,
        pid: managed.pid,
      };
    },
  }) as Recipe & { root?: string };
  recipe.root = root;
  return recipe;
}

/** @internal */
export const _cliInternals = { resolveBin, runCommand, assertAppRoot };
