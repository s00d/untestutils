import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  findFirstExistingConfig,
  frameworkRoots,
  installMergedConfigOverride,
  loopbackUrl,
  matrixRecipe,
  resolveBin,
  runCommand,
  serializeViteMergeConfigModule,
  writeEphemeralConfig,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type SvelteKitRun = 'preview' | 'server' | 'dev';

export type ViteConfigOverride = Record<string, unknown>;

/** JSON-serializable patches merged onto `svelte.config.*` (kit / preprocess plain fields). */
export type KitConfigOverride = Record<string, unknown>;

export interface SvelteKitOptions extends FrameworkBaseOptions {
  run?: SvelteKitRun;
  /** adapter-node output entry relative to root (default `build/index.js`). */
  serverEntry?: string;
  /** Merged onto the app vite.config (SvelteKit is a Vite plugin). */
  viteConfig?: ViteConfigOverride;
  /**
   * Merged onto `svelte.config.*` via backup/restore (`withMergedConfigOverride`).
   * Prefer plain `kit.*` fields (e.g. `appDir`) — adapters/functions are not serializable.
   */
  kitConfig?: KitConfigOverride;
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
    | 'kitConfig'
  >
>;

const SVELTE_CONFIG_NAMES = [
  'svelte.config.js',
  'svelte.config.ts',
  'svelte.config.mjs',
  'svelte.config.mts',
  'svelte.config.cjs',
];

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
  if (opts.kitConfig) inputs.push(configOverrideHashInput('kitConfig', opts.kitConfig));
  return inputs;
}

function resolveSvelteConfigPath(root: string): string {
  return findFirstExistingConfig(root, SVELTE_CONFIG_NAMES) ?? join(root, 'svelte.config.js');
}

async function resolveConfigArgs(
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
 * Vite CLI for build/dev/preview (SvelteKit needs subprocess cwd; in-process Vite 8
 * + adapter-node manifests are unreliable). Same Recipe surface as other adapters.
 */
export const sveltekit: Driver<SvelteKitOptions> = defineDriver(
  (opts: SvelteKitOptions): Recipe => {
    const root = resolve(opts.root);
    const runMode: SvelteKitRun = opts.run ?? 'preview';
    const id = opts.id ?? `sveltekit-${runMode}-${root.split('/').pop()}`;
    const bin = () => resolveViteBin(root);
    const hasKit = Boolean(opts.kitConfig && Object.keys(opts.kitConfig).length);

    if (runMode === 'dev') {
      let restore: (() => Promise<void>) | undefined;
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
          if (hasKit) {
            restore = await installMergedConfigOverride(
              resolveSvelteConfigPath(root),
              opts.kitConfig!,
            );
          }
          const configArgs = await resolveConfigArgs(root, outDir, opts.viteConfig);
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
        afterStop: async () => {
          await restore?.();
          restore = undefined;
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
          const restore = hasKit
            ? await installMergedConfigOverride(resolveSvelteConfigPath(root), opts.kitConfig!)
            : undefined;
          try {
            const configArgs = await resolveConfigArgs(root, outDir, opts.viteConfig);
            // CLI prepare: in-process vite.build + Vite 8/rolldown breaks adapter-node manifests.
            const result = await runCommand(process.execPath, [bin(), 'build', ...configArgs], {
              cwd: root,
              env: { ...process.env, ...opts.env, OUT_DIR: outDir },
              timeoutMs: opts.readyTimeoutMs ?? 300_000,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `[untestutils/sveltekit] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
              );
            }
          } finally {
            await restore?.();
          }
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
        const restore = hasKit
          ? await installMergedConfigOverride(resolveSvelteConfigPath(root), opts.kitConfig!)
          : undefined;
        try {
          const configArgs = await resolveConfigArgs(root, outDir, opts.viteConfig);
          const result = await runCommand(process.execPath, [bin(), 'build', ...configArgs], {
            cwd: root,
            env: { ...process.env, ...opts.env, OUT_DIR: outDir },
            timeoutMs: opts.readyTimeoutMs ?? 300_000,
          });
          if (result.exitCode !== 0) {
            throw new Error(
              `[untestutils/sveltekit] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
            );
          }
        } finally {
          await restore?.();
        }
      },
      verifyArtifact: async () => {
        const index = join(root, 'build', 'index.html');
        const client = join(root, '.svelte-kit', 'output', 'client', 'index.html');
        if (!existsSync(index) && !existsSync(client)) {
          throw new Error(
            `[untestutils/sveltekit] missing preview build (expected ${index} or ${client})`,
          );
        }
      },
      start: async ({ port, host, outDir }) => {
        const configArgs = await resolveConfigArgs(root, outDir, opts.viteConfig);
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
      kitConfig:
        b.kitConfig || patch.kitConfig
          ? deepMergePlain(
              (b.kitConfig ?? {}) as Record<string, unknown>,
              (patch.kitConfig ?? {}) as Record<string, unknown>,
            )
          : undefined,
      hashInputs: [...(b.hashInputs ?? [b.root]), ...(patch.hashInputs ?? []), `variant:${name}`],
    }),
  });
}

export default sveltekit;
