import { describe, expect, test } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { assertAppRoot, resolveBin, frameworkRoots, nodeEntry, staticDir } from '@untestutils/core';
import { vite, matrix as viteMatrix } from '@untestutils/vite';
import { next, matrix as nextMatrix } from '@untestutils/next';
import { astro, matrix as astroMatrix } from '@untestutils/astro';
import { sveltekit, matrix as sveltekitMatrix } from '@untestutils/sveltekit';
import { remix, matrix as remixMatrix } from '@untestutils/remix';
import { solidstart, matrix as solidstartMatrix } from '@untestutils/solidstart';
import { nuxt } from '@untestutils/nuxt';

describe('framework Recipe factories', () => {
  test('vite resolveViteAppOutDir + assertViteBuildOutput', async () => {
    const { resolveViteAppOutDir, assertViteBuildOutput } = await import('@untestutils/vite');
    expect(resolveViteAppOutDir()).toBe('dist');
    expect(resolveViteAppOutDir({ build: { outDir: 'dist-override' } })).toBe('dist-override');
    const root = await mkdtemp(join(tmpdir(), 'ut-vite-out-'));
    expect(() => assertViteBuildOutput(root, { build: { outDir: 'dist-override' } })).toThrow(
      /missing build output/,
    );
    await mkdir(join(root, 'dist-override'), { recursive: true });
    await writeFile(join(root, 'dist-override', 'index.html'), '<html/>');
    expect(() => assertViteBuildOutput(root, { build: { outDir: 'dist-override' } })).not.toThrow();
  });

  test.each([
    ['vite', () => vite({ id: 'v', root: process.cwd(), run: 'preview' }), 'always'],
    ['vite-dev', () => vite({ id: 'vd', root: process.cwd(), run: 'dev' }), 'never'],
    ['next', () => next({ id: 'n', root: process.cwd(), run: 'server' }), 'always'],
    ['next-dev', () => next({ id: 'nd', root: process.cwd(), run: 'dev' }), 'never'],
    ['next-static', () => next({ id: 'ns', root: process.cwd(), run: 'static' }), 'always'],
    ['astro', () => astro({ id: 'a', root: process.cwd(), run: 'preview' }), 'always'],
    ['sveltekit', () => sveltekit({ id: 's', root: process.cwd(), run: 'preview' }), 'always'],
    ['remix', () => remix({ id: 'r', root: process.cwd(), run: 'server' }), 'always'],
    ['solidstart', () => solidstart({ id: 'ss', root: process.cwd(), run: 'preview' }), 'always'],
  ] as const)('%s returns recipe with start', (_name, factory, share) => {
    const r = factory();
    expect(r.id).toBeTruthy();
    expect(r.share).toBe(share);
    expect(typeof r.start).toBe('function');
    expect(typeof r.hashInputs).toBe('function');
  });

  test.each([
    ['vite', viteMatrix],
    ['next', nextMatrix],
    ['astro', astroMatrix],
    ['sveltekit', sveltekitMatrix],
    ['remix', remixMatrix],
    ['solidstart', solidstartMatrix],
  ] as const)('%s matrix() expands ids and diverges hash', async (_name, matrixFn) => {
    const recipes = matrixFn(
      { id: 'fw', root: process.cwd(), env: { A: '1' } },
      {
        default: { env: { STRATEGY: 'prefix' } },
        alt: { env: { B: '2' } },
      },
    );
    expect(Object.keys(recipes).sort()).toEqual(['fw', 'fw__alt']);
    const a = await recipes.fw.hashInputs!();
    const b = await recipes.fw__alt.hashInputs!();
    expect(a).not.toEqual(b);
    expect(a.some((x) => String(x).includes('variant:default'))).toBe(true);
  });

  test('resolveBin finds package bin', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-bin-'));
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { 'fake-cli': '1.0.0' } }),
    );
    const fake = join(dir, 'node_modules', 'fake-cli');
    await mkdir(join(fake, 'bin'), { recursive: true });
    await writeFile(
      join(fake, 'package.json'),
      JSON.stringify({ name: 'fake-cli', version: '1.0.0' }),
    );
    const binPath = join(fake, 'bin', 'cli.js');
    await writeFile(binPath, '#!/usr/bin/env node\n');
    const resolved = resolveBin({
      label: 'test',
      roots: frameworkRoots(dir),
      packageJsonIds: ['fake-cli/package.json'],
      binRelative: ['bin/cli.js'],
    });
    expect(resolved).toContain('fake-cli/bin/cli.js');
    expect(resolved.endsWith('bin/cli.js')).toBe(true);
  });

  test('resolveBin finds CLI when package exports block subpaths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-bin-exports-'));
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'app' }));
    const fake = join(dir, 'node_modules', 'tight-cli');
    await mkdir(join(fake, 'bin'), { recursive: true });
    await writeFile(
      join(fake, 'package.json'),
      JSON.stringify({
        name: 'tight-cli',
        version: '1.0.0',
        exports: { '.': './index.js' },
      }),
    );
    await writeFile(join(fake, 'index.js'), 'export {}\n');
    const binPath = join(fake, 'bin', 'cli.mjs');
    await writeFile(binPath, '#!/usr/bin/env node\n');
    const resolved = resolveBin({
      label: 'test',
      roots: [dir],
      directIds: ['tight-cli/bin/cli.mjs'],
      packageJsonIds: ['tight-cli/package.json'],
      binRelative: ['bin/cli.mjs'],
    });
    expect(resolved).toBe(binPath);
  });

  test('hashInputs diverge by run mode', async () => {
    const a = await vite({ id: 'a', root: '/tmp/x', run: 'preview' }).hashInputs!({
      outDir: '',
      artifactsRoot: '',
    });
    const b = await vite({ id: 'b', root: '/tmp/x', run: 'dev' }).hashInputs!({
      outDir: '',
      artifactsRoot: '',
    });
    expect(a).not.toEqual(b);
  });

  test('config overrides diverge hashInputs', async () => {
    const ctx = { outDir: '', artifactsRoot: '' };
    const bare = await vite({ id: 'v0', root: '/tmp/x', run: 'preview' }).hashInputs!(ctx);
    const withCfg = await vite({
      id: 'v1',
      root: '/tmp/x',
      run: 'preview',
      viteConfig: { define: { __UT__: '"1"' } },
    }).hashInputs!(ctx);
    expect(withCfg).not.toEqual(bare);
    expect(withCfg.some((x) => String(x).startsWith('viteConfig:'))).toBe(true);

    const nextBare = await next({ id: 'n0', root: '/tmp/x', run: 'server' }).hashInputs!(ctx);
    const nextCfg = await next({
      id: 'n1',
      root: '/tmp/x',
      run: 'server',
      nextConfig: { env: { UT: '1' } },
    }).hashInputs!(ctx);
    expect(nextCfg).not.toEqual(nextBare);
    expect(nextCfg.some((x) => String(x).startsWith('nextConfig:'))).toBe(true);

    const astroCfg = await astro({
      id: 'a1',
      root: '/tmp/x',
      run: 'preview',
      astroConfig: { trailingSlash: 'always' },
    }).hashInputs!(ctx);
    expect(astroCfg.some((x) => String(x).startsWith('astroConfig:'))).toBe(true);

    const solidCfg = await solidstart({
      id: 's1',
      root: '/tmp/x',
      run: 'preview',
      appConfig: { server: { preset: 'node-server' } },
    }).hashInputs!(ctx);
    expect(solidCfg.some((x) => String(x).startsWith('appConfig:'))).toBe(true);

    const kitBare = await sveltekit({ id: 'sk0', root: '/tmp/x', run: 'preview' }).hashInputs!(ctx);
    const kitCfg = await sveltekit({
      id: 'sk1',
      root: '/tmp/x',
      run: 'preview',
      kitConfig: { kit: { appDir: '_app_ut' } },
    }).hashInputs!(ctx);
    expect(kitCfg).not.toEqual(kitBare);
    expect(kitCfg.some((x) => String(x).startsWith('kitConfig:'))).toBe(true);
  });

  test('matrix deep-merges typed config overrides', async () => {
    const recipes = viteMatrix(
      {
        id: 'spa',
        root: '/tmp/x',
        viteConfig: { define: { A: '1' }, server: { port: 1 } },
      },
      {
        default: {},
        patched: { viteConfig: { define: { B: '2' }, server: { strictPort: true } } },
      },
    );
    const a = await recipes.spa.hashInputs!({ outDir: '', artifactsRoot: '' });
    const b = await recipes.spa__patched.hashInputs!({ outDir: '', artifactsRoot: '' });
    expect(a).not.toEqual(b);
    const patchedFrag = b.find((x) => String(x).startsWith('viteConfig:'));
    expect(patchedFrag).toBeTruthy();
    expect(String(patchedFrag)).toContain('"A":"1"');
    expect(String(patchedFrag)).toContain('"B":"2"');
    expect(String(patchedFrag)).toContain('"strictPort":true');
  });

  test('assertAppRoot explains missing fixture', () => {
    expect(() => assertAppRoot('/tmp/untestutils-missing-root-xyz', 'vite')).toThrow(
      /\[untestutils\/vite\] root not found/,
    );
  });

  test('cli / nuxt prepare fails with root not found', async () => {
    const missing = '/tmp/untestutils-missing-fixture-xyz';
    await expect(
      vite({ id: 'bad-vite', root: missing, run: 'dev' }).start!({
        port: 1,
        outDir: '/tmp',
        artifactsRoot: '/tmp',
      }),
    ).rejects.toThrow(/\[untestutils\/vite\] root not found/);
    await expect(
      nuxt({ id: 'bad-nuxt', root: missing, run: 'server' }).prepare!({
        outDir: '/tmp',
        artifactsRoot: '/tmp',
      } as never),
    ).rejects.toThrow(/\[untestutils\/nuxt\] root not found/);
  });

  test('nodeEntry / staticDir explain missing paths', async () => {
    await expect(
      nodeEntry({ id: 'ne', entry: '/tmp/untestutils-missing-entry.js' }).start!({
        port: 1,
        outDir: '/tmp',
        artifactsRoot: '/tmp',
      }),
    ).rejects.toThrow(/\[untestutils\/nodeEntry\] entry not found/);
    await expect(
      staticDir({ id: 'sd', root: '/tmp/untestutils-missing-static' }).start!({
        port: 1,
        outDir: '/tmp',
        artifactsRoot: '/tmp',
      }),
    ).rejects.toThrow(/\[untestutils\/staticDir\] root not found/);
  });
});
