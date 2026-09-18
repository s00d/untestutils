import { describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'pathe';

const facade = resolve(import.meta.dirname, '../../packages/untestutils');

describe('dist exports', () => {
  test('package builds expose main entry', async () => {
    const main = resolve(facade, 'dist/index.mjs');
    expect(existsSync(main)).toBe(true);
    const mod = await import(main);
    expect(typeof mod.defineRecipes).toBe('function');
    expect(typeof mod.useHarness).toBe('function');
    expect(typeof mod.staticDir).toBe('function');
    expect(typeof mod.command).toBe('function');
    expect(typeof mod.host).toBe('function');
  });

  test('subpath files exist', () => {
    for (const p of [
      'dist/vitest.mjs',
      'dist/vitest-plugin.mjs',
      'dist/vitest-global-setup.mjs',
      'dist/vitest-setup-file.mjs',
      'dist/playwright.mjs',
      'dist/nuxt.mjs',
      'dist/vite.mjs',
      'dist/ai.mjs',
      'dist/command.mjs',
    ]) {
      expect(existsSync(resolve(facade, p)), p).toBe(true);
    }
  });
});
