import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'pathe';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.nuxt',
  '.output',
  '.untestutils',
  'dist',
  'coverage',
  'test-results',
  '.data',
  '.turbo',
  '.next',
]);

/** Vite/app outDirs like `dist-e2e` / `dist-override` must not invalidate prepare hash. */
export function shouldSkipHashDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith('dist-');
}

const SKIP_FILES = new Set(['.DS_Store', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']);

export function sha1(content: Buffer | string): string {
  return createHash('sha1').update(content).digest('hex');
}

export async function hashFile(path: string): Promise<string> {
  const buf = await readFile(path);
  return sha1(buf);
}

export async function collectFileHashes(
  dir: string,
  lines: string[],
  root: string = dir,
): Promise<void> {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (shouldSkipHashDir(entry.name) || SKIP_FILES.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFileHashes(path, lines, root);
    } else if (entry.isFile()) {
      lines.push(`${relative(root, path)}|${await hashFile(path)}`);
    }
  }
}

export async function contentHash(inputs: string[]): Promise<string> {
  const lines: string[] = [];
  for (const input of inputs) {
    if (!existsSync(input)) {
      lines.push(`missing:${input}`);
      continue;
    }
    const s = await stat(input);
    if (s.isDirectory()) {
      await collectFileHashes(input, lines, input);
    } else {
      lines.push(`${input}|${await hashFile(input)}`);
    }
  }
  return sha1(lines.sort().join('\n'));
}

export function hashString(value: string): string {
  return sha1(value);
}

export async function streamSha1(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
