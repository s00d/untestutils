import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  findFirstExistingConfig,
  frameworkRoots,
  matrixRecipe,
  resolveBin,
  serializeAstroMergeConfigModule,
  serializeDefaultExport,
  writeEphemeralConfig,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type AstroRun = 'preview' | 'server' | 'dev';

export type AstroConfigOverride = Record<string, unknown>;

export interface AstroOptions extends FrameworkBaseOptions {
  run?: AstroRun;
  /** SSR entry relative to root (default dist/server/entry.mjs). */
  serverEntry?: string;
  /**
   * Merged onto the app's astro.config via ephemeral `--config` (same role as Nuxt `nuxtConfig`).
   */
  astroConfig?: AstroConfigOverride;
}

export type AstroMatrixVariant = Partial<
  Pick<
    AstroOptions,
    | 'env'
    | 'hashInputs'
    | 'run'
    | 'serverEntry'
    | 'readyPath'
    | 'readyTimeoutMs'
    | 'workspaceDeps'
    | 'astroConfig'
  >
>;

const ASTRO_CONFIG_NAMES = [
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  'astro.config.mts',
  'astro.config.cjs',
];

function resolveAstroBin(root: string): string {
  return resolveBin({
    label: 'astro',
    roots: frameworkRoots(root),
    directIds: ['astro/astro.js'],
    packageJsonIds: ['astro/package.json'],
    binRelative: ['astro.js', 'bin/astro.mjs'],
  });
}

function hashInputsFor(opts: AstroOptions, root: string, extra: string[]): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), ...extra];
  if (opts.astroConfig) inputs.push(configOverrideHashInput('astroConfig', opts.astroConfig));
  return inputs;
}

async function astroConfigArgs(
  root: string,
  outDir: string,
  astroConfig: AstroConfigOverride | undefined,
): Promise<string[]> {
  if (!astroConfig || !Object.keys(astroConfig).length) return [];
  const configPath = join(outDir, 'astro.untestutils.mjs');
  const userConfig = findFirstExistingConfig(root, ASTRO_CONFIG_NAMES);
  const contents = userConfig
    ? serializeAstroMergeConfigModule({
        baseImportSpecifier: pathToFileURL(userConfig).href,
        overrides: astroConfig,
      })
    : serializeDefaultExport(astroConfig);
  await writeEphemeralConfig(configPath, contents);
  return ['--config', configPath];
}

/**
 * Astro Recipe factory.
 * `run: 'preview'` (default) — `astro build` + `astro preview`
 * `run: 'server'` — build + `node dist/server/entry.mjs`
 * `run: 'dev'` — `astro dev`
 */
export const astro: Driver<AstroOptions> = defineDriver((opts: AstroOptions): Recipe => {
  const root = resolve(opts.root);
  const runMode: AstroRun = opts.run ?? 'preview';
  const id = opts.id ?? `astro-${runMode}-${root.split('/').pop()}`;
  const bin = () => resolveAstroBin(root);

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'astro',
      share: 'never',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:dev']),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      start: async ({ port, outDir }) => {
        const configArgs = await astroConfigArgs(root, outDir, opts.astroConfig);
        return {
          command: process.execPath,
          args: [bin(), 'dev', ...configArgs, '--host', '127.0.0.1', '--port', String(port)],
          cwd: root,
        };
      },
    });
  }

  if (runMode === 'server') {
    const entryRel = opts.serverEntry ?? join('dist', 'server', 'entry.mjs');
    return cliFrameworkRecipe({
      id,
      root,
      label: 'astro',
      share: 'always',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:server', entryRel]),
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      workspaceDeps: opts.workspaceDeps,
      prepare: async ({ outDir }) => {
        const configArgs = await astroConfigArgs(root, outDir, opts.astroConfig);
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
            `[untestutils/astro] SSR entry missing at ${entry} (use @astrojs/node adapter)`,
          );
        }
        return Promise.resolve();
      },
      start: ({ port, host }) => ({
        command: process.execPath,
        args: [join(root, entryRel)],
        cwd: root,
        env: { PORT: String(port), HOST: host },
      }),
    });
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'astro',
    share: 'always',
    env: opts.env,
    hashInputs: hashInputsFor(opts, root, ['run:preview']),
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    workspaceDeps: opts.workspaceDeps,
    prepare: async ({ outDir }) => {
      const configArgs = await astroConfigArgs(root, outDir, opts.astroConfig);
      return {
        command: process.execPath,
        args: [bin(), 'build', ...configArgs],
        cwd: root,
      };
    },
    start: async ({ port, host, outDir }) => {
      const configArgs = await astroConfigArgs(root, outDir, opts.astroConfig);
      return {
        command: process.execPath,
        args: [bin(), 'preview', ...configArgs, '--host', host, '--port', String(port)],
        cwd: root,
        env: { ASTRO_PREVIEW_BACKGROUND: '0' },
      };
    },
  });
});

/** Expand one Astro recipe base into many recipes with distinct ids. */
export function matrix(
  base: AstroOptions,
  variants: Record<string, AstroMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(astro, base, variants, {
    label: 'astro',
    merge: (b, patch, id, name) => ({
      ...b,
      ...patch,
      id,
      env: { ...(b.env ?? {}), ...(patch.env ?? {}) },
      astroConfig:
        b.astroConfig || patch.astroConfig
          ? deepMergePlain(
              (b.astroConfig ?? {}) as Record<string, unknown>,
              (patch.astroConfig ?? {}) as Record<string, unknown>,
            )
          : undefined,
      hashInputs: [...(b.hashInputs ?? [b.root]), ...(patch.hashInputs ?? []), `variant:${name}`],
    }),
  });
}

export default astro;
