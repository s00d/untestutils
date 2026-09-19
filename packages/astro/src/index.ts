import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  type FrameworkBaseOptions,
} from '@untestutils/core';

export type AstroRun = 'preview' | 'server' | 'dev';

export interface AstroOptions extends FrameworkBaseOptions {
  run?: AstroRun;
  /** SSR entry relative to root (default dist/server/entry.mjs). */
  serverEntry?: string;
}

function resolveAstroBin(root: string): string {
  return resolveBin({
    label: 'astro',
    roots: frameworkRoots(root),
    directIds: ['astro/astro.js'],
    packageJsonIds: ['astro/package.json'],
    binRelative: ['astro.js', 'bin/astro.mjs'],
  });
}

/**
 * Astro Recipe factory.
 * `run: 'preview'` (default) — `astro build` + `astro preview`
 * `run: 'server'` — build + `node dist/server/entry.mjs`
 * `run: 'dev'` — `astro dev`
 */
export function astro(opts: AstroOptions) {
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
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), 'dev', '--host', '127.0.0.1', '--port', String(port)],
        cwd: root,
      }),
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
      hashInputs: opts.hashInputs ?? [root, 'run:server', entryRel],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      prepare: () => ({
        command: process.execPath,
        args: [bin(), 'build'],
        cwd: root,
      }),
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
    hashInputs: opts.hashInputs ?? [root, 'run:preview'],
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    prepare: () => ({
      command: process.execPath,
      args: [bin(), 'build'],
      cwd: root,
    }),
    start: ({ port, host }) => ({
      command: process.execPath,
      args: [bin(), 'preview', '--host', host, '--port', String(port)],
      cwd: root,
      env: { ASTRO_PREVIEW_BACKGROUND: '0' },
    }),
  });
}

export default astro;
