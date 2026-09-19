import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  frameworkRoots,
  loopbackUrl,
  matrixRecipe,
  resolveBin,
  serializeViteMergeConfigModule,
  writeEphemeralConfig,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type SvelteKitRun = 'preview' | 'server' | 'dev';

export type ViteConfigOverride = Record<string, unknown>;

export interface SvelteKitOptions extends FrameworkBaseOptions {
  run?: SvelteKitRun;
  /** adapter-node output entry relative to root (default `build/index.js`). */
  serverEntry?: string;
  /** Merged onto the app vite.config (SvelteKit is a Vite plugin). */
  viteConfig?: ViteConfigOverride;
}

export type SvelteKitMatrixVariant = Partial<
  Pick<
    SvelteKitOptions,
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

function resolveViteBin(root: string): string {
  return resolveBin({
    label: 'sveltekit',
    roots: frameworkRoots(root),
    directIds: ['vite/bin/vite.js', 'vite/bin/vite.mjs'],
    packageJsonIds: ['vite/package.json'],
    binRelative: ['bin/vite.js', 'bin/vite.mjs'],
  });
}

function hashInputsFor(opts: SvelteKitOptions, root: string, extra: string[]): string[] {
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
 * SvelteKit Recipe factory.
 * `run: 'preview'` (default) — `vite build` + `vite preview`
 * `run: 'server'` — build + `node build` (adapter-node)
 * `run: 'dev'` — `vite dev`
 */
export const sveltekit: Driver<SvelteKitOptions> = defineDriver(
  (opts: SvelteKitOptions): Recipe => {
    const root = resolve(opts.root);
    const runMode: SvelteKitRun = opts.run ?? 'preview';
    const id = opts.id ?? `sveltekit-${runMode}-${root.split('/').pop()}`;
    const bin = () => resolveViteBin(root);

    if (runMode === 'dev') {
      return cliFrameworkRecipe({
        id,
        root,
        label: 'sveltekit',
        share: 'never',
        env: opts.env,
        hashInputs: hashInputsFor(opts, root, ['run:dev']),
        readyPath: opts.readyPath,
        readyTimeoutMs: opts.readyTimeoutMs,
        workspaceDeps: opts.workspaceDeps,
        start: async ({ port, outDir }) => {
          const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
          return {
            command: process.execPath,
            args: [
              bin(),
              'dev',
              ...configArgs,
              '--host',
              '127.0.0.1',
              '--port',
              String(port),
              '--strictPort',
            ],
            cwd: root,
          };
        },
      });
    }

    if (runMode === 'server') {
      const entryRel = opts.serverEntry ?? join('build', 'index.js');
      return cliFrameworkRecipe({
        id,
        root,
        label: 'sveltekit',
        share: 'always',
        env: opts.env,
        hashInputs: hashInputsFor(opts, root, ['run:server', entryRel]),
        readyPath: opts.readyPath,
        readyTimeoutMs: opts.readyTimeoutMs,
        workspaceDeps: opts.workspaceDeps,
        prepare: async ({ outDir }) => {
          const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
          return {
            command: process.execPath,
            args: [bin(), 'build', ...configArgs],
            cwd: root,
          };
        },
        verifyAfterPrepare: () => {
          const entry = join(root, entryRel);
          if (!existsSync(entry)) {
            throw new Error(
              `[untestutils/sveltekit] server entry missing at ${entry} (use @sveltejs/adapter-node)`,
            );
          }
          return Promise.resolve();
        },
        start: ({ port, host }) => ({
          command: process.execPath,
          args: [join(root, entryRel)],
          cwd: root,
          env: {
            PORT: String(port),
            HOST: host,
            ORIGIN: loopbackUrl(port, '/', host).replace(/\/$/, ''),
          },
        }),
      });
    }

    return cliFrameworkRecipe({
      id,
      root,
      label: 'sveltekit',
      share: 'always',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:preview']),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      prepare: async ({ outDir }) => {
        const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
        return {
          command: process.execPath,
          args: [bin(), 'build', ...configArgs],
          cwd: root,
        };
      },
      start: async ({ port, host, outDir }) => {
        const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
        return {
          command: process.execPath,
          args: [
            bin(),
            'preview',
            ...configArgs,
            '--host',
            host,
            '--port',
            String(port),
            '--strictPort',
          ],
          cwd: root,
        };
      },
    });
  },
);

/** Expand one SvelteKit recipe base into many recipes with distinct ids. */
export function matrix(
  base: SvelteKitOptions,
  variants: Record<string, SvelteKitMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(sveltekit, base, variants, {
    label: 'sveltekit',
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

export default sveltekit;
