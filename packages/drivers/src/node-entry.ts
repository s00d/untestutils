import { existsSync } from 'node:fs';
import { resolve } from 'pathe';
import {
  defineRecipe,
  loopbackUrl,
  waitForHttpReady,
  spawnManaged,
  type Recipe,
} from '@untestutils/core';

export interface NodeEntryOptions {
  id: string;
  entry: string;
  cwd?: string;
  prepare?: string;
  hashInputs?: string[];
  readyPath?: string;
  readyTimeoutMs?: number;
  env?: Record<string, string>;
}

export function nodeEntry(opts: NodeEntryOptions): Recipe {
  const entry = resolve(opts.entry);
  const cwd = opts.cwd ? resolve(opts.cwd) : undefined;
  const ensureEntry = () => {
    if (!existsSync(entry)) {
      throw new Error(`[untestutils/nodeEntry] entry not found: ${entry}`);
    }
  };
  return defineRecipe({
    id: opts.id,
    share: 'always',
    hashInputs: async () =>
      opts.hashInputs?.map((p) => resolve(p)) ?? [entry, ...(cwd ? [cwd] : [])],
    ready: async () => {},
    prepare: opts.prepare
      ? async ({ run }) => {
          ensureEntry();
          const result = await run.command(opts.prepare!, { cwd });
          if (result.exitCode !== 0) {
            throw new Error(
              `[untestutils/nodeEntry] prepare failed:\n${result.stderr.slice(-2000)}`,
            );
          }
        }
      : undefined,
    start: async ({ port }) => {
      ensureEntry();
      const managed = spawnManaged(process.execPath, [entry], {
        cwd,
        env: {
          ...process.env,
          ...opts.env,
          PORT: String(port),
          HOST: '127.0.0.1',
        },
        captureLogs: true,
      });
      const url = loopbackUrl(port);
      try {
        await waitForHttpReady(url, {
          path: opts.readyPath ?? '/',
          timeoutMs: opts.readyTimeoutMs,
        });
      } catch (e) {
        await managed.stop();
        throw new Error(
          `[untestutils/nodeEntry] ready failed:\n${e}\n--- server logs ---\n${managed.logs().slice(-4000)}`,
        );
      }
      return { kind: 'url', url, stop: managed.stop, pid: managed.pid };
    },
  });
}

export default nodeEntry;
