import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  type FrameworkBaseOptions,
} from '@untestutils/drivers';

export type RemixRun = 'server' | 'dev';

export interface RemixOptions extends FrameworkBaseOptions {
  run?: RemixRun;
  /** Server build entry relative to root (default `build/server/index.js`). */
  serverEntry?: string;
}

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

/**
 * Remix (Vite) Recipe factory.
 * `run: 'server'` (default) — vite/remix build + remix-serve
 * `run: 'dev'` — remix vite:dev / vite
 */
export function remix(opts: RemixOptions) {
  const root = resolve(opts.root);
  const runMode: RemixRun = opts.run ?? 'server';
  const id = opts.id ?? `remix-${runMode}-${root.split('/').pop()}`;
  const serverEntry = opts.serverEntry ?? join('build', 'server', 'index.js');

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'remix',
      share: 'never',
      env: opts.env,
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => {
        // Prefer remix CLI vite:dev; fall back to vite.
        try {
          const cli = resolveRemixCli(root);
          return {
            command: process.execPath,
            args: [cli, 'vite:dev', '--port', String(port)],
            cwd: root,
            env: { PORT: String(port) },
          };
        } catch {
          const vite = resolveViteBin(root);
          return {
            command: process.execPath,
            args: [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
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
    hashInputs: opts.hashInputs ?? [root, 'run:server', serverEntry],
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    prepare: () => {
      try {
        const cli = resolveRemixCli(root);
        return {
          command: process.execPath,
          args: [cli, 'vite:build'],
          cwd: root,
        };
      } catch {
        const vite = resolveViteBin(root);
        return {
          command: process.execPath,
          args: [vite, 'build'],
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
    start: ({ port }) => {
      const serve = resolveRemixServe(root);
      return {
        command: process.execPath,
        args: [serve, join(root, serverEntry)],
        cwd: root,
        env: { PORT: String(port), HOST: '127.0.0.1' },
      };
    },
  });
}

export default remix;
