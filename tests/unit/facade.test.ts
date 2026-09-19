import { describe, expect, test } from 'vitest';
import * as facade from '../../packages/untestutils/src/index';
import { command as cmdFromSubpath } from '../../packages/untestutils/src/command';

describe('untestutils facade', () => {
  test('core + drivers surface', () => {
    expect(typeof facade.defineRecipes).toBe('function');
    expect(typeof facade.useHarness).toBe('function');
    expect(typeof facade.leaseTarget).toBe('function');
    expect(typeof facade.prepareOnce).toBe('function');
    expect(typeof facade.withHarness).toBe('function');
    expect(typeof facade.sanitizeSession).toBe('function');
    expect(typeof facade.resolveSessionArtifactsRoot).toBe('function');
    expect(typeof facade.staticDir).toBe('function');
    expect(typeof facade.command).toBe('function');
    expect(typeof facade.host).toBe('function');
    expect(typeof facade.nodeEntry).toBe('function');
    expect(typeof facade.defineDriver).toBe('function');
    expect(typeof facade.matrixRecipe).toBe('function');
    expect(typeof cmdFromSubpath).toBe('function');
  });

  test('vitest subpath exports createVitestProjects and lease helpers', async () => {
    const vitest = await import('../../packages/untestutils/src/vitest');
    expect(typeof (vitest as any).createVitestProjects).toBe('function');
    expect(typeof (vitest as any).leaseTarget).toBe('function');
  });

  test('subpath barrel files export something', async () => {
    const mods = await Promise.all([
      import('../../packages/untestutils/src/vitest'),
      import('../../packages/untestutils/src/vitest-plugin'),
      import('../../packages/untestutils/src/playwright'),
      import('../../packages/untestutils/src/nuxt'),
      import('../../packages/untestutils/src/vite'),
      import('../../packages/untestutils/src/next'),
      import('../../packages/untestutils/src/astro'),
      import('../../packages/untestutils/src/sveltekit'),
      import('../../packages/untestutils/src/remix'),
      import('../../packages/untestutils/src/solidstart'),
      import('../../packages/untestutils/src/ai'),
      import('../../packages/untestutils/src/runtime'),
      import('../../packages/untestutils/src/module'),
      import('../../packages/untestutils/src/config'),
    ]);
    for (const mod of mods) expect(mod).toBeTruthy();
  });
});
