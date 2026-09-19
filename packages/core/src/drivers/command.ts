import { resolve } from 'pathe';
import {
  defineRecipe,
  loopbackUrl,
  waitForHttpReady,
  spawnManaged,
  type Recipe,
} from '..';

export interface CommandOptions {
  id: string;
  cwd?: string;
  prepare?: string;
  /** Shell command; `$PORT`, `$HOST`, and `$OUT_DIR` are substituted */
  start?: string;
  readyPath?: string;
  readyTimeoutMs?: number;
  hashInputs?: string[];
  share?: Recipe['share'];
  env?: Record<string, string>;
}

export function command(opts: CommandOptions): Recipe {
  const cwd = opts.cwd ? resolve(opts.cwd) : undefined;
  const recipe = defineRecipe({
    id: opts.id,
    share: opts.share ?? (opts.start ? 'always' : 'prepare-only'),
    hashInputs: async () => {
      if (opts.hashInputs?.length)
        return opts.hashInputs.map((p) => resolve(cwd ?? process.cwd(), p));
      return cwd ? [cwd] : [];
    },
    ready: opts.start ? async () => {} : undefined,
    prepare: opts.prepare
      ? async ({ run, outDir }) => {
          const result = await run.command(opts.prepare!, {
            cwd,
            env: { ...process.env, ...opts.env, OUT_DIR: outDir },
          });
          if (result.exitCode !== 0) {
            throw new Error(
              `[untestutils/command] prepare failed (${result.exitCode}):\n${result.stderr.slice(-2000)}`,
            );
          }
        }
      : undefined,
    start: async ({ port, host, outDir }) => {
      if (!opts.start) {
        return { kind: 'dir', dir: outDir };
      }
      const rendered = opts.start
        .replaceAll('$PORT', String(port))
        .replaceAll('$HOST', host)
        .replaceAll('$OUT_DIR', outDir);
      const parts = rendered.trim().split(/\s+/);
      const cmd = parts[0]!;
      const args = parts.slice(1);
      const managed = spawnManaged(cmd, args, {
        cwd,
        env: {
          ...process.env,
          ...opts.env,
          PORT: String(port),
          HOST: host,
          OUT_DIR: outDir,
        },
        captureLogs: true,
      });
      const url = loopbackUrl(port, '/', host);
      try {
        await waitForHttpReady(url, {
          path: opts.readyPath ?? '/',
          timeoutMs: opts.readyTimeoutMs,
        });
      } catch (e) {
        await managed.stop();
        throw new Error(`${e}\n--- logs ---\n${managed.logs().slice(-4000)}`);
      }
      return { kind: 'url+dir', url, dir: outDir, stop: managed.stop, pid: managed.pid };
    },
  }) as Recipe & { root?: string };
  if (cwd) recipe.root = cwd;
  return recipe;
}

export default command;
