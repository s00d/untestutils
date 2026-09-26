/**
 * Child-process Astro host — runs astro.dev / astro.preview so the parent gets a
 * real OS pid for registry orphan reclaim across Vitest forks.
 *
 * Env:
 *   UNTESTUTILS_ASTRO_ROOT (required)
 *   UNTESTUTILS_ASTRO_PORT (required)
 *   UNTESTUTILS_ASTRO_HOST (default 127.0.0.1)
 *   UNTESTUTILS_ASTRO_MODE = dev | preview
 *   UNTESTUTILS_ASTRO_CONFIG_FILE (optional)
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'pathe';

type AstroDevServer = {
  address?: { port?: number };
  stop?: () => Promise<void>;
  close?: () => Promise<void>;
};

type AstroPreviewServer = {
  host?: string;
  port?: number;
  stop?: () => Promise<void>;
  close?: () => Promise<void>;
};

type AstroApi = {
  dev: (opts: Record<string, unknown>) => Promise<AstroDevServer>;
  preview: (opts: Record<string, unknown>) => Promise<AstroPreviewServer>;
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

async function importAstroFromRoot(root: string): Promise<AstroApi> {
  let last: unknown;
  for (const r of frameworkRoots(root)) {
    try {
      const req = createRequire(join(r, 'package.json'));
      const id = req.resolve('astro');
      return (await import(pathToFileURL(id).href)) as AstroApi;
    } catch (err) {
      last = err;
    }
  }
  throw new Error(
    `[untestutils] astro-child-host: cannot import astro: ${
      last instanceof Error ? last.message : String(last)
    }`,
  );
}

async function main(): Promise<void> {
  const root = process.env.UNTESTUTILS_ASTRO_ROOT;
  const portRaw = process.env.UNTESTUTILS_ASTRO_PORT;
  const host = process.env.UNTESTUTILS_ASTRO_HOST ?? '127.0.0.1';
  const mode = process.env.UNTESTUTILS_ASTRO_MODE === 'preview' ? 'preview' : 'dev';
  const configFile = process.env.UNTESTUTILS_ASTRO_CONFIG_FILE;

  if (!root || !portRaw) {
    throw new Error('[untestutils] astro-child-host: UNTESTUTILS_ASTRO_ROOT and _PORT required');
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`[untestutils] astro-child-host: bad port ${portRaw}`);
  }

  process.chdir(root);
  const astro = await importAstroFromRoot(root);

  let close: () => Promise<void> = async () => {};
  let readyUrl = `http://${host}:${port}/`;

  if (mode === 'dev') {
    const server = await astro.dev({
      root: resolve(root),
      ...(configFile ? { configFile } : {}),
      server: { host, port },
      logLevel: 'warn',
    });
    close = async () => {
      if (typeof server.stop === 'function') await server.stop();
      else if (typeof server.close === 'function') await server.close();
    };
    const bound = server.address?.port;
    if (bound) readyUrl = `http://${host}:${bound}/`;
  } else {
    const server = await astro.preview({
      root: resolve(root),
      ...(configFile ? { configFile } : {}),
      server: { host, port },
      logLevel: 'warn',
    });
    close = async () => {
      if (typeof server.stop === 'function') await server.stop();
      else if (typeof server.close === 'function') await server.close();
    };
    readyUrl = `http://${(server.host as string) || host}:${server.port ?? port}/`;
  }

  process.stdout.write(`ready ${readyUrl}\n`);

  const shutdown = async () => {
    try {
      await close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await new Promise<void>(() => {});
}

main().catch((err) => {
  process.stderr.write(
    `[untestutils] astro-child-host failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
