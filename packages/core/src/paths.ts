import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, normalize, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';

/** Always bind/serve on IPv4 loopback — never `localhost` (::1 trap). */
export const LOOPBACK_HOST = '127.0.0.1';

export function loopbackUrl(port: number, path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `http://${LOOPBACK_HOST}:${port}${p}`;
}

export function normalizeBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '::1') {
      u.hostname = LOOPBACK_HOST;
    }
    let href = u.toString();
    if (u.pathname === '/' && !href.endsWith('/')) href += '/';
    return href;
  } catch {
    return url.replace('localhost', LOOPBACK_HOST).replace('[::1]', LOOPBACK_HOST);
  }
}

export function resolveArtifactsRoot(cwd = process.cwd()): string {
  if (process.env.UNTESTUTILS_ARTIFACTS_DIR) {
    return resolve(cwd, process.env.UNTESTUTILS_ARTIFACTS_DIR);
  }
  const repoRoot = findRepoRoot(cwd);
  return join(repoRoot, '.untestutils');
}

export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) || existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export function assertNotInsideWorkspacePackage(
  artifactsRoot: string,
  workspaceRoots: string[],
): void {
  const normalized = normalize(resolve(artifactsRoot));
  for (const root of workspaceRoots) {
    const pkgRoot = normalize(resolve(root));
    if (normalized === pkgRoot || normalized.startsWith(pkgRoot + '/')) {
      // allow if artifacts is specifically .untestutils under repo, not under a package member that isn't repo root
      const pkgJson = join(pkgRoot, 'package.json');
      if (!existsSync(pkgJson)) continue;
      try {
        const name = JSON.parse(readFileSync(pkgJson, 'utf8')).name as string | undefined;
        // refuse when path is inside a named workspace package that is NOT the published root named untestutils
        if (name && name !== 'untestutils' && !normalized.includes('/.untestutils')) {
          throw new Error(
            `[untestutils] artifactsDir must not live inside workspace package "${name}" (${pkgRoot}). Use <repo>/.untestutils instead.`,
          );
        }
      } catch (e) {
        /* v8 ignore next */
        if (e instanceof Error && e.message.startsWith('[untestutils]')) throw e;
      }
    }
  }
}

/** Refuse writing builds into a directory that is a workspace package (has package.json + is under workspace). */
export function refuseArtifactsInsidePackage(outDir: string): void {
  const target = normalize(resolve(outDir));
  if (/(^|\/|\\)\.untestutils(\/|\\|$)/.test(target)) return;

  let dir = target;
  for (let i = 0; i < 12; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      let name: string | undefined;
      try {
        name = JSON.parse(readFileSync(pkgPath, 'utf8')).name as string | undefined;
      } catch {
        name = undefined;
      }
      if (name && name !== 'untestutils') {
        let walk = dir;
        for (let j = 0; j < 12; j++) {
          if (existsSync(join(walk, 'pnpm-workspace.yaml'))) {
            throw new Error(
              `[untestutils] refusing to write artifacts inside workspace package "${name}" (${dir}). Use <repo>/.untestutils/builds.`,
            );
          }
          const parent = dirname(walk);
          /* v8 ignore next */
          if (parent === walk) break;
          walk = parent;
        }
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

export function isWorkspacePackageDir(dir: string): boolean {
  return existsSync(join(dir, 'package.json'));
}

export function toFilePath(urlOrPath: string | URL): string {
  if (typeof urlOrPath === 'string') {
    if (urlOrPath.startsWith('file:')) return fileURLToPath(urlOrPath);
    return isAbsolute(urlOrPath) ? urlOrPath : resolve(urlOrPath);
  }
  return fileURLToPath(urlOrPath);
}

export function expandHome(path: string): string {
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}
