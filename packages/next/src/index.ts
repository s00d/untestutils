import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  appendWorkspaceHashInputs,
  assertAppRoot,
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  defineRecipe,
  findFirstExistingConfig,
  frameworkRoots,
  installMergedConfigOverride,
  matrixRecipe,
  resolveBin,
  runCommand,
  staticDir,
  withMergedConfigOverride,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type NextRun = 'server' | 'dev' | 'static';

export type NextConfigOverride = Record<string, unknown>;

export interface NextOptions extends FrameworkBaseOptions {
  run?: NextRun;
  /**
   * Merged onto `next.config.*` via backup/restore (`withMergedConfigOverride`).
   * Next has no `--config` flag — the file is restored after prepare (build)
   * or after the process stops (`dev`). Same role as Nuxt `nuxtConfig`.
   */
  nextConfig?: NextConfigOverride;
}

export type NextMatrixVariant = Partial<
  Pick<
    NextOptions,
    'env' | 'hashInputs' | 'run' | 'readyPath' | 'readyTimeoutMs' | 'workspaceDeps' | 'nextConfig'
  >
>;

const NEXT_CONFIG_NAMES = [
  'next.config.mjs',
  'next.config.js',
  'next.config.cjs',
  'next.config.ts',
  'next.config.mts',
];

function resolveNextBin(root: string): string {
  return resolveBin({
    label: 'next',
    roots: frameworkRoots(root),
    directIds: ['next/dist/bin/next'],
    packageJsonIds: ['next/package.json'],
    binRelative: ['dist/bin/next'],
  });
}

function hashInputsFor(opts: NextOptions, root: string, extra: string[]): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), ...extra];
  if (opts.nextConfig) inputs.push(configOverrideHashInput('nextConfig', opts.nextConfig));
  return inputs;
}

function resolveNextConfigPath(root: string): string {
  return findFirstExistingConfig(root, NEXT_CONFIG_NAMES) ?? join(root, 'next.config.mjs');
}

async function withNextConfigOverride<T>(
  root: string,
  overrides: NextConfigOverride | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!overrides || !Object.keys(overrides).length) return fn();
  return withMergedConfigOverride(resolveNextConfigPath(root), overrides, fn);
}

/**
 * Next.js Recipe factory.
 * `run: 'server'` (default) — `next build` + `next start`
 * `run: 'dev'` — `next dev` (never shared)
 * `run: 'static'` — `next build` with export + staticDir on `out/`
 */
export const next: Driver<NextOptions> = defineDriver((opts: NextOptions): Recipe => {
  const root = resolve(opts.root);
  const runMode: NextRun = opts.run ?? 'server';
  const id = opts.id ?? `next-${runMode}-${root.split('/').pop()}`;
  const bin = () => resolveNextBin(root);
  const hasOverrides = Boolean(opts.nextConfig && Object.keys(opts.nextConfig).length);

  if (runMode === 'dev') {
    let restore: (() => Promise<void>) | undefined;
    return cliFrameworkRecipe({
      id,
      root,
      label: 'next',
      share: 'never',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:dev']),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      start: async ({ port }) => {
        if (hasOverrides) {
          restore = await installMergedConfigOverride(
            resolveNextConfigPath(root),
            opts.nextConfig!,
          );
        }
        return {
          command: process.execPath,
          args: [bin(), 'dev', '-H', '127.0.0.1', '-p', String(port)],
          cwd: root,
          env: { PORT: String(port) },
        };
      },
      afterStop: async () => {
        await restore?.();
        restore = undefined;
      },
    });
  }

  if (runMode === 'static') {
    const ensureRoot = () => assertAppRoot(root, 'next');
    const recipe = defineRecipe({
      id,
      share: 'always',
      hashInputs: async () => {
        let inputs = hashInputsFor(opts, root, ['run:static']);
        if (opts.env) inputs = [...inputs, `env:${JSON.stringify(opts.env)}`];
        inputs = await appendWorkspaceHashInputs(inputs, root, opts.workspaceDeps);
        return inputs;
      },
      ready: async () => {},
      prepare: async () => {
        ensureRoot();
        const nextBin = bin();
        await withNextConfigOverride(root, opts.nextConfig, async () => {
          const result = await runCommand(process.execPath, [nextBin, 'build'], {
            cwd: root,
            env: { ...process.env, ...opts.env },
            timeoutMs: opts.readyTimeoutMs ?? 300_000,
          });
          if (result.exitCode !== 0) {
            throw new Error(
              `[untestutils/next] static build failed:\n${result.stderr.slice(-2000)}`,
            );
          }
        });
        const out = join(root, 'out');
        if (!existsSync(out)) {
          throw new Error(
            `[untestutils/next] expected ${out} after static export (set output: 'export' in next.config)`,
          );
        }
      },
      verifyArtifact: async () => {
        const index = join(root, 'out', 'index.html');
        if (!existsSync(index)) {
          throw new Error(`[untestutils/next] missing static export ${index}`);
        }
      },
      start: async (ctx) => {
        ensureRoot();
        const publicDir = join(root, 'out');
        const serving = staticDir({ id: `${id}-static-serve`, root: publicDir });
        return serving.start(ctx);
      },
    }) as Recipe & { root?: string };
    recipe.root = root;
    return recipe;
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'next',
    share: 'always',
    env: opts.env,
    hashInputs: hashInputsFor(opts, root, ['run:server']),
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    workspaceDeps: opts.workspaceDeps,
    prepare: async () => {
      if (!hasOverrides) {
        return {
          command: process.execPath,
          args: [bin(), 'build'],
          cwd: root,
        };
      }
      const nextBin = bin();
      await withNextConfigOverride(root, opts.nextConfig, async () => {
        const result = await runCommand(process.execPath, [nextBin, 'build'], {
          cwd: root,
          env: { ...process.env, ...opts.env },
          timeoutMs: opts.readyTimeoutMs ?? 300_000,
        });
        if (result.exitCode !== 0) {
          throw new Error(
            `[untestutils/next] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
          );
        }
      });
    },
    start: ({ port }) => ({
      command: process.execPath,
      args: [bin(), 'start', '-H', '127.0.0.1', '-p', String(port)],
      cwd: root,
      env: { PORT: String(port) },
    }),
  });
});

/** Expand one Next recipe base into many recipes with distinct ids. */
export function matrix(
  base: NextOptions,
  variants: Record<string, NextMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(next, base, variants, {
    label: 'next',
    merge: (b, patch, id, name) => ({
      ...b,
      ...patch,
      id,
      env: { ...(b.env ?? {}), ...(patch.env ?? {}) },
      nextConfig:
        b.nextConfig || patch.nextConfig
          ? deepMergePlain(
              (b.nextConfig ?? {}) as Record<string, unknown>,
              (patch.nextConfig ?? {}) as Record<string, unknown>,
            )
          : undefined,
      hashInputs: [...(b.hashInputs ?? [b.root]), ...(patch.hashInputs ?? []), `variant:${name}`],
    }),
  });
}

export default next;
