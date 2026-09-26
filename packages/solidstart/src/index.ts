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
  matrixRecipe,
  resolveBin,
  runCommand,
  withMergedConfigOverride,
  type Driver,
  type FrameworkBaseOptions,
  type Recipe,
} from '@untestutils/core';

export type SolidStartRun = 'preview' | 'server' | 'dev';

export type SolidAppConfigOverride = Record<string, unknown>;

export interface SolidStartOptions extends FrameworkBaseOptions {
  run?: SolidStartRun;
  /** Nitro-style output entry (default `.output/server/index.mjs`). */
  serverEntry?: string;
  /**
   * Merged onto `app.config.*` via backup/restore (`withMergedConfigOverride`).
   * Same role as Nuxt `nuxtConfig`.
   */
  appConfig?: SolidAppConfigOverride;
}

export type SolidStartMatrixVariant = Partial<
  Pick<
    SolidStartOptions,
    | 'env'
    | 'hashInputs'
    | 'run'
    | 'serverEntry'
    | 'readyPath'
    | 'readyTimeoutMs'
    | 'workspaceDeps'
    | 'appConfig'
  >
>;

const APP_CONFIG_NAMES = [
  'app.config.ts',
  'app.config.mjs',
  'app.config.js',
  'app.config.mts',
  'app.config.cjs',
];

function resolveVinxiBin(root: string): string {
  return resolveBin({
    label: 'solidstart',
    roots: frameworkRoots(root),
    directIds: ['vinxi/bin/cli.mjs', 'vinxi/bin/cli.js'],
    packageJsonIds: ['vinxi/package.json'],
    binRelative: ['bin/cli.mjs', 'bin/cli.js'],
  });
}

function hashInputsFor(opts: SolidStartOptions, root: string, extra: string[]): string[] {
  const inputs = [...(opts.hashInputs ?? [root]), ...extra];
  if (opts.appConfig) inputs.push(configOverrideHashInput('appConfig', opts.appConfig));
  return inputs;
}

function resolveAppConfigPath(root: string): string {
  return findFirstExistingConfig(root, APP_CONFIG_NAMES) ?? join(root, 'app.config.ts');
}

async function withAppConfigOverride<T>(
  root: string,
  overrides: SolidAppConfigOverride | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!overrides || !Object.keys(overrides).length) return fn();
  return withMergedConfigOverride(resolveAppConfigPath(root), overrides, fn);
}

/**
 * SolidStart (Vinxi) Recipe factory.
 * `run: 'preview'` (default) — `vinxi build` + `vinxi start` / preview
 * `run: 'server'` — build + `node .output/server/index.mjs`
 * `run: 'dev'` — `vinxi dev`
 */
export const solidstart: Driver<SolidStartOptions> = defineDriver(
  (opts: SolidStartOptions): Recipe => {
    const root = resolve(opts.root);
    const runMode: SolidStartRun = opts.run ?? 'preview';
    const id = opts.id ?? `solidstart-${runMode}-${root.split('/').pop()}`;
    const bin = () => resolveVinxiBin(root);
    const serverEntry = opts.serverEntry ?? join('.output', 'server', 'index.mjs');
    const hasOverrides = Boolean(opts.appConfig && Object.keys(opts.appConfig).length);

    if (runMode === 'dev') {
      let restore: (() => Promise<void>) | undefined;
      return cliFrameworkRecipe({
        id,
        root,
        label: 'solidstart',
        share: 'never',
        env: opts.env,
        hashInputs: hashInputsFor(opts, root, ['run:dev']),
        readyPath: opts.readyPath,
        readyTimeoutMs: opts.readyTimeoutMs,
        workspaceDeps: opts.workspaceDeps,
        start: async ({ port }) => {
          if (hasOverrides) {
            restore = await installMergedConfigOverride(
              resolveAppConfigPath(root),
              opts.appConfig!,
            );
          }
          return {
            command: process.execPath,
            args: [bin(), 'dev', '--port', String(port)],
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

    if (runMode === 'server') {
      return cliFrameworkRecipe({
        id,
        root,
        label: 'solidstart',
        share: 'always',
        env: opts.env,
        hashInputs: hashInputsFor(opts, root, ['run:server', serverEntry]),
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
          const vinxi = bin();
          await withAppConfigOverride(root, opts.appConfig, async () => {
            const result = await runCommand(process.execPath, [vinxi, 'build'], {
              cwd: root,
              env: { ...process.env, ...opts.env },
              timeoutMs: opts.readyTimeoutMs ?? 300_000,
            });
            if (result.exitCode !== 0) {
              throw new Error(
                `[untestutils/solidstart] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
              );
            }
          });
        },
        verifyAfterPrepare: () => {
          const entry = join(root, serverEntry);
          if (!existsSync(entry)) {
            throw new Error(`[untestutils/solidstart] server entry missing at ${entry}`);
          }
          return Promise.resolve();
        },
        start: ({ port, host }) => ({
          command: process.execPath,
          args: [join(root, serverEntry)],
          cwd: root,
          env: { PORT: String(port), HOST: host },
        }),
      });
    }

    return cliFrameworkRecipe({
      id,
      root,
      label: 'solidstart',
      share: 'always',
      env: opts.env,
      hashInputs: hashInputsFor(opts, root, ['run:preview']),
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
        const vinxi = bin();
        await withAppConfigOverride(root, opts.appConfig, async () => {
          const result = await runCommand(process.execPath, [vinxi, 'build'], {
            cwd: root,
            env: { ...process.env, ...opts.env },
            timeoutMs: opts.readyTimeoutMs ?? 300_000,
          });
          if (result.exitCode !== 0) {
            throw new Error(
              `[untestutils/solidstart] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}\n${result.stdout.slice(-1000)}`,
            );
          }
        });
      },
      verifyArtifact: async () => {
        const index = join(root, '.output', 'public', 'index.html');
        const server = join(root, '.output', 'server', 'index.mjs');
        if (!existsSync(index) && !existsSync(server)) {
          throw new Error(
            `[untestutils/solidstart] missing preview build (.output/public or .output/server)`,
          );
        }
      },
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), 'start', '--port', String(port)],
        cwd: root,
        env: { PORT: String(port) },
      }),
    });
  },
);

/** Expand one SolidStart recipe base into many recipes with distinct ids. */
export function matrix(
  base: SolidStartOptions,
  variants: Record<string, SolidStartMatrixVariant>,
): Record<string, Recipe> {
  return matrixRecipe(solidstart, base, variants, {
    label: 'solidstart',
    merge: (b, patch, id, name) => ({
      ...b,
      ...patch,
      id,
      env: { ...(b.env ?? {}), ...(patch.env ?? {}) },
      appConfig:
        b.appConfig || patch.appConfig
          ? deepMergePlain(
              (b.appConfig ?? {}) as Record<string, unknown>,
              (patch.appConfig ?? {}) as Record<string, unknown>,
            )
          : undefined,
      hashInputs: [...(b.hashInputs ?? [b.root]), ...(patch.hashInputs ?? []), `variant:${name}`],
    }),
  });
}

export default solidstart;
