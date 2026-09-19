import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { templatesRoot } from './workspace';
import { writeIfMissing } from './fs';

export type InitPreset = 'vitest' | 'playwright' | 'nuxt' | 'full';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';

/** Relative template paths under templates/ */
const PRESET_FILES: Record<InitPreset, string[]> = {
  vitest: [
    'vitest/vitest.config.ts',
    'vitest/recipes.ts',
    'vitest/tests/e2e/smoke.test.ts',
    'vitest/fixtures/basic/index.html',
  ],
  playwright: [
    'playwright/playwright.config.ts',
    'playwright/recipes.ts',
    'playwright/tests/e2e/smoke.spec.ts',
    'vitest/fixtures/basic/index.html',
  ],
  nuxt: [
    'nuxt/vitest.config.ts',
    'nuxt/recipes.ts',
    'nuxt/tests/e2e/smoke.test.ts',
    'nuxt/fixtures/nuxt/package.json',
    'nuxt/fixtures/nuxt/nuxt.config.ts',
    'nuxt/fixtures/nuxt/app.vue',
  ],
  full: [
    'vitest/vitest.config.ts',
    'playwright/playwright.config.ts',
    'vitest/recipes.ts',
    'vitest/tests/e2e/smoke.test.ts',
    'playwright/tests/e2e/smoke.spec.ts',
    'vitest/fixtures/basic/index.html',
  ],
};

function destFromTemplate(rel: string): string {
  const parts = rel.split('/');
  parts.shift();
  return parts.join('/');
}

export async function applyPreset(
  cwd: string,
  preset: InitPreset,
  opts: { force?: boolean } = {},
): Promise<string[]> {
  const root = templatesRoot();
  const files = PRESET_FILES[preset];
  const written: string[] = [];
  const seen = new Set<string>();

  for (const rel of files) {
    const destRel = destFromTemplate(rel);
    if (seen.has(destRel)) continue;
    seen.add(destRel);
    const content = await readFile(join(root, rel), 'utf8');
    const dest = join(cwd, destRel);
    const result = await writeIfMissing(dest, content, opts);
    if (result === 'wrote') written.push(destRel);
  }
  return written;
}

export function peersForPreset(preset: InitPreset): string[] {
  const base = ['untestutils', 'vitest'];
  if (preset === 'playwright' || preset === 'full') {
    base.push('@playwright/test', 'playwright-core');
  }
  if (preset === 'nuxt' || preset === 'full') {
    base.push('nuxt', '@untestutils/nuxt', 'vitest-environment-untestutils');
  }
  return [...new Set(base)];
}
