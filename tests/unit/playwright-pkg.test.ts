import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  createPlaywrightConfig,
  playwrightGlobalSetup,
  playwrightGlobalTeardown,
} from '../../packages/playwright/src/index';
import pwSetup from '../../packages/playwright/src/pw-global-setup';
import pwTeardown from '../../packages/playwright/src/pw-global-teardown';
import {
  defineRecipes,
  clearRegisteredRecipes,
  resetRecipeBindings,
  stopAllTargets,
} from '@untestutils/core';
import { staticDir } from '@untestutils/drivers';

describe('playwright package', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
    delete process.env.UNTESTUTILS_PREWARM;
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
  });

  test('createPlaywrightConfig sets setup paths', () => {
    const recipes = defineRecipes({
      s: staticDir({ id: 's', root: process.cwd() }),
    });
    const cfg = createPlaywrightConfig({
      recipes,
      recipesModule: '/tmp/r.ts',
      prewarm: ['s'],
      artifactsRoot: '/tmp/a',
    });
    expect(cfg.globalSetup).toBeTruthy();
    expect(cfg.globalTeardown).toBeTruthy();
    expect(process.env.UNTESTUTILS_RECIPES_MODULE).toBe('/tmp/r.ts');
  });

  test('globalSetup prewarm via registered recipes', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-pw-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-pwa-'));
    await writeFile(join(site, 'index.html'), '<html>pw</html>');
    defineRecipes({
      staticSite: staticDir({ id: 'staticSite', root: site }),
    });
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['staticSite']);
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    await playwrightGlobalSetup();
    await playwrightGlobalTeardown();
    await pwSetup();
    await pwTeardown();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('globalSetup loads recipes module export', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-pwm-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-pwma-'));
    await writeFile(join(site, 'index.html'), '<html>mod</html>');
    const recipesFile = join(site, 'recipes.mjs');
    // Use absolute file URLs so Node can load without package resolution.
    const coreUrl = new URL('../../packages/core/src/index.ts', import.meta.url).href;
    const driversUrl = new URL('../../packages/drivers/src/index.ts', import.meta.url).href;
    await writeFile(
      recipesFile,
      `
import { defineRecipes } from ${JSON.stringify(coreUrl)}
import { staticDir } from ${JSON.stringify(driversUrl)}
export const recipes = defineRecipes({
  staticSite: staticDir({ id: 'staticSite', root: ${JSON.stringify(site)} }),
})
`,
    );
    process.env.UNTESTUTILS_RECIPES_MODULE = recipesFile;
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['staticSite']);
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    await playwrightGlobalSetup();
    await playwrightGlobalTeardown();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('globalSetup missing recipe throws', async () => {
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['nope']);
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    await expect(playwrightGlobalSetup()).rejects.toThrow(/prewarm/);
  });
});
