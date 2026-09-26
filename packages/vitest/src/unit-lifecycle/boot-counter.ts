import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

function isUnderTmpdir(filePath: string): boolean {
  try {
    const abs = resolve(filePath);
    // File may not exist yet — realpath the nearest existing ancestor.
    let probe = abs;
    while (probe !== resolve(probe, '..')) {
      if (existsSync(probe)) break;
      probe = resolve(probe, '..');
    }
    const resolved = realpathSync(probe);
    const tmp = realpathSync(tmpdir());
    return resolved === tmp || resolved.startsWith(tmp + '/');
  } catch {
    return false;
  }
}

/**
 * Count real app boots (not worker early-return). Writes only under OS tmpdir.
 */
export function bumpUnitBootCounter(
  envKey = 'UNTESTUTILS_BOOT_FILE',
  globalKey = '__UT_BOOTS',
): void {
  const g = globalThis as unknown as Record<string, number | undefined>;
  g[globalKey] = (g[globalKey] ?? 0) + 1;
  const out = process.env[envKey];
  if (!out || !isUnderTmpdir(out)) return;
  const prev = existsSync(out) ? Number(readFileSync(out, 'utf8').trim() || '0') : 0;
  writeFileSync(out, String(prev + 1), 'utf8');
}
