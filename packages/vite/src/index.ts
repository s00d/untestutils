import { resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  type FrameworkBaseOptions,
} from '@untestutils/drivers';

export type ViteRun = 'preview' | 'dev';

export interface ViteOptions extends FrameworkBaseOptions {
  run?: ViteRun;
}

function resolveViteBin(root: string): string {
  return resolveBin({
    label: 'vite',
    roots: frameworkRoots(root),
    directIds: ['vite/bin/vite.js', 'vite/bin/vite.mjs'],
    packageJsonIds: ['vite/package.json'],
    binRelative: ['bin/vite.js', 'bin/vite.mjs'],
  });
}

/**
 * Vite SPA Recipe factory.
 * `run: 'preview'` (default) — `vite build` then `vite preview`
 * `run: 'dev'` — `vite` with strictPort (never shared)
 */
export function vite(opts: ViteOptions) {
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
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        cwd: root,
      }),
    });
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'vite',
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

export default vite;
