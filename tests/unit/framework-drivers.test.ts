import { describe, expect, test } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  assertAppRoot,
  resolveBin,
  frameworkRoots,
  nodeEntry,
  staticDir,
} from '@untestutils/drivers';
import { vite } from '@untestutils/vite';
import { next } from '@untestutils/next';
import { astro } from '@untestutils/astro';
import { sveltekit } from '@untestutils/sveltekit';
import { remix } from '@untestutils/remix';
import { solidstart } from '@untestutils/solidstart';
import { nuxt } from '@untestutils/nuxt';

describe('framework Recipe factories', () => {
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
