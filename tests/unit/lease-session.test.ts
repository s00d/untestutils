import { describe, expect, test, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'pathe';
import { ofetch } from 'ofetch';
import {
  leaseTarget,
  prepareOnce,
  withHarness,
  useHarness,
  getHarness,
  getCurrentHarness,
  sanitizeSession,
  resolveSessionArtifactsRoot,
  staticDir,
  stopAllTargets,
  clearRegisteredRecipes,
  resetRecipeBindings,
  defineRecipes,
} from '@untestutils/core';
import { createVitestProjects, untestutils } from '../../packages/vitest/src/plugin';

describe('sanitizeSession', () => {
  test('strips unsafe chars and trims dashes', () => {
    expect(sanitizeSession('pw + vitest')).toBe('pw-vitest');
    expect(sanitizeSession('--ok--')).toBe('ok');
    expect(sanitizeSession('a.b_c-1')).toBe('a.b_c-1');
  });

  test('rejects empty / only-unsafe', () => {
    expect(() => sanitizeSession('@@@')).toThrow(/non-empty/);
    expect(() => sanitizeSession('---')).toThrow(/non-empty/);
    expect(() => sanitizeSession('')).toThrow(/non-empty/);
  });
});

describe('resolveSessionArtifactsRoot', () => {
  afterEach(() => {
    delete process.env.UNTESTUTILS_SESSION;
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
  });

  test('explicit artifactsRoot wins over session', () => {
    const root = resolveSessionArtifactsRoot({
      artifactsRoot: '/tmp/custom-arts',
      session: 'ignored',
      cwd: '/tmp/proj',
    });
    expect(root).toBe(resolve('/tmp/proj', '/tmp/custom-arts'));
  });

  test('nests session under base when no artifactsRoot', () => {
    const root = resolveSessionArtifactsRoot({
      session: 'ci-1',
      cwd: '/tmp/proj',
    });
    expect(root.replace(/\\/g, '/')).toMatch(/sessions\/ci-1$/);
  });

  test('reads UNTESTUTILS_SESSION from env', () => {
    process.env.UNTESTUTILS_SESSION = 'from-env';
    const root = resolveSessionArtifactsRoot({ cwd: '/tmp/proj' });
    expect(root.replace(/\\/g, '/')).toMatch(/sessions\/from-env$/);
  });

  test('without session returns base artifacts root', () => {
    const root = resolveSessionArtifactsRoot({
      artifactsRoot: '/tmp/only-base',
      cwd: '/tmp/proj',
    });
    expect(root).toBe(resolve('/tmp/proj', '/tmp/only-base'));
  });
});

describe('leaseTarget / useHarness / withHarness', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('leaseTarget registers handle and release drops it', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-lease-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-lease-a-'));
    await writeFile(join(site, 'index.html'), '<html>lease</html>');
    const recipe = staticDir({ id: 'lease1', root: site });
    const leased = await leaseTarget(recipe, { artifactsRoot: artifacts });
    expect(leased.url).toBeTruthy();
    expect(await ofetch(leased.url!)).toContain('lease');
    expect(getHarness('lease1')?.url).toBe(leased.url);
    expect(getCurrentHarness()?.id).toBe('lease1');
    await leased.release();
    expect(getHarness('lease1')).toBeUndefined();
    // shared server still up after release bookkeeping
    expect(await ofetch(leased.url!)).toContain('lease');
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('useHarness leases and leaves handle registered', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-uh-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-uh-a-'));
    await writeFile(join(site, 'index.html'), '<html>uh</html>');
    const recipe = staticDir({ id: 'uh1', root: site });
    const h = await useHarness(recipe, { artifactsRoot: artifacts });
    expect(h.$fetch).toBeTypeOf('function');
    expect(await h.$fetch!('/')).toContain('uh');
    expect(getHarness('uh1')).toBeTruthy();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('withHarness releases even when fn throws', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-wh-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-wh-a-'));
    await writeFile(join(site, 'index.html'), '<html>wh</html>');
    const recipe = staticDir({ id: 'wh-err', root: site });
    await expect(
      withHarness(
        recipe,
        async () => {
          throw new Error('boom');
        },
        { artifactsRoot: artifacts },
      ),
    ).rejects.toThrow(/boom/);
    expect(getHarness('wh-err')).toBeUndefined();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('withHarness returns fn result', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-wh2-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-wh2-a-'));
    await writeFile(join(site, 'index.html'), '<html>wh2</html>');
    const recipe = staticDir({ id: 'wh2', root: site });
    const body = await withHarness(recipe, async (h) => ofetch(h.url!), {
      artifactsRoot: artifacts,
    });
    expect(body).toContain('wh2');
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('prepareOnce + lease by recipe id string', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-po-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-po-a-'));
    await writeFile(join(site, 'index.html'), '<html>po</html>');
    defineRecipes({
      po1: staticDir({ id: 'po1', root: site }),
    });
    const prep = await prepareOnce('po1', { artifactsRoot: artifacts });
    expect(prep.id).toBe('po1');
    expect('url' in prep.running).toBe(true);
    const leased = await leaseTarget('po1', { artifactsRoot: artifacts });
    expect(leased.id).toBe('po1');
    await leased.release();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('files helpers on leased handle', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-files-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-files-a-'));
    await writeFile(join(site, 'index.html'), '<html>f</html>');
    await writeFile(join(site, 'note.txt'), 'hello');
    const recipe = staticDir({ id: 'files1', root: site });
    // staticDir start uses root as dir — prepare may copy or serve in place
    const leased = await leaseTarget(recipe, { artifactsRoot: artifacts });
    expect(leased.dir).toBeTruthy();
    expect(await leased.files.exists('index.html')).toBe(true);
    const list = await leased.files.list();
    expect(list).toContain('index.html');
    await leased.release();
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });
});

describe('createVitestProjects', () => {
  test('builds e2e + unit projects', () => {
    const projects = createVitestProjects({
      e2e: { test: { include: ['e2e/**'] } },
      unit: { test: { include: ['unit/**'] } },
    });
    expect(projects).toHaveLength(2);
    expect((projects[0].test as { name: string }).name).toBe('e2e');
    expect((projects[1].test as { name: string; environment: string }).name).toBe('unit');
    expect((projects[1].test as { environment: string }).environment).toBe('untestutils');
  });

  test('e2e-only / unit-only', () => {
    expect(createVitestProjects({ e2e: { test: {} } })).toHaveLength(1);
    expect(createVitestProjects({ unit: { test: {} } })).toHaveLength(1);
  });

  test('rejects empty options', () => {
    expect(() => createVitestProjects({})).toThrow(/at least one/);
  });

  test('rejects unit env on e2e', () => {
    expect(() => createVitestProjects({ e2e: { test: { environment: 'untestutils' } } })).toThrow(
      /must not set environment/,
    );
    expect(() => createVitestProjects({ e2e: { test: { environment: 'nuxt' } } })).toThrow(
      /must not set environment/,
    );
  });

  test('rejects e2e plugin on unit', () => {
    expect(() =>
      createVitestProjects({
        unit: { plugins: [{ name: 'untestutils' }], test: {} },
      }),
    ).toThrow(/must not include the e2e/);
  });
});

describe('untestutils plugin session option', () => {
  afterEach(() => {
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    delete process.env.UNTESTUTILS_SESSION;
    delete process.env.UNTESTUTILS_PREWARM;
    delete process.env.UNTESTUTILS_BROWSERS;
    delete process.env.UNTESTUTILS_BROWSER;
  });

  test('session nests artifacts and is provided', async () => {
    const base = await mkdtemp(join(tmpdir(), 'ut-vsess-'));
    process.env.UNTESTUTILS_ARTIFACTS_DIR = base;
    const plugin = untestutils({ session: 'vitest-a', browsers: ['chromium'] });
    const provide = new Map<string, unknown>();
    const config: Record<string, unknown> = { sequence: {}, globalSetup: [], setupFiles: [] };
    await plugin.configureVitest!({
      project: {
        name: 'default',
        config,
        provide: (k, v) => provide.set(k, v),
      },
      vitest: { config: {}, projects: [] },
      injectTestProjects: async () => [],
    });
    expect(process.env.UNTESTUTILS_SESSION).toBe('vitest-a');
    expect(process.env.UNTESTUTILS_ARTIFACTS_DIR).toBe(join(base, 'sessions', 'vitest-a'));
    expect(provide.get('untestutils')).toMatchObject({
      session: 'vitest-a',
      browsers: ['chromium'],
    });
    await rm(base, { recursive: true, force: true });
  });
});
