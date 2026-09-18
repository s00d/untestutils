import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  type FrameworkBaseOptions,
} from '@untestutils/drivers';

export type SolidStartRun = 'preview' | 'server' | 'dev';

export interface SolidStartOptions extends FrameworkBaseOptions {
  run?: SolidStartRun;
  /** Nitro-style output entry (default `.output/server/index.mjs`). */
  serverEntry?: string;
}

function resolveVinxiBin(root: string): string {
  return resolveBin({
    label: 'solidstart',
    roots: frameworkRoots(root),
    directIds: ['vinxi/bin/cli.mjs', 'vinxi/bin/cli.js'],
    packageJsonIds: ['vinxi/package.json'],
    binRelative: ['bin/cli.mjs', 'bin/cli.js'],
  });
}

/**
 * SolidStart (Vinxi) Recipe factory.
 * `run: 'preview'` (default) — `vinxi build` + `vinxi start` / preview
 * `run: 'server'` — build + `node .output/server/index.mjs`
 * `run: 'dev'` — `vinxi dev`
 */
export function solidstart(opts: SolidStartOptions) {
  const root = resolve(opts.root);
  const runMode: SolidStartRun = opts.run ?? 'preview';
  const id = opts.id ?? `solidstart-${runMode}-${root.split('/').pop()}`;
  const bin = () => resolveVinxiBin(root);
  const serverEntry = opts.serverEntry ?? join('.output', 'server', 'index.mjs');

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'solidstart',
      share: 'never',
      env: opts.env,
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), 'dev', '--port', String(port)],
        cwd: root,
        env: { PORT: String(port) },
      }),
    });
  }

  if (runMode === 'server') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'solidstart',
      share: 'always',
      env: opts.env,
      hashInputs: opts.hashInputs ?? [root, 'run:server', serverEntry],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      prepare: () => ({
        command: process.execPath,
        args: [bin(), 'build'],
        cwd: root,
      }),
      verifyAfterPrepare: () => {
        const entry = join(root, serverEntry);
        if (!existsSync(entry)) {
          throw new Error(`[untestutils/solidstart] server entry missing at ${entry}`);
        }
        return Promise.resolve();
      },
      start: ({ port }) => ({
        command: process.execPath,
        args: [join(root, serverEntry)],
        cwd: root,
        env: { PORT: String(port), HOST: '127.0.0.1' },
      }),
    });
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'solidstart',
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
    start: ({ port }) => ({
      command: process.execPath,
      args: [bin(), 'start', '--port', String(port)],
      cwd: root,
      env: { PORT: String(port) },
    }),
  });
}

export default solidstart;
