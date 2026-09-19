import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'pathe';
import { defineRecipe } from '../recipes';
import { loopbackUrl } from '../paths';
import { waitForHttpReady } from '../ready';
import type { Recipe } from '../types';

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

export interface StaticDirOptions {
  id: string;
  root: string;
  hashInputs?: string[];
  readyPath?: string;
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
      const server = createServer(async (req, res) => {
        try {
          const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] || '/');
          let filePath = join(root, urlPath === '/' ? 'index.html' : urlPath);
          // path traversal guard
          const normalized = normalize(filePath);
          if (!normalized.startsWith(normalize(root) + sep) && normalized !== normalize(root)) {
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
            // SPA fallback
            const fallback = join(root, 'index.html');
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

      await new Promise<void>((resolvePromise, reject) => {
        server.listen(port, host, () => resolvePromise());
        server.once('error', (err) => {
          reject(
            new Error(`[untestutils/staticDir] listen failed on ${host}:${port}: ${err.message}`, {
              cause: err,
            }),
          );
        });
      });

      const url = loopbackUrl(port, '/', host);
      await waitForHttpReady(url, { path: opts.readyPath ?? '/' });

      return {
        kind: 'url+dir',
        url,
        dir: root,
        stop: async () =>
          new Promise((resolvePromise) => {
            server.close(() => resolvePromise());
          }),
      };
    },
  });
}

export default staticDir;
