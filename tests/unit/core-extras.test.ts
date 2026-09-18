import { describe, expect, test, afterEach, beforeEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createServer } from 'node:http';
import { ofetch } from 'ofetch';
import {
  defineRecipe,
  defineRecipes,
  ensureRecipes,
  clearRegisteredRecipes,
  listRegisteredRecipes,
  getRegisteredRecipe,
  useHarness,
  getCurrentHarness,
  getHarness,
  ensurePrepared,
  stopAllTargets,
  resolveRecipe,
  waitForHttpReady,
  defaultReady,
  scrubTestEnv,
  spawnManaged,
  runCommand,
  createRunHelper,
  getFreePort,
  waitForPort,
  resolveArtifactsRoot,
  findRepoRoot,
  envKey,
  envDirKey,
  atomicWriteText,
  lockPathFor,
  collectFileHashes,
  contentHash,
  envFlag,
  isDebug,
  debug,
  log,
  computeIdentity,
  assertUniqueRecipeBinding,
  resetRecipeBindings,
  SCHEMA_VERSION,
  TargetRegistry,
} from '@untestutils/core';
import { streamSha1, hashFile } from '../../packages/core/src/hash';
import {
  refuseArtifactsInsidePackage,
  expandHome,
  toFilePath,
  isWorkspacePackageDir,
} from '../../packages/core/src/paths';
import { createHarnessHandle } from '../../packages/core/src/orchestrator';

