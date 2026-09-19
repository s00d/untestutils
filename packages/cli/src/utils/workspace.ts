import { join, dirname } from 'pathe';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

/** Untestutils monorepo root when the CLI runs inside this repository. */
export function findMonorepoRoot(start = process.cwd()): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (
      existsSync(join(dir, 'pnpm-workspace.yaml')) &&
      existsSync(join(dir, 'packages/untestutils/package.json'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function cliPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const name = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string }).name;
        if (name === '@untestutils/cli') return dir;
      } catch {
        /* continue */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), '../..');
}

export function templatesRoot(): string {
  const mono = findMonorepoRoot();
  if (mono) {
    const fromMono = join(mono, 'packages/cli/templates');
    if (existsSync(fromMono)) return fromMono;
  }
  const root = cliPackageRoot();
  for (const c of [
    join(root, 'templates'),
    join(root, 'dist/templates'),
    join(root, 'src/templates'),
  ]) {
    if (existsSync(c)) return c;
  }
  // bundled into untestutils facade (legacy) or published package
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const name = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string }).name;
        if (name === 'untestutils' || name === '@untestutils/cli') {
          for (const c of [
            join(dir, 'templates'),
            join(dir, 'dist/templates'),
            join(dir, 'src/templates'),
          ]) {
            if (existsSync(c)) return c;
          }
        }
      } catch {
        /* continue */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(cliPackageRoot(), 'templates');
}
