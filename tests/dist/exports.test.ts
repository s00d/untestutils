import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'pathe';

const root = resolve(import.meta.dirname, '../..');

describe('dist exports', () => {
  test('core + facade expose main entry', async () => {
    const coreMain = resolve(root, 'packages/core/dist/index.mjs');
    const facadeMain = resolve(root, 'packages/untestutils/dist/index.mjs');
    expect(existsSync(coreMain)).toBe(true);
    expect(existsSync(facadeMain)).toBe(true);

    const core = await import(coreMain);
    expect(typeof core.defineRecipes).toBe('function');
    expect(typeof core.useHarness).toBe('function');

    const facade = await import(facadeMain);
    expect(typeof facade.defineRecipes).toBe('function');
    expect(typeof facade.staticDir).toBe('function');
    expect(typeof facade.command).toBe('function');
    expect(typeof facade.host).toBe('function');
  });

  test('scoped package dists exist', () => {
    for (const p of [
      'packages/core/dist/index.mjs',
      'packages/core/dist/drivers/index.mjs',
      'packages/vitest/dist/plugin.mjs',
      'packages/vitest/dist/setup-file.mjs',
      'packages/playwright/dist/index.mjs',
      'packages/nuxt/dist/index.mjs',
      'packages/untestutils/dist/vitest.mjs',
      'packages/untestutils/dist/vitest-setup-file.mjs',
      'packages/untestutils/dist/nuxt.mjs',
      'packages/cli/bin.mjs',
      'packages/cli/src/run.ts',
    ]) {
      expect(existsSync(resolve(root, p)), p).toBe(true);
    }
  });
});
