import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  createPlaywrightConfig,
  playwrightGlobalSetup,
  playwrightGlobalTeardown,
  resolvePlaywrightArtifactsRoot,
  sanitizePlaywrightSession,
} from '../../packages/playwright/src/index';
import pwSetup from '../../packages/playwright/src/pw-global-setup';
import pwTeardown from '../../packages/playwright/src/pw-global-teardown';
import {
  defineRecipes,
  clearRegisteredRecipes,
  resetRecipeBindings,
  stopAllTargets,
  TargetRegistry,
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
    delete process.env.UNTESTUTILS_SESSION;
    delete process.env.CI;
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
    expect(cfg.fullyParallel).toBe(true);
    expect(process.env.UNTESTUTILS_RECIPES_MODULE).toBe('/tmp/r.ts');
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe('/tmp/a');
  });

  test('createPlaywrightConfig session nests artifacts root', async () => {
    const base = await mkdtemp(join(tmpdir(), 'ut-pw-session-base-'));
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    process.env.UNTESTUTILS_ARTIFACTS_DIR = base;
    const recipes = defineRecipes({
      s: staticDir({ id: 's', root: process.cwd() }),
    });
    const cfg = createPlaywrightConfig({
      recipes,
      session: 'ci-a',
    });
    expect(cfg.fullyParallel).toBe(true);
    expect(process.env.UNTESTUTILS_SESSION).toBe('ci-a');
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe(join(base, 'sessions', 'ci-a'));

    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    process.env.UNTESTUTILS_ARTIFACTS_DIR = base;
    expect(resolvePlaywrightArtifactsRoot({ session: 'ci-b' })).toBe(
      join(base, 'sessions', 'ci-b'),
    );
    expect(sanitizePlaywrightSession('My Session!')).toBe('My-Session');
    await rm(base, { recursive: true, force: true });
  });

  test('createPlaywrightConfig expands browsers into projects', () => {
    const cfg = createPlaywrightConfig({
      recipes: defineRecipes({ s: staticDir({ id: 's', root: process.cwd() }) }),
      browsers: ['chromium', 'firefox'],
    });
    expect(cfg.projects).toEqual([
      { name: 'chromium', use: { browserName: 'chromium' } },
      { name: 'firefox', use: { browserName: 'firefox' } },
    ]);
  });

  test('createPlaywrightConfig browsers skipped when projects set', () => {
    const cfg = createPlaywrightConfig({
      recipes: defineRecipes({ s: staticDir({ id: 's', root: process.cwd() }) }),
      browsers: ['webkit'],
      projects: [{ name: 'custom', use: { browserName: 'chromium' } }],
    });
    expect(cfg.projects).toEqual([{ name: 'custom', use: { browserName: 'chromium' } }]);
  });

  test('createPlaywrightConfig sets workers:2 under CI when omitted', () => {
    process.env.CI = 'true';
    const cfg = createPlaywrightConfig({
      recipes: defineRecipes({ s: staticDir({ id: 's', root: process.cwd() }) }),
    });
    expect(cfg.workers).toBe(2);
  });

  test('createPlaywrightConfig respects explicit workers under CI', () => {
    process.env.CI = 'true';
    const cfg = createPlaywrightConfig({
      recipes: defineRecipes({ s: staticDir({ id: 's', root: process.cwd() }) }),
      workers: 4,
    });
    expect(cfg.workers).toBe(4);
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
    expect(process.env.UNTESTUTILS_HOST_STATICSITE).toBeTruthy();
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

  test('session teardown does not clear another session registry', async () => {
    const repoArtifacts = await mkdtemp(join(tmpdir(), 'ut-pw-multi-'));
    const sessionA = join(repoArtifacts, 'sessions', 'a');
    const sessionB = join(repoArtifacts, 'sessions', 'b');
    await mkdir(sessionA, { recursive: true });
    await mkdir(sessionB, { recursive: true });

    const site = await mkdtemp(join(tmpdir(), 'ut-pw-site-'));
    await writeFile(join(site, 'index.html'), '<html>iso</html>');
    defineRecipes({
      staticSite: staticDir({ id: 'staticSite', root: site }),
    });

    process.env.UNTESTUTILS_ARTIFACTS_DIR = sessionA;
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['staticSite']);
    await playwrightGlobalSetup();
    const regA = new TargetRegistry(sessionA);
    expect(Object.keys(await regA.read()).length).toBeGreaterThan(0);

    const regB = new TargetRegistry(sessionB);
    await regB.set({ id: 'foreign', identity: 'foreign', url: 'http://127.0.0.1:9/' });
    expect((await regB.read()).foreign).toBeTruthy();

    await playwrightGlobalTeardown();
    expect(await regA.read()).toEqual({});
    expect((await regB.read()).foreign?.url).toContain('127.0.0.1');

    await stopAllTargets(sessionB);
    await rm(site, { recursive: true, force: true });
    await rm(repoArtifacts, { recursive: true, force: true });
  });
});
