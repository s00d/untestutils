/**
 * Child-process Vite host — runs createServer/preview so the parent gets a real OS pid
 * for registry orphan reclaim across Vitest forks.
 *
 * Env:
 *   UNTESTUTILS_VITE_ROOT (required)
 *   UNTESTUTILS_VITE_PORT (required)
 *   UNTESTUTILS_VITE_HOST (default 127.0.0.1)
 *   UNTESTUTILS_VITE_MODE = dev | preview
 *   UNTESTUTILS_VITE_CONFIG_FILE = absolute path | "false" | unset
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'pathe';

type ViteMod = {
  createServer: (inline?: Record<string, unknown>) => Promise<{
    listen: () => Promise<unknown>;
    close: () => Promise<void>;
    resolvedUrls?: { local?: string[]; network?: string[] };
  }>;
  preview: (inline?: Record<string, unknown>) => Promise<{
    httpServer?: { close: (cb?: (err?: Error) => void) => void };
    close?: () => Promise<void>;
    resolvedUrls?: { local?: string[]; network?: string[] };
  }>;
};

function frameworkRoots(root: string): string[] {
  const roots = [resolve(root)];
  let dir = resolve(root);
  for (let i = 0; i < 8; i++) {
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = resolve(parent);
    roots.push(dir);
  }
  return roots;
}

async function importViteFromRoot(root: string): Promise<ViteMod> {
  let last: unknown;
  for (const r of frameworkRoots(root)) {
    try {
      const req = createRequire(join(r, 'package.json'));
      const id = req.resolve('vite');
      return (await import(pathToFileURL(id).href)) as ViteMod;
    } catch (err) {
      last = err;
    }
  }
  throw new Error(
    `[untestutils] vite-child-host: cannot import vite: ${
      last instanceof Error ? last.message : String(last)
    }`,
  );
}

async function main(): Promise<void> {
  const root = process.env.UNTESTUTILS_VITE_ROOT;
  const portRaw = process.env.UNTESTUTILS_VITE_PORT;
  const host = process.env.UNTESTUTILS_VITE_HOST ?? '127.0.0.1';
  const mode = process.env.UNTESTUTILS_VITE_MODE === 'preview' ? 'preview' : 'dev';
  const configRaw = process.env.UNTESTUTILS_VITE_CONFIG_FILE;

  if (!root || !portRaw) {
    throw new Error('[untestutils] vite-child-host: UNTESTUTILS_VITE_ROOT and _PORT required');
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`[untestutils] vite-child-host: bad port ${portRaw}`);
  }

  const configFile =
    configRaw === 'false' ? false : configRaw && configRaw.length ? configRaw : undefined;

  process.chdir(root);
  const vite = await importViteFromRoot(root);

  let close: () => Promise<void> = async () => {};

  if (mode === 'dev') {
    const server = await vite.createServer({
      root,
      configFile,
      server: { host, port, strictPort: true },
      logLevel: 'warn',
    });
    await server.listen();
    close = () => server.close();
    const url =
      server.resolvedUrls?.local?.[0] ??
      server.resolvedUrls?.network?.[0] ??
      `http://${host}:${port}/`;
    process.stdout.write(`ready ${url}\n`);
  } else {
    const server = await vite.preview({
      root,
      configFile,
      preview: { host, port, strictPort: true },
      logLevel: 'warn',
    });
    close = async () => {
      if (typeof server.close === 'function') await server.close();
      else await new Promise<void>((r) => server.httpServer?.close(() => r()) ?? r());
    };
    const url =
      server.resolvedUrls?.local?.[0] ??
      server.resolvedUrls?.network?.[0] ??
      `http://${host}:${port}/`;
    process.stdout.write(`ready ${url}\n`);
  }

  const shutdown = async () => {
    try {
      await close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // Keep event loop alive until signal.
  await new Promise<void>(() => {});
}

main().catch((err) => {
  process.stderr.write(
    `[untestutils] vite-child-host failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
