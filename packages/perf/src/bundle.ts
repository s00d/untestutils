import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'pathe';
import type { BundleClass, BundleSize, PerfTargetBundle } from './types';

function walk(
  dir: string,
  classify: (p: string) => BundleClass,
  into: { code: number; asset: number; other: number },
): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, classify, into);
    else {
      const size = statSync(full).size;
      const kind = classify(full);
      into[kind] += size;
    }
  }
}

export function measureBundle(
  root: string,
  opts: PerfTargetBundle,
): BundleSize {
  const classify = opts.classify ?? (() => 'code' as BundleClass);
  const byDir: Record<string, number> = {};
  let code = 0;
  let asset = 0;
  let other = 0;

  for (const rel of opts.dirs) {
    const dir = rel.startsWith('/') ? rel : join(root, rel);
    const bucket = { code: 0, asset: 0, other: 0 };
    walk(dir, classify, bucket);
    const name = basename(dir);
    byDir[name] = bucket.code + bucket.asset + bucket.other;
    code += bucket.code;
    asset += bucket.asset;
    other += bucket.other;
  }

  return {
    total: code + asset + other,
    code,
    asset,
    other,
    byDir,
  };
}
