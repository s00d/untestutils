import { existsSync } from 'node:fs';
import { join, resolve } from 'pathe';
import {
  cliFrameworkRecipe,
  frameworkRoots,
  resolveBin,
  staticDir,
  type FrameworkBaseOptions,
} from '@untestutils/drivers';
import { defineRecipe, runCommand, type Recipe } from '@untestutils/core';

export type NextRun = 'server' | 'dev' | 'static';

export interface NextOptions extends FrameworkBaseOptions {
  run?: NextRun;
}

function resolveNextBin(root: string): string {
  return resolveBin({
    label: 'next',
    roots: frameworkRoots(root),
    directIds: ['next/dist/bin/next'],
    packageJsonIds: ['next/package.json'],
    binRelative: ['dist/bin/next'],
  });
}

/**
 * Next.js Recipe factory.
 * `run: 'server'` (default) — `next build` + `next start`
 * `run: 'dev'` — `next dev` (never shared)
 * `run: 'static'` — `next build` with export + staticDir on `out/`
 */
export function next(opts: NextOptions): Recipe {
  const root = resolve(opts.root);
  const runMode: NextRun = opts.run ?? 'server';
  const id = opts.id ?? `next-${runMode}-${root.split('/').pop()}`;
  const bin = () => resolveNextBin(root);

  if (runMode === 'dev') {
    return cliFrameworkRecipe({
      id,
      root,
      label: 'next',
      share: 'never',
      env: opts.env,
      hashInputs: opts.hashInputs ?? [root, 'run:dev'],
      readyPath: opts.readyPath,
      readyTimeoutMs: opts.readyTimeoutMs,
      start: ({ port }) => ({
        command: process.execPath,
        args: [bin(), 'dev', '-H', '127.0.0.1', '-p', String(port)],
        cwd: root,
        env: { PORT: String(port) },
      }),
    });
  }

  if (runMode === 'static') {
    const recipe = defineRecipe({
      id,
      share: 'always',
      hashInputs: async () => [
        ...(opts.hashInputs ?? [root]),
        'run:static',
        ...(opts.env ? [`env:${JSON.stringify(opts.env)}`] : []),
      ],
      ready: async () => {},
      prepare: async () => {
        const nextBin = bin();
        const result = await runCommand(process.execPath, [nextBin, 'build'], {
          cwd: root,
          env: { ...process.env, ...opts.env },
          timeoutMs: opts.readyTimeoutMs ?? 300_000,
        });
        if (result.exitCode !== 0) {
          throw new Error(
            `[untestutils/next] static build failed:\n${result.stderr.slice(-2000)}`,
          );
        }
        const out = join(root, 'out');
        if (!existsSync(out)) {
          throw new Error(
            `[untestutils/next] expected ${out} after static export (set output: 'export' in next.config)`,
          );
        }
      },
      start: async (ctx) => {
        const publicDir = join(root, 'out');
        const serving = staticDir({ id: `${id}-static-serve`, root: publicDir });
        return serving.start(ctx);
      },
    }) as Recipe & { root?: string };
    recipe.root = root;
    return recipe;
  }

  return cliFrameworkRecipe({
    id,
    root,
    label: 'next',
    share: 'always',
    env: opts.env,
    hashInputs: opts.hashInputs ?? [root, 'run:server'],
    readyPath: opts.readyPath,
    readyTimeoutMs: opts.readyTimeoutMs,
    prepare: () => ({
      command: process.execPath,
      args: [bin(), 'build'],
      cwd: root,
    }),
    start: ({ port }) => ({
      command: process.execPath,
      args: [bin(), 'start', '-H', '127.0.0.1', '-p', String(port)],
      cwd: root,
      env: { PORT: String(port) },
    }),
  });
}

export default next;
