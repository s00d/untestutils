import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'pathe';
import { defineRecipe } from '../recipes';
import { loopbackUrl } from '../paths';
import { waitForHttpReady } from '../ready';
import { spawnManaged, runCommand } from '../process';
import type { Recipe, PrepareCtx, StartCtx, SharePolicy, Running } from '../types';
import { appendWorkspaceHashInputs } from './matrix';

export interface ResolveBinOptions {
  roots: string[];
  packageJsonIds?: string[];
  binRelative?: string[];
  directIds?: string[];
  label: string;
}

/**
 * Resolve a CLI entry from the app under test (or cwd).
 *
 * Prefer filesystem paths under `node_modules/` first — packages with tight
 * `exports` (e.g. vinxi) reject `require.resolve('pkg/bin/…')` / `pkg/package.json`.
 */
export function resolveBin(opts: ResolveBinOptions): string {
  const seen = new Set<string>();
  for (const root of opts.roots) {
    const key = resolve(root);
    if (seen.has(key)) continue;
    seen.add(key);
    const pkgPath = join(key, 'package.json');
    if (!existsSync(pkgPath)) continue;

    for (const id of opts.directIds ?? []) {
      const fsPath = join(key, 'node_modules', id);
      if (existsSync(fsPath)) return fsPath;
    }
    for (const pkgId of opts.packageJsonIds ?? []) {
      const pkgName = pkgId.replace(/\/package\.json$/, '');
      const pkgRoot = join(key, 'node_modules', pkgName);
      for (const rel of opts.binRelative ?? []) {
        const bin = join(pkgRoot, rel);
        if (existsSync(bin)) return bin;
      }
    }

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
  throw new Error(`[untestutils/${opts.label}] cannot resolve CLI from ${opts.roots.join(', ')}`);
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
  /** See {@link FrameworkBaseOptions.workspaceDeps}. */
  workspaceDeps?: boolean | 'auto';
  prepare?: (ctx: PrepareCtx & { root: string }) => Promise<SpawnSpec | void> | SpawnSpec | void;
  /**
   * Return a SpawnSpec (CLI) or a fully started {@link Running} (programmatic Vite/Astro APIs).
   */
  start: (ctx: StartCtx & { root: string }) => SpawnSpec | Running | Promise<SpawnSpec | Running>;
  verifyAfterPrepare?: (ctx: PrepareCtx & { root: string }) => Promise<void>;
  /**
   * Called after prepare and on warm cache hits.
   * Throw to invalidate warm cache and force rebuild (e.g. missing vite outDir).
   */
  verifyArtifact?: (outDir: string) => Promise<void>;
  /** Called after the managed process stops (e.g. restore ephemeral next.config). */
  afterStop?: () => Promise<void> | void;
}

export type FrameworkBaseOptions = {
  id?: string;
  root: string;
  env?: Record<string, string>;
  hashInputs?: string[];
  readyPath?: string;
  readyTimeoutMs?: number;
  /**
   * Include monorepo package src dirs in prepare hash.
   * - true — always
   * - auto — when a pnpm workspace is detected above root
   * - omit / false — off (default for CLI adapters)
   */
  workspaceDeps?: boolean | 'auto';
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
  // Warm/live/registry paths only call verifyArtifact — promote verifyAfterPrepare.
  const verifyArtifact =
    opts.verifyArtifact ??
    (opts.verifyAfterPrepare
      ? async () => {
          await opts.verifyAfterPrepare!({ outDir: root, root } as PrepareCtx & { root: string });
        }
      : undefined);
  const recipe = defineRecipe({
    id: opts.id,
    share: opts.share ?? (opts.prepare ? 'always' : 'never'),
    hashInputs: async () => {
      let inputs = [...(opts.hashInputs ?? [root])];
      if (opts.env && Object.keys(opts.env).length) {
        inputs.push(`env:${JSON.stringify(opts.env)}`);
      }
      inputs = await appendWorkspaceHashInputs(inputs, root, opts.workspaceDeps);
      return inputs;
    },
    ready: async () => {},
    verifyArtifact,
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
      const started = await opts.start({ ...ctx, root });
      if (started && typeof started === 'object' && 'kind' in started) {
        const running = started as Running;
        if ('url' in running && running.url) {
          try {
            await waitForHttpReady(running.url, {
              path: opts.readyPath ?? '/',
              timeoutMs: opts.readyTimeoutMs ?? 120_000,
            });
          } catch (e) {
            if (running.stop) await running.stop();
            throw new Error(`[untestutils/${opts.label}] ready failed:\n${e}`);
          }
        }
        if (!opts.afterStop) return running;
        const prevStop = running.stop;
        return {
          ...running,
          stop: async (stopOpts) => {
            if (prevStop) await prevStop(stopOpts);
            await opts.afterStop?.();
          },
        };
      }

      const spec = started as SpawnSpec;
      const managed = spawnManaged(spec.command, spec.args, {
        cwd: spec.cwd ?? root,
        env: {
          ...process.env,
          ...opts.env,
          ...spec.env,
          PORT: String(ctx.port),
          HOST: ctx.host,
        },
        captureLogs: true,
      });
      const url = loopbackUrl(ctx.port, '/', ctx.host);
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
        stop: async (stopOpts) => {
          await managed.stop(stopOpts);
          if (opts.afterStop) await opts.afterStop();
        },
        pid: managed.pid,
      };
    },
  }) as Recipe & { root?: string };
  recipe.root = root;
  return recipe;
}

/** @internal */
export const _cliInternals: {
  resolveBin: typeof resolveBin;
  runCommand: typeof runCommand;
  assertAppRoot: typeof assertAppRoot;
} = { resolveBin, runCommand, assertAppRoot };
