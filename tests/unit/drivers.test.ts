import { describe, expect, test, afterEach, beforeEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { createServer } from 'node:http';
import { ofetch } from 'ofetch';
import { defineDriver, command, staticDir, nodeEntry, host } from '@untestutils/core';
import { defineRecipe } from '@untestutils/core';
import { ensurePrepared, stopAllTargets } from '@untestutils/core';
import { clearRegisteredRecipes } from '@untestutils/core';
import { resetRecipeBindings } from '@untestutils/core';
import { getFreePort } from '@untestutils/core';

describe('defineDriver', () => {
  test('normalizes id and default share', () => {
    const impl = (opts: { id: string }) =>
      defineRecipe({
        id: `  ${opts.id}  `,
        start: async () => ({ kind: 'dir', dir: '/tmp' }),
      });
    const d = defineDriver(impl);
    const recipe = d({ id: 'x' });
    expect(recipe.id).toBe('x');
    expect(recipe.share).toBe('always');
  });

  test('preserves explicit share', () => {
    const d = defineDriver(() =>
      defineRecipe({
        id: 's',
        share: 'never',
        start: async () => ({ kind: 'dir', dir: '/tmp' }),
      }),
    );
    expect(d({}).share).toBe('never');
  });

  test('rejects missing id', () => {
    const impl = () =>
      defineRecipe({
        id: '   ',
        start: async () => ({ kind: 'dir', dir: '/tmp' }),
      });
    expect(() => defineDriver(impl)({})).toThrow(/recipe\.id is required/);
  });

  test('rejects non-object return', () => {
    const d = defineDriver((() => null) as any);
    expect(() => d({})).toThrow(/must return a Recipe/);
  });

  test('rejects invalid share', () => {
    const d = defineDriver((() => ({
      id: 'bad',
      share: 'sometimes',
      start: async () => ({ kind: 'dir', dir: '/tmp' }),
    })) as any);
    expect(() => d({})).toThrow(/invalid share/);
  });

  test('accepts prepare-only share', () => {
    const d = defineDriver(() =>
      defineRecipe({
        id: 'p',
        share: 'prepare-only',
        start: async () => ({ kind: 'dir', dir: '/tmp' }),
      }),
    );
    expect(d({}).share).toBe('prepare-only');
  });
});

describe('drivers', () => {
  afterEach(async () => {
    await stopAllTargets();
    clearRegisteredRecipes();
    resetRecipeBindings();
  });

  test('staticDir serves + spa fallback + 404', async () => {
    const site = await mkdtemp(join(tmpdir(), 'ut-static-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-art-'));
    await writeFile(join(site, 'index.html'), '<html>home</html>');
    await writeFile(join(site, 'app.js'), 'console.log(1)');
    const recipe = staticDir({ id: 's1', root: site });
    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    const url = 'url' in prep.running ? prep.running.url! : '';
    expect(await ofetch(url)).toContain('home');
    expect(await ofetch(new URL('/app.js', url).toString())).toContain('console');
    expect(await ofetch(new URL('/missing-route', url).toString())).toContain('home');
    await rm(site, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('host skipReady', async () => {
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-host-'));
    const recipe = host({ id: 'hskip', url: 'http://127.0.0.1:1/', skipReady: true });
    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    expect(prep.running.kind).toBe('url');
    if (prep.running.stop) await prep.running.stop();
    await rm(artifacts, { recursive: true, force: true });
  });

  test('host requires url', () => {
    expect(() => host({ id: 'empty', url: '  ' })).toThrow(/\[untestutils\/host\] url is required/);
  });

  test('command prepare-only and prepare failure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-cmd-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-art-'));
    await writeFile(join(dir, 'ok.txt'), 'x');
    const ok = command({
      id: 'cmd-prep',
      cwd: dir,
      prepare: `${process.execPath} -e "require('fs').writeFileSync('built.txt','1')"`,
    });
    const prep = await ensurePrepared(ok, { artifactsRoot: artifacts });
    expect(prep.running.kind).toBe('dir');

    resetRecipeBindings();
    clearRegisteredRecipes();
    const bad = command({
      id: 'cmd-fail',
      cwd: dir,
      prepare: `${process.execPath} -e "process.exit(2)"`,
    });
    await expect(ensurePrepared(bad, { artifactsRoot: artifacts })).rejects.toThrow(
      /prepare failed/,
    );
    await rm(dir, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('command start with $PORT', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-cmd2-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-art-'));
    const serverJs = join(dir, 'serve.mjs');
    await writeFile(
      serverJs,
      `
import { createServer } from 'node:http'
createServer((q,s)=>s.end('cmd-ok')).listen(Number(process.env.PORT),'127.0.0.1')
`,
    );
    const recipe = command({
      id: 'cmd-start',
      cwd: dir,
      start: `${process.execPath} serve.mjs`,
    });
    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    expect('url' in prep.running).toBe(true);
    if ('url' in prep.running) {
      expect(await ofetch(prep.running.url)).toContain('cmd-ok');
    }
    await rm(dir, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });

  test('nodeEntry starts http server file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-node-'));
    const artifacts = await mkdtemp(join(tmpdir(), 'ut-art-'));
    const entry = join(dir, 'entry.mjs');
    await writeFile(
      entry,
      `
import { createServer } from 'node:http'
createServer((q,s)=>s.end('node-ok')).listen(Number(process.env.PORT),'127.0.0.1')
`,
    );
    const recipe = nodeEntry({ id: 'node1', entry, cwd: dir });
    const prep = await ensurePrepared(recipe, { artifactsRoot: artifacts });
    if ('url' in prep.running) {
      expect(await ofetch(prep.running.url)).toContain('node-ok');
    }
    await rm(dir, { recursive: true, force: true });
    await rm(artifacts, { recursive: true, force: true });
  });
});
