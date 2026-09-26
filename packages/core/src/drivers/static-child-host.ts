/**
 * Child-process static file server — real OS pid for registry orphan reclaim.
 *
 * Env:
 *   UNTESTUTILS_STATIC_ROOT (required)
 *   UNTESTUTILS_STATIC_PORT (required)
 *   UNTESTUTILS_STATIC_HOST (default 127.0.0.1)
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

async function main(): Promise<void> {
  const root = process.env.UNTESTUTILS_STATIC_ROOT;
  const portRaw = process.env.UNTESTUTILS_STATIC_PORT;
  const host = process.env.UNTESTUTILS_STATIC_HOST ?? '127.0.0.1';
  if (!root || !portRaw) {
    throw new Error('[untestutils] static-child-host: ROOT and PORT required');
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`[untestutils] static-child-host: bad port ${portRaw}`);
  }
  const rootResolved = resolve(root);
  if (!existsSync(rootResolved)) {
    throw new Error(`[untestutils] static-child-host: root not found: ${rootResolved}`);
  }

  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] || '/');
      let filePath = join(rootResolved, urlPath === '/' ? 'index.html' : urlPath);
      const normalized = normalize(filePath);
      if (
        !normalized.startsWith(normalize(rootResolved) + sep) &&
        normalized !== normalize(rootResolved)
      ) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      let st = await stat(normalized).catch(() => null);
      if (st?.isDirectory()) {
        filePath = join(normalized, 'index.html');
        st = await stat(filePath).catch(() => null);
      } else {
        filePath = normalized;
      }
      if (!st?.isFile()) {
        const fallback = join(rootResolved, 'index.html');
        const fb = await stat(fallback).catch(() => null);
        if (fb?.isFile()) {
          const body = await readFile(fallback);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(body);
          return;
        }
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      const body = await readFile(filePath);
      res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
      res.end(body);
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
    }
  });

  await new Promise<void>((resolveListen, reject) => {
    server.listen(port, host, () => resolveListen());
    server.once('error', reject);
  });

  process.stdout.write(`ready http://${host}:${port}/\n`);

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await new Promise<void>(() => {});
}

main().catch((err) => {
  process.stderr.write(
    `[untestutils] static-child-host failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
