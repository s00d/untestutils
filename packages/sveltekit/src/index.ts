import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  type FrameworkBaseOptions,
} from '@untestutils/drivers';

export type SvelteKitRun = 'preview' | 'server' | 'dev';

export interface SvelteKitOptions extends FrameworkBaseOptions {
  run?: SvelteKitRun;
  /** adapter-node output entry relative to root (default `build/index.js`). */
  serverEntry?: string;
}

function resolveViteBin(root: string): string {
  return resolveBin({
    label: 'sveltekit',
    roots: frameworkRoots(root),
    directIds: ['vite/bin/vite.js', 'vite/bin/vite.mjs'],
    packageJsonIds: ['vite/package.json'],
    binRelative: ['bin/vite.js', 'bin/vite.mjs'],
  });
}

/**
 * SvelteKit Recipe factory.
 * `run: 'preview'` (default) — `vite build` + `vite preview`
 * `run: 'server'` — build + `node build` (adapter-node)
 * `run: 'dev'` — `vite dev`
 */
export function sveltekit(opts: SvelteKitOptions) {
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
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        cwd: root,
      }),
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
            `[untestutils/sveltekit] server entry missing at ${entry} (use @sveltejs/adapter-node)`,
          );
        }
        return Promise.resolve();
      },
      start: ({ port }) => ({
        command: process.execPath,
        args: [join(root, entryRel)],
        cwd: root,
        env: {
          PORT: String(port),
          HOST: '127.0.0.1',
          ORIGIN: `http://127.0.0.1:${port}`,
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
      args: [bin(), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      cwd: root,
    }),
  });
}

export default sveltekit;
