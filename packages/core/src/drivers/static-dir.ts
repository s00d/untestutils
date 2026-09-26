import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'pathe';
import { defineRecipe } from '../recipes';
import { loopbackUrl } from '../paths';
import { waitForHttpReady } from '../ready';
import { spawnManaged } from '../process';
import type { Recipe } from '../types';

export interface StaticDirOptions {
  id: string;
  root: string;
  hashInputs?: string[];
  readyPath?: string;
}

function resolveStaticChildHost(): string {
  const beside = fileURLToPath(new URL('./static-child-host.mjs', import.meta.url));
  if (existsSync(beside)) return beside;
  try {
    const pkg = createRequire(import.meta.url).resolve('@untestutils/core/package.json');
    const fromPkg = join(dirname(pkg), 'dist/drivers/static-child-host.mjs');
    if (existsSync(fromPkg)) return fromPkg;
  } catch {
    /* self-resolve */
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'dist/drivers/static-child-host.mjs');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    '[untestutils] static-child-host.mjs not found — run `pnpm --filter @untestutils/core build`',
  );
}

export function staticDir(opts: StaticDirOptions): Recipe {
  const root = resolve(opts.root);
  return defineRecipe({
    id: opts.id,
    share: 'always',
    hashInputs: async () => opts.hashInputs?.map((p) => resolve(p)) ?? [root],
    // Internal waitForHttpReady already ran — skip orchestrator defaultReady.
    ready: async () => {},
    start: async ({ port, host }) => {
      if (!existsSync(root)) {
        throw new Error(`[untestutils/staticDir] root not found: ${root}`);
      }
      const script = resolveStaticChildHost();
      const managed = spawnManaged(process.execPath, [script], {
        cwd: root,
        env: {
          ...process.env,
          PORT: String(port),
          HOST: host,
          UNTESTUTILS_STATIC_ROOT: root,
          UNTESTUTILS_STATIC_PORT: String(port),
          UNTESTUTILS_STATIC_HOST: host,
        },
        captureLogs: true,
        server: true,
      });

      const url = loopbackUrl(port, '/', host);
      try {
        const started = Date.now();
        for (;;) {
          if (!managed.alive()) {
            throw new Error('static child exited before ready');
          }
          if (managed.logs().includes('ready')) break;
          if (Date.now() - started > 30_000) {
            throw new Error(
              `static child ready timeout\n--- logs ---\n${managed.logs().slice(-4000)}`,
            );
          }
          await new Promise((r) => setTimeout(r, 30));
        }
        await waitForHttpReady(url, { path: opts.readyPath ?? '/' });
      } catch (e) {
        await managed.stop();
        throw new Error(
          `[untestutils/staticDir] ready failed:\n${e instanceof Error ? e.message : String(e)}\n--- logs ---\n${managed.logs().slice(-4000)}`,
        );
      }

      return {
        kind: 'url+dir',
        url,
        dir: root,
        pid: managed.pid,
        stop: managed.stop,
      };
    },
  });
}

export default staticDir;
