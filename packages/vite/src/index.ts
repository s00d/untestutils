import { existsSync } from 'node:fs';
import { resolve, join } from 'pathe';
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

export type ViteRun = 'preview' | 'dev';

/** Typed Vite config overrides (JSON-serializable subset / plain UserConfig fields). */
export type ViteConfigOverride = Record<string, unknown>;

export interface ViteOptions extends FrameworkBaseOptions {
  run?: ViteRun;
  /**
   * Merged onto the app's vite.config via `mergeConfig` (ephemeral `--config` in outDir).
   * Same role as Nuxt `nuxtConfig` overrides.
   */
  viteConfig?: ViteConfigOverride;
}

export type ViteMatrixVariant = Partial<
  Pick<
    ViteOptions,
    'env' | 'hashInputs' | 'run' | 'readyPath' | 'readyTimeoutMs' | 'workspaceDeps' | 'viteConfig'
  >
>;

function resolveViteBin(root: string): string {
  return resolveBin({
    label: 'vite',
    roots: frameworkRoots(root),
    directIds: ['vite/bin/vite.js', 'vite/bin/vite.mjs'],
    packageJsonIds: ['vite/package.json'],
    binRelative: ['bin/vite.js', 'bin/vite.mjs'],
  });
}

function hashInputsFor(opts: ViteOptions, root: string, runTag: string): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), runTag];
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

/** App build output relative to fixture root (`viteConfig.build.outDir` or `dist`). */
export function resolveViteAppOutDir(viteConfig?: ViteConfigOverride): string {
  const build = viteConfig?.build as { outDir?: unknown } | undefined;
  return typeof build?.outDir === 'string' && build.outDir.length > 0 ? build.outDir : 'dist';
}

/** Fail when preview would start without a built `index.html` (stale warm cache). */
export function assertViteBuildOutput(root: string, viteConfig?: ViteConfigOverride): void {
  const appOut = resolveViteAppOutDir(viteConfig);
  const index = join(root, appOut, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`[untestutils/vite] missing build output ${index}`);
  }
}

/**
 * Vite SPA Recipe factory.
 * `run: 'preview'` (default) — `vite build` then `vite preview`
 * `run: 'dev'` — `vite` with strictPort (never shared)
 */
export const vite: Driver<ViteOptions> = defineDriver((opts: ViteOptions): Recipe => {
  const root = resolve(opts.root);
  const runMode: ViteRun = opts.run ?? 'preview';
  const id = opts.id ?? `vite-${runMode}-${root.split('/').pop()}`;
  const bin = () => resolveViteBin(root);

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'vite',
      share: 'never',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, 'run:dev'),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      start: async ({ port, outDir }) => {
        const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
        return {
          command: process.execPath,
          args: [
            bin(),
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

  return cliFrameworkRecipe({
    id,
    root,
    label: 'vite',
    share: 'always',
    env: opts.env,
    hashInputs: hashInputsFor(opts, root, 'run:preview'),
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    workspaceDeps: opts.workspaceDeps,
    verifyArtifact: async () => {
      assertViteBuildOutput(root, opts.viteConfig);
    },
    prepare: async ({ outDir }) => {
      const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
      return {
        command: process.execPath,
        args: [bin(), 'build', ...configArgs],
        cwd: root,
      };
    },
    start: async ({ port, outDir }) => {
      const configArgs = await viteConfigArgs(root, outDir, opts.viteConfig);
      return {
        command: process.execPath,
        args: [
          bin(),
          'preview',
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
});

/** Expand one Vite recipe base into many recipes with distinct ids. */
export function matrix(
  base: ViteOptions,
  variants: Record<string, ViteMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(vite, base, variants, {
    label: 'vite',
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

export default vite;
