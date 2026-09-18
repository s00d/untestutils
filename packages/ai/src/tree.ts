import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { glob } from 'tinyglobby';

export const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  '.output',
  '.nuxt',
  '.untestutils',
  'coverage',
  '.next',
  '.turbo',
]);

export interface FileTreeEntry {
  path: string;
  size: number;
}

export async function buildFileTree(root: string, maxEntries = 2000): Promise<FileTreeEntry[]> {
  const abs = resolve(root);
  if (maxEntries <= 0) return [];
  let paths: string[] = [];
  try {
    paths = await glob(['**/*'], {
      cwd: abs,
      onlyFiles: true,
      ignore: [...IGNORE].map((d) => `**/${d}/**`).concat(['**/.env*', '**/.env']),
      absolute: false,
    });
  } catch {
    return [];
  }
  const out: FileTreeEntry[] = [];
  for (const rel of paths) {
    if (out.length >= maxEntries) break;
    if (rel.split(/[/\\]/).some((p) => IGNORE.has(p) || p.startsWith('.env'))) continue;
    const full = join(abs, rel);
    const s = await stat(full).catch(() => null);
    if (!s?.isFile()) continue;
    out.push({ path: rel.replace(/\\/g, '/'), size: s.size });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function treeSignature(tree: FileTreeEntry[]): string {
  return createHash('sha1')
    .update(tree.map((t) => `${t.path}|${t.size}`).join('\n'))
    .digest('hex');
}

export function fingerprint(
  partsOrOpts:
    | string[]
    | {
        prompt: string;
        root: string;
        recipes: string[];
        focus: string[];
        treeSig: string;
      },
): string {
  if (Array.isArray(partsOrOpts)) {
    return createHash('sha1').update(partsOrOpts.join('|')).digest('hex');
  }
  const opts = partsOrOpts;
  return createHash('sha1')
    .update(
      [
        'v1',
        opts.prompt.trim(),
        resolve(opts.root),
        opts.recipes.join(','),
        opts.focus.join(','),
        opts.treeSig,
      ].join('|'),
    )
    .digest('hex');
}

export async function listTestFiles(root: string): Promise<string[]> {
  const abs = resolve(root);
  const paths = await glob(['**/*.{test,spec}.{ts,tsx,js,mjs,cjs}', '**/e2e/**/*.{ts,js}'], {
    cwd: abs,
    onlyFiles: true,
    ignore: [...IGNORE].map((d) => `**/${d}/**`),
  });
  return paths.map((p) => p.replace(/\\/g, '/')).sort();
}

export { readdir };
