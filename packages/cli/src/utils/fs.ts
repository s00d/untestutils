import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'pathe';
import { consola } from 'consola';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeIfMissing(
  path: string,
  content: string,
  opts: { force?: boolean } = {},
): Promise<'wrote' | 'skipped'> {
  if (!opts.force && (await pathExists(path))) {
    consola.info(`skip (exists): ${path}`);
    return 'skipped';
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  consola.success(`wrote: ${path}`);
  return 'wrote';
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

export async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
