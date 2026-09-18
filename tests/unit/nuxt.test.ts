import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { nuxt, _internals, waitForHttpReady } from '@untestutils/nuxt';
import {
  ensurePrepared,
  stopAllTargets,
  clearRegisteredRecipes,
  resetRecipeBindings,
} from '@untestutils/core';
import { getFreePort } from '@untestutils/core';
import { createServer } from 'node:http';

describe('nuxt factory', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
    vi.restoreAllMocks();
  });

  test('factory shapes for server/static/dev', () => {
    const s = nuxt({ root: '/tmp/app', run: 'server', id: 'n-server' });
    expect(s.id).toBe('n-server');
    expect(s.share).toBe('always');
    expect(typeof s.prepare).toBe('function');
    const st = nuxt({ root: '/tmp/app', run: 'static' });
    expect(st.share).toBe('always');
    const d = nuxt({ root: '/tmp/app', run: 'dev' });
    expect(d.share).toBe('never');
    expect(waitForHttpReady).toBeTypeOf('function');
  });

  test('findServerEntry / findPublicDir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-nuxt-'));
    await expect(() => _internals.findServerEntry(dir)).toThrow(/server entry/);
    await expect(() => _internals.findPublicDir(dir)).toThrow(/public dir/);
    await mkdir(join(dir, 'output', 'server'), { recursive: true });
    await writeFile(join(dir, 'output', 'server', 'index.mjs'), 'export {}');
    expect(_internals.findServerEntry(dir)).toContain('index.mjs');
    await mkdir(join(dir, 'output', 'public'), { recursive: true });
    expect(_internals.findPublicDir(dir)).toContain('public');
    await rm(dir, { recursive: true, force: true });
  });

  test('server start with prebuilt entry (skip real nuxt build)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ut-nuxt-root-'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 't' }));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-nuxt-art-'));
    const recipe = nuxt({
      id: 'n-srv',
      root,
      run: 'server',
      hashInputs: [join(root, 'package.json')],
    });

    // stub prepare to write nitro-like server
    recipe.prepare = async ({ outDir }) => {
      await mkdir(join(outDir, 'output', 'server'), { recursive: true });
      await writeFile(
        join(outDir, 'output', 'server', 'index.mjs'),
        `
import { createServer } from 'node:http'
createServer((q,s)=>s.end('nuxt-ok')).listen(Number(process.env.PORT),'127.0.0.1')
`,
      );
    };

    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    expect('url' in prep.running).toBe(true);
    if ('url' in prep.running) {
      const { ofetch } = await import('ofetch');
      expect(await ofetch(prep.running.url)).toContain('nuxt-ok');
    }
    await rm(root, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('static start with prebuilt public', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ut-nuxt-st-'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 't' }));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-nuxt-art-'));
    const recipe = nuxt({
      id: 'n-st',
      root,
      run: 'static',
      hashInputs: [join(root, 'package.json')],
    });
    recipe.prepare = async ({ outDir }) => {
      await mkdir(join(outDir, 'output', 'public'), { recursive: true });
      await writeFile(join(outDir, 'output', 'public', 'index.html'), '<html>static-nuxt</html>');
    };
    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    if ('url' in prep.running) {
      const { ofetch } = await import('ofetch');
      expect(await ofetch(prep.running.url)).toContain('static-nuxt');
    }
    await rm(root, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('buildNuxtApp / generateNuxtApp with mocked kit', async () => {
    const close = vi.fn(async () => {});
    const loadNuxt = vi.fn(async () => ({ close }));
    const buildNuxt = vi.fn(async () => {});
    const kitPath = join(await mkdtemp(join(tmpdir(), 'ut-kit-')), 'kit.mjs');
    await writeFile(
      kitPath,
      `export const loadNuxt = globalThis.__mockLoadNuxt
export const buildNuxt = globalThis.__mockBuildNuxt`,
    );
    (globalThis as any).__mockLoadNuxt = loadNuxt;
    (globalThis as any).__mockBuildNuxt = buildNuxt;

    vi.spyOn(_internals, 'resolveKit').mockReturnValue(kitPath);

    const root = await mkdtemp(join(tmpdir(), 'ut-nr-'));
    const out = await mkdtemp(join(tmpdir(), 'ut-no-'));
    await _internals.buildNuxtApp(root, out, { foo: 1 }, false);
    await _internals.generateNuxtApp(root, out, { bar: 2 });
    expect(loadNuxt).toHaveBeenCalled();
    expect(buildNuxt).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
    delete (globalThis as any).__mockLoadNuxt;
    delete (globalThis as any).__mockBuildNuxt;
  });

  test('dev start failure surfaces logs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ut-nd-'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 't' }));
    const boom = join(root, 'boom.mjs');
    await writeFile(boom, 'console.error("boom"); process.exit(1)');
    const spy = vi.spyOn(_internals, 'resolveNuxiEntry').mockReturnValue(boom);
    const recipe = nuxt({
      id: 'n-dev',
      root,
      run: 'dev',
      readyTimeoutMs: 3_000,
      hashInputs: [join(root, 'package.json')],
    });
    const port = await getFreePort();
    await expect(
      recipe.start({
        root,
        outDir: root,
        artifactsRoot: root,
        port,
        host: '127.0.0.1',
        env: process.env,
        run: { command: async () => ({ exitCode: 0, stdout: '', stderr: '' }) } as any,
      }),
    ).rejects.toThrow();
    spy.mockRestore();
    await rm(root, { recursive: true, force: true });
  }, 15_000);

  test('resolveNuxiEntry falls back to nuxt bin', () => {
    // Fixture without nuxi/cli still resolves via workspace nuxt package.
    const root = join(process.cwd(), 'playground');
    const entry = _internals.resolveNuxiEntry(root);
    expect(entry).toMatch(/nuxt\.mjs$|nuxi/);
  });
});