describe('core extras', () => {
  beforeEach(() => {
    clearRegisteredRecipes();
    resetRecipeBindings();
  });
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('ensureRecipes / list / SCHEMA', () => {
    expect(SCHEMA_VERSION).toBeTruthy();
    const r = defineRecipe({ id: 'e1', start: async () => ({ kind: 'dir', dir: '/tmp' }) });
    ensureRecipes({ e1: r });
    ensureRecipes({ e1: r }); // idempotent skip
    expect(listRegisteredRecipes().some((x) => x.id === 'e1')).toBe(true);
    expect(getRegisteredRecipe('e1')).toBeTruthy();
  });

  test('resolveRecipe unknown throws', async () => {
    await expect(resolveRecipe('nope')).rejects.toThrow(/unknown recipe/);
    const r = defineRecipe({ id: 'obj', start: async () => ({ kind: 'dir', dir: '/tmp' }) });
    expect(await resolveRecipe(r)).toBe(r);
  });

  test('useHarness + getCurrent + getHarness', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-h-'));
    const site = await mkdtemp(join(tmpdir(), 'ut-s-'));
    await writeFile(join(site, 'index.html'), 'hi');
    process.env.UNTESTUTILS_ARTIFACTS_DIR = artifacts;
    const { staticDir } = await import('@untestutils/drivers');
    defineRecipes({ site: staticDir({ id: 'site', root: site }) });
    const h = await useHarness('site');
    expect(getCurrentHarness()?.id).toBe('site');
    expect(getHarness('site')?.url).toBeTruthy();
    expect(await h.$fetch('/')).toContain('hi');
    expect(await h.files.exists('index.html')).toBe(true);
    expect(await h.files.read('index.html')).toContain('hi');
    expect(await h.files.list('.')).toContain('index.html');
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('createHarnessHandle without url throws on $fetch', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-dir-'));
    const handle = createHarnessHandle({
      id: 'd',
      identity: 'd-x',
      hash: 'h',
      outDir: dir,
      running: { kind: 'dir', dir },
      recipe: defineRecipe({ id: 'd', start: async () => ({ kind: 'dir', dir }) }),
    });
    expect(() => handle.$fetch('/')).toThrow(/no url/);
    expect(await handle.files.exists('nope')).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  test('waitForHttpReady + defaultReady', async () => {
    const port = await getFreePort();
    let hits = 0;
    const server = createServer((_q, res) => {
      hits++;
      if (hits < 2) {
        res.statusCode = 503;
        res.end('__NUXT_LOADING__');
        return;
      }
      res.end('ok');
    });
    await new Promise<void>((r, j) => {
      server.listen(port, '127.0.0.1', () => r());
      server.once('error', j);
    });
    const url = `http://127.0.0.1:${port}/`;
    await waitForHttpReady(url, { timeoutMs: 10_000 });
    await defaultReady({ kind: 'dir', dir: '/tmp' });
    await defaultReady({ kind: 'url', url, stop: async () => {} });
    await expect(waitForHttpReady('http://127.0.0.1:1/', { timeoutMs: 400 })).rejects.toThrow(
      /readiness failed/,
    );
    await new Promise<void>((r) => server.close(() => r()));
  });

  test('process helpers', async () => {
    expect(scrubTestEnv({ VITEST: '1', FOO: 'x' }).VITEST).toBeUndefined();
    expect(scrubTestEnv({ FOO: 'x' }).FOO).toBe('x');
    const r = await runCommand(process.execPath, ['-e', 'console.log("hi")'], {
      timeoutMs: 10_000,
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('hi');
    process.env.UNTESTUTILS_CAPTURE_LOGS = '1';
    const managed = spawnManaged(process.execPath, ['-e', 'setTimeout(()=>{}, 200)'], {
      captureLogs: true,
    });
    await managed.stop();
    delete process.env.UNTESTUTILS_CAPTURE_LOGS;
    const run = createRunHelper();
    const out = await run`${process.execPath} -e "console.log(1)"`;
    expect(out.exitCode).toBe(0);
    const det = await run.detached`${process.execPath} -e "setTimeout(()=>{}, 300)"`;
    expect(det.pid).toBeTruthy();
    await det.stop();
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(()=>{}, 99999)'], { timeoutMs: 200 }),
    ).rejects.toThrow(/timed out/);
  });

  test('ports waitForPort', async () => {
    const port = await getFreePort();
    const server = createServer();
    await new Promise<void>((r) => server.listen(port, '127.0.0.1', () => r()));
    await waitForPort(port, '127.0.0.1', 5_000);
    await new Promise<void>((r) => server.close(() => r()));
    await expect(waitForPort(1, '127.0.0.1', 300)).rejects.toThrow(/not ready/);
  });

  test('paths helpers', () => {
    expect(findRepoRoot()).toBeTruthy();
    expect(resolveArtifactsRoot()).toContain('.untestutils');
    process.env.UNTESTUTILS_ARTIFACTS_DIR = '/tmp/custom-ut';
    expect(resolveArtifactsRoot()).toContain('custom-ut');
    delete process.env.UNTESTUTILS_ARTIFACTS_DIR;
    expect(envKey('my-app')).toContain('MY_APP');
    expect(envDirKey('my-app')).toContain('DIR');
    expect(expandHome('~/x')).toContain('/');
    expect(toFilePath(new URL('file:///tmp/a'))).toContain('tmp');
    expect(toFilePath('/abs')).toBe('/abs');
    expect(isWorkspacePackageDir(process.cwd())).toBe(true);
    expect(() => refuseArtifactsInsidePackage('/tmp/.untestutils/builds/x')).not.toThrow();
  });

  test('hash collect + stream + missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-hash-'));
    await mkdir(join(dir, 'node_modules'), { recursive: true });
    await writeFile(join(dir, 'a.txt'), 'a');
    await writeFile(join(dir, 'node_modules', 'x'), 'skip');
    const lines: string[] = [];
    await collectFileHashes(dir, lines);
    expect(lines.some((l) => l.includes('a.txt'))).toBe(true);
    expect(lines.some((l) => l.includes('node_modules'))).toBe(false);
    expect(await hashFile(join(dir, 'a.txt'))).toHaveLength(40);
    expect(await streamSha1(join(dir, 'a.txt'))).toHaveLength(40);
    expect(await contentHash([join(dir, 'missing-file')])).toBeTruthy();
    await rm(dir, { recursive: true, force: true });
  });

  test('atomicWriteText + lockPath + debug flags', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-at-'));
    await atomicWriteText(join(dir, 't.txt'), 'hello');
    expect(lockPathFor(dir, 'id')).toContain('locks');
    process.env.UNTESTUTILS_DEBUG = '1';
    expect(isDebug()).toBe(true);
    debug('t', 'msg');
    debug('t', 'msg', { a: 1 });
    log('t', 'msg');
    delete process.env.UNTESTUTILS_DEBUG;
    expect(envFlag('NOPE')).toBe(false);
    expect(envFlag('NOPE', true)).toBe(true);
    process.env.XFLAG = '1';
    expect(envFlag('XFLAG')).toBe(true);
    delete process.env.XFLAG;
    await rm(dir, { recursive: true, force: true });
  });

  test('assertUniqueRecipeBinding conflict', async () => {
    assertUniqueRecipeBinding('b1', 'id-a');
    expect(() => assertUniqueRecipeBinding('b1', 'id-b')).toThrow(/conflicting/);
  });

  test('share never and prepare-only', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-share-'));
    const r1 = defineRecipe({
      id: 'never1',
      share: 'never',
      start: async ({ port }) => {
        const s = createServer((_q, res) => res.end('n'));
        await new Promise<void>((r) => s.listen(port, '127.0.0.1', () => r()));
        return {
          kind: 'url',
          url: `http://127.0.0.1:${port}/`,
          stop: () => new Promise((r) => s.close(() => r())),
        };
      },
    });
    await ensurePrepared(r1, { artifactsRoot: artifacts });
    resetRecipeBindings();
    const r2 = defineRecipe({
      id: 'prep1',
      share: 'prepare-only',
      prepare: async ({ outDir }) => {
        await writeFile(join(outDir, 'x'), '1');
      },
      start: async () => ({ kind: 'dir', dir: '/tmp' }),
    });
    const p = await ensurePrepared(r2, { artifactsRoot: artifacts });
    expect(p.running.kind).toBe('dir');
    await rm(artifacts, { recursive: true, force: true });
  });

  test('UNTESTUTILS_SHARE=0 and registry dead url refresh', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-share0-'));
    process.env.UNTESTUTILS_SHARE = '0';
    const site = await mkdtemp(join(tmpdir(), 'ut-s2-'));
    await writeFile(join(site, 'index.html'), 'z');
    const { staticDir } = await import('@untestutils/drivers');
    const recipe = staticDir({ id: 'share0', root: site });
    await ensurePrepared(recipe, { artifactsRoot: artifacts });
    delete process.env.UNTESTUTILS_SHARE;

    // poison registry with dead url then ensure again
    process.env.UNTESTUTILS_SHARE = '1';
    const reg = new TargetRegistry(artifacts);
    await reg.set({ id: 'share0', identity: 'x', url: 'http://127.0.0.1:1/' });
    resetRecipeBindings();
    clearRegisteredRecipes();
    const recipe2 = staticDir({ id: 'share0', root: site });
    const prep = await ensurePrepared(recipe2, { artifactsRoot: artifacts });
    expect('url' in prep.running && prep.running.url).toBeTruthy();
    delete process.env.UNTESTUTILS_SHARE;
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });
});
