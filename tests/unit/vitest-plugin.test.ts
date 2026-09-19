import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { untestutils, createVitestProjects } from '../../packages/vitest/src/plugin';
import globalSetup from '../../packages/vitest/src/global-setup';
import {
  loadExpect,
  normalizeHarnessCookies,
  createGoto,
} from '../../packages/vitest/src/fixtures';
import { applySessionUrls, applyWorkerSetup } from '../../packages/vitest/src/setup-file';
import {
  defineRecipes,
  clearRegisteredRecipes,
  resetRecipeBindings,
  stopAllTargets,
  TargetRegistry,
  envKey,
} from '@untestutils/core';
import { staticDir } from '@untestutils/core';

describe('vitest plugin', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
    delete process.env.UNTESTUTILS_PREWARM;
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    delete process.env.UNTESTUTILS_SESSION;
    delete process.env.UNTESTUTILS_BROWSERS;
    delete process.env.UNTESTUTILS_BROWSER;
  });

  test('configureVitest wires setup and env from defineRecipes module path', async () => {
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
    const provide = new Map<string, unknown>();
    await plugin.configureVitest!({
      project: {
        name: 'default',
        config,
        provide: (k: string, v: unknown) => provide.set(k, v),
      },
      vitest: { config: {}, projects: [] },
      injectTestProjects: async () => [],
    });
    expect(config.sequence.setupFiles).toBe('list');
    expect(config.globalSetup.length).toBeGreaterThan(0);
    expect(config.setupFiles.length).toBeGreaterThan(0);
    expect(process.env.UNTESTUTILS_PREWARM).toContain('a');
    expect(process.env.UNTESTUTILS_RECIPES_MODULE).toBe('/tmp/recipes.ts');
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe('/tmp/arts');
    expect(process.env.UNTESTUTILS_BROWSERS).toContain('chromium');
    expect(provide.get('untestutilsBrowser')).toBe('chromium');
    expect(provide.get('untestutils')).toMatchObject({
      artifactsRoot: '/tmp/arts',
      recipesModule: '/tmp/recipes.ts',
      browsers: ['chromium'],
      urls: {},
    });
  });

  test('configureVitest injects projects for extra browsers and updates filter', async () => {
    const plugin = untestutils({
      browsers: ['chromium', 'firefox', 'webkit'],
      artifactsRoot: '/tmp/arts-multi',
    });
    const config: any = { sequence: {}, globalSetup: [], setupFiles: [] };
    const injected: unknown[] = [];
    const projectFilter: string[] = [];
    const provide = new Map<string, unknown>();
    await plugin.configureVitest!({
      project: {
        name: 'default',
        config,
        provide: (k, v) => provide.set(k, v),
      },
      vitest: { config: { project: projectFilter }, projects: [] },
      injectTestProjects: async (c: unknown) => {
        injected.push(c);
        return [];
      },
    });
    expect(provide.get('untestutilsBrowser')).toBe('chromium');
    expect(injected.length).toBe(1);
    const configs = injected[0] as Array<{
      test: { name: string; provide: { untestutilsBrowser: string } };
    }>;
    expect(configs.map((c) => c.test.name)).toEqual(['untestutils-firefox', 'untestutils-webkit']);
    expect(configs[0].test.provide.untestutilsBrowser).toBe('firefox');
    expect(configs[1].test.provide.untestutilsBrowser).toBe('webkit');
    expect(projectFilter).toEqual(['untestutils-firefox', 'untestutils-webkit']);
  });

  test('single browser does not call injectTestProjects', async () => {
    const plugin = untestutils({ browsers: ['firefox'], artifactsRoot: '/tmp/one' });
    let injectCalls = 0;
    const provide = new Map<string, unknown>();
    await plugin.configureVitest!({
      project: {
        name: 'default',
        config: { sequence: {}, globalSetup: [], setupFiles: [] },
        provide: (k, v) => provide.set(k, v),
      },
      vitest: { config: {}, projects: [] },
      injectTestProjects: async () => {
        injectCalls += 1;
        return [];
      },
    });
    expect(injectCalls).toBe(0);
    expect(provide.get('untestutilsBrowser')).toBe('firefox');
    expect(process.env.UNTESTUTILS_BROWSER).toBe('firefox');
  });

  test('configureVitest hard-fails for untestutils and nuxt environments', async () => {
    for (const environment of ['untestutils', 'nuxt']) {
      const plugin = untestutils({});
      await expect(
        plugin.configureVitest!({
          project: {
            name: 'x',
            config: { sequence: {}, globalSetup: [], setupFiles: [], environment },
            provide: () => {},
          },
          vitest: { config: {}, projects: [] },
          injectTestProjects: async () => [],
        }),
      ).rejects.toThrow(/Do not mix/);
    }
  });

  test('configureVitest allows prewarm without recipesModule', async () => {
    const plugin = untestutils({ prewarm: ['x'] });
    const config: any = { sequence: {}, globalSetup: [], setupFiles: [] };
    await plugin.configureVitest!({
      project: { name: 'x', config, provide: () => {} },
      vitest: { config: {}, projects: [] },
      injectTestProjects: async () => [],
    });
    expect(process.env.UNTESTUTILS_PREWARM).toContain('x');
  });

  test('globalSetup prewarm missing throws', async () => {
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['missing']);
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
    await expect(globalSetup({ provide: () => {} } as any)).rejects.toThrow(/prewarm/);
  });

  test('globalSetup applies registry when no prewarm and provides session', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-gs-'));
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    process.env.UNTESTUTILS_PREWARM = '[]';
    const reg = new TargetRegistry(artifacts);
    await reg.set({ id: 'x', identity: 'x', url: 'http://127.0.0.1:9/' });
    const provide = new Map<string, unknown>();
    const teardown = await globalSetup({
      provide: (k: string, v: unknown) => provide.set(k, v),
    } as any);
    expect(process.env.UNTESTUTILS_HOST_X).toContain('127.0.0.1');
    expect(provide.get('untestutils')).toMatchObject({
      artifactsRoot: artifacts,
      urls: {},
    });
    await teardown();
    await rm(artifacts, { recursive: true, force: true });
  });

  test('globalSetup prewarm provides urls in session payload', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-gs-url-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-gs-url-a-'));
    await writeFile(join(site, 'index.html'), '<html>gs</html>');
    defineRecipes({
      site: staticDir({ id: 'site', root: site }),
    });
    process.env.UNTESTUTILS_PREWARM = JSON.stringify(['site']);
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    const provide = new Map<string, unknown>();
    const teardown = await globalSetup({
      provide: (k: string, v: unknown) => provide.set(k, v),
    } as any);
    const session = provide.get('untestutils') as { urls: Record<string, string> };
    expect(session.urls.site).toContain('127.0.0.1');
    await teardown();
    await rm(site, { recursive: true, force: true });
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

describe('createVitestProjects (plugin export)', () => {
  test('is exported from plugin module', () => {
    expect(typeof createVitestProjects).toBe('function');
  });
});

describe('applySessionUrls / applyWorkerSetup', () => {
  afterEach(() => {
    delete process.env.UNTESTUTILS_HOST_DEMO;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    delete process.env.UNTESTUTILS_RECIPES_MODULE;
  });

  test('applySessionUrls sets missing env keys only', () => {
    applySessionUrls({ demo: 'http://127.0.0.1:1/' });
    expect(process.env[envKey('demo')]).toContain('127.0.0.1');
    applySessionUrls({ demo: 'http://127.0.0.1:2/' });
    expect(process.env[envKey('demo')]).toContain(':1');
  });

  test('applyWorkerSetup with sessionOverride applies urls and artifacts', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-ws-'));
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    await applyWorkerSetup({
      artifactsRoot: artifacts,
      browsers: ['chromium'],
      urls: { demo: 'http://127.0.0.1:33/' },
    });
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe(artifacts);
    expect(process.env[envKey('demo')]).toContain(':33');
    await rm(artifacts, { recursive: true, force: true });
  });
});

describe('fixture helpers', () => {
  test('normalizeHarnessCookies rewrites localhost domain to url', () => {
    const out = normalizeHarnessCookies(
      [{ name: 'a', value: '1', domain: 'localhost', path: '/' }],
      'http://127.0.0.1:3000/',
    );
    expect(out[0]).toMatchObject({ name: 'a', value: '1', url: 'http://127.0.0.1:3000/' });
    expect(out[0]).not.toHaveProperty('domain');
  });

  test('normalizeHarnessCookies leaves other domains', () => {
    const out = normalizeHarnessCookies(
      [{ name: 'a', value: '1', domain: 'example.com', path: '/' }],
      'http://127.0.0.1:3000/',
    );
    expect(out[0]).toMatchObject({ domain: 'example.com' });
  });

  test('createGoto builds absolute url from base', async () => {
    const calls: string[] = [];
    const page = {
      goto: async (url: string) => {
        calls.push(url);
        return null;
      },
      waitForFunction: async () => {},
    } as any;
    const goto = createGoto(page, 'http://127.0.0.1:9/');
    await goto('/hello');
    expect(calls[0]).toBe('http://127.0.0.1:9/hello');
  });
});
