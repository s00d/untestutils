import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  configOverrideHashInput,
  deepMergePlain,
  defineDriver,
  findFirstExistingConfig,
  matrixRecipe,
  serializeAstroMergeConfigModule,
  serializeDefaultExport,
  writeEphemeralConfig,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';
import { runAstroBuild, startAstroDev, startAstroPreview } from './astro-api';

export type AstroRun = 'preview' | 'server' | 'dev';

export type AstroConfigOverride = Record<string, unknown>;

export interface AstroOptions extends FrameworkBaseOptions {
  run?: AstroRun;
  /** SSR entry relative to root (default dist/server/entry.mjs). */
  serverEntry?: string;
  /**
   * Merged onto the app's astro.config via ephemeral config (same role as Nuxt `nuxtConfig`).
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

function hashInputsFor(opts: AstroOptions, root: string, extra: string[]): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), ...extra];
  if (opts.astroConfig) inputs.push(configOverrideHashInput('astroConfig', opts.astroConfig));
  return inputs;
}

async function resolveConfigFile(
  root: string,
  outDir: string,
  astroConfig: AstroConfigOverride | undefined,
): Promise<string | undefined> {
  if (!astroConfig || !Object.keys(astroConfig).length) return undefined;
  const configPath = join(outDir, 'astro.untestutils.mjs');
  const userConfig = findFirstExistingConfig(root, ASTRO_CONFIG_NAMES);
  const contents = userConfig
    ? serializeAstroMergeConfigModule({
        baseImportSpecifier: pathToFileURL(userConfig).href,
        overrides: astroConfig,
      })
    : serializeDefaultExport(astroConfig);
  await writeEphemeralConfig(configPath, contents);
  return configPath;
}

/**
 * Astro Recipe factory (programmatic `astro` package APIs for build/dev/preview).
 * `run: 'preview'` (default) — build + preview
 * `run: 'server'` — build + `node dist/server/entry.mjs`
 * `run: 'dev'` — astro.dev()
 */
export const astro: Driver<AstroOptions> = defineDriver((opts: AstroOptions): Recipe => {
  const root = resolve(opts.root);
  const runMode: AstroRun = opts.run ?? 'preview';
  const id = opts.id ?? `astro-${runMode}-${root.split('/').pop()}`;

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
      start: async ({ port, outDir, host }) => {
        const configFile = await resolveConfigFile(root, outDir, opts.astroConfig);
        return startAstroDev({ root, port, host, configFile, env: opts.env });
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
        const configFile = await resolveConfigFile(root, outDir, opts.astroConfig);
        await runAstroBuild({ root, configFile, env: opts.env });
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
      const configFile = await resolveConfigFile(root, outDir, opts.astroConfig);
      await runAstroBuild({ root, configFile, env: opts.env });
    },
    verifyArtifact: async () => {
      const index = join(root, 'dist', 'index.html');
      if (!existsSync(index)) {
        throw new Error(`[untestutils/astro] missing preview build ${index}`);
      }
    },
    start: async ({ port, host, outDir }) => {
      const configFile = await resolveConfigFile(root, outDir, opts.astroConfig);
      return startAstroPreview({ root, port, host, configFile, env: opts.env });
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
