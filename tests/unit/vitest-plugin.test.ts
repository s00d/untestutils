import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { untestutils } from '../../packages/vitest/src/plugin';
import globalSetup from '../../packages/vitest/src/global-setup';
import { loadExpect } from '../../packages/vitest/src/fixtures';
import {
  defineRecipes,
  clearRegisteredRecipes,
  resetRecipeBindings,
  stopAllTargets,
  TargetRegistry,
} from '@untestutils/core';
import { staticDir } from '@untestutils/drivers';

describe('vitest plugin', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
    delete process.env.UNTESTUTILS_PREWARM;
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
  });

  test('configureVitest wires setup and env from defineRecipes module path', () => {
    const recipes = defineRecipes(
      {
        a: staticDir({ id: 'a', root: process.cwd() }),
      },
      '/tmp/recipes.ts',
    );
    const plugin = untestutils({
      recipes,
      prewarm: ['a'],
      artifactsRoot: '/tmp/arts',
    });
    const config: any = { sequence: {}, globalSetup: [], setupFiles: [] };
    plugin.configureVitest!({ project: { config } });
    expect(config.sequence.setupFiles).toBe('list');
    expect(config.globalSetup.length).toBeGreaterThan(0);
    expect(config.setupFiles.length).toBeGreaterThan(0);
    expect(process.env.UNTESTUTILS_PREWARM).toContain('a');
    expect(process.env.UNTESTUTILS_RECIPES_MODULE).toBe('/tmp/recipes.ts');
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe('/tmp/arts');
  });

  test('configureVitest warns when prewarm without recipesModule', () => {
    const plugin = untestutils({ prewarm: ['x'] });
    const config: any = { sequence: {}, globalSetup: [], setupFiles: [] };
    plugin.configureVitest!({ project: { config } });
    expect(process.env.UNTESTUTILS_PREWARM).toContain('x');
  });

  test('globalSetup prewarm missing throws', async () => {
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['missing']);
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    await expect(globalSetup({} as any)).rejects.toThrow(/prewarm/);
  });

  test('globalSetup applies registry when no prewarm', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-gs-'));
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    process.env.UNTESTUTILS_PREWARM = '[]';
    const reg = new TargetRegistry(artifacts);
    await reg.set({ id: 'x', identity: 'x', url: 'http://127.0.0.1:9/' });
    const teardown = await globalSetup({} as any);
    expect(process.env.UNTESTUTILS_HOST_X).toContain('127.0.0.1');
    await teardown();
    await rm(artifacts, { recursive: true, force: true });
  });

  test('globalSetup prewarms registered recipe', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-gs2-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-gs2a-'));
    await writeFile(join(site, 'index.html'), '<html>gs</html>');
    defineRecipes({
      site: staticDir({ id: 'site', root: site }),
    });
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['site']);
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    const teardown = await globalSetup({} as any);
    await teardown();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('loadExpect returns expect', async () => {
    const exp = await loadExpect();
    expect(typeof exp).toBe('function');
  });
});
