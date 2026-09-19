import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  frameworkRoots,
  matrixRecipe,
  resolveBin,
  serializeViteMergeConfigModule,
  writeEphemeralConfig,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type RemixRun = 'server' | 'dev';

export type ViteConfigOverride = Record<string, unknown>;

export interface RemixOptions extends FrameworkBaseOptions {
  run?: RemixRun;
  /** Server build entry relative to root (default `build/server/index.js`). */
  serverEntry?: string;
  /**
   * When set, build/dev go through Vite with `--config` merge (Remix Vite apps).
   * Same role as Nuxt `nuxtConfig`.
   */
  viteConfig?: ViteConfigOverride;
}

export type RemixMatrixVariant = Partial<
  Pick<
    RemixOptions,
    | 'env'
    | 'hashInputs'
    | 'run'
    | 'serverEntry'
    | 'readyPath'
    | 'readyTimeoutMs'
    | 'workspaceDeps'
    | 'viteConfig'
  >
>;

function resolveRemixCli(root: string): string {
  return resolveBin({
    label: 'remix',
    roots: frameworkRoots(root),
    directIds: ['@remix-run/dev/dist/cli.js', '@remix-run/dev/cli.js'],
    packageJsonIds: ['@remix-run/dev/package.json'],
    binRelative: ['dist/cli.js', 'cli.js'],
  });
}

function resolveRemixServe(root: string): string {
  return resolveBin({
    label: 'remix',
    roots: frameworkRoots(root),
    directIds: ['@remix-run/serve/dist/cli.js', 'remix-serve'],
    packageJsonIds: ['@remix-run/serve/package.json'],
    binRelative: ['dist/cli.js', 'bin.js'],
  });
}

function resolveViteBin(root: string): string {
  return resolveBin({
    label: 'remix',
    roots: frameworkRoots(root),
    directIds: ['vite/bin/vite.js', 'vite/bin/vite.mjs'],
    packageJsonIds: ['vite/package.json'],
    binRelative: ['bin/vite.js', 'bin/vite.mjs'],
  });
}

function hashInputsFor(opts: RemixOptions, root: string, extra: string[]): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), ...extra];
  if (opts.viteConfig) inputs.push(configOverrideHashInput('viteConfig', opts.viteConfig));
  return inputs;
}

async function viteConfigArgs(
  root: string,
  outDir: string,
  viteConfig: ViteConfigOverride | undefined,
): Promise<string[]> {
  if (!viteConfig || !Object.keys(viteConfig).length) return [];
  const configPath = join(outDir, 'vite.untestutils.mjs');
  await writeEphemeralConfig(
    configPath,
    serializeViteMergeConfigModule({ appRoot: root, overrides: viteConfig }),
  );
  return ['--config', configPath];
}

/**
 * Remix (Vite) Recipe factory.
 * `run: 'server'` (default) — vite/remix build + remix-serve
 * `run: 'dev'` — remix vite:dev / vite
 */
export const remix: Driver<RemixOptions> = defineDriver((opts: RemixOptions): Recipe => {
  const root = resolve(opts.root);
  const runMode: RemixRun = opts.run ?? 'server';
  const id = opts.id ?? `remix-${runMode}-${root.split('/').pop()}`;
  const serverEntry = opts.serverEntry ?? join('build', 'server', 'index.js');
  const hasViteOverrides = Boolean(opts.viteConfig && Object.keys(opts.viteConfig).length);

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'remix',
      share: 'never',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:dev']),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      start: async ({ port, outDir }) => {
        if (hasViteOverrides) {
          const viteBin = resolveViteBin(root);
          const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
          return {
            command: process.execPath,
            args: [
              viteBin,
              ...configArgs,
              '--port',
              String(port),
              '--strictPort',
              '--host',
              '127.0.0.1',
            ],
            cwd: root,
          };
        }
        try {
          const cli = resolveRemixCli(root);
          return {
            command: process.execPath,
            args: [cli, 'vite:dev', '--port', String(port)],
            cwd: root,
            env: { PORT: String(port) },
          };
        } catch {
          const viteBin = resolveViteBin(root);
          return {
            command: process.execPath,
            args: [viteBin, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
            cwd: root,
          };
        }
      },
    });
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'remix',
    share: 'always',
    env: opts.env,
    hashInputs: hashInputsFor(opts, root, ['run:server', serverEntry]),
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    workspaceDeps: opts.workspaceDeps,
    prepare: async ({ outDir }) => {
      if (hasViteOverrides) {
        const viteBin = resolveViteBin(root);
        const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
        return {
          command: process.execPath,
          args: [viteBin, 'build', ...configArgs],
          cwd: root,
        };
      }
      try {
        const cli = resolveRemixCli(root);
        return {
          command: process.execPath,
          args: [cli, 'vite:build'],
          cwd: root,
        };
      } catch {
        const viteBin = resolveViteBin(root);
        return {
          command: process.execPath,
          args: [viteBin, 'build'],
          cwd: root,
        };
      }
    },
    verifyAfterPrepare: () => {
      const entry = join(root, serverEntry);
      if (!existsSync(entry)) {
        throw new Error(`[untestutils/remix] server build missing at ${entry}`);
      }
      return Promise.resolve();
    },
    start: ({ port, host }) => {
      const serve = resolveRemixServe(root);
      return {
        command: process.execPath,
        args: [serve, join(root, serverEntry)],
        cwd: root,
        env: { PORT: String(port), HOST: host },
      };
    },
  });
});

/** Expand one Remix recipe base into many recipes with distinct ids. */
export function matrix(
  base: RemixOptions,
  variants: Record<string, RemixMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(remix, base, variants, {
    label: 'remix',
    merge: (b, patch, id, name) => ({
      ...b,
      ...patch,
      id,
      env: { ...(b.env ?? {}), ...(patch.env ?? {}) },
      viteConfig:
        b.viteConfig || patch.viteConfig
          ? deepMergePlain(
              (b.viteConfig ?? {}) as Record<string, unknown>,
              (patch.viteConfig ?? {}) as Record<string, unknown>,
            )
          : undefined,
      hashInputs: [...(b.hashInputs ?? [b.root]), ...(patch.hashInputs ?? []), `variant:${name}`],
    }),
  });
}

export default remix;
