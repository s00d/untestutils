import { describe, expect, test } from 'vitest';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import {
  withEphemeralFile,
  installEphemeralFile,
  withMergedConfigOverride,
  writeEphemeralConfig,
  serializeDefaultExport,
  serializeMergedDefaultExport,
  serializeViteMergeConfigModule,
  findFirstExistingConfig,
  configOverrideHashInput,
  deepMergePlain,
} from '@untestutils/core';

describe('config-override helpers', () => {
  test('withEphemeralFile restores previous contents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-'));
    const path = join(dir, 'next.config.mjs');
    await writeFile(path, 'export default { a: 1 }\n');
    await withEphemeralFile(path, 'export default { a: 2 }\n', async () => {
      expect(await readFile(path, 'utf8')).toContain('a: 2');
    });
    expect(await readFile(path, 'utf8')).toContain('a: 1');
    expect(existsSync(`${path}.untestutils-bak`)).toBe(false);
  });

  test('withEphemeralFile deletes when file was absent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-new-'));
    const path = join(dir, 'app.config.ts');
    expect(existsSync(path)).toBe(false);
    await withEphemeralFile(path, 'export default {}\n', async () => {
      expect(existsSync(path)).toBe(true);
    });
    expect(existsSync(path)).toBe(false);
  });

  test('installEphemeralFile restores on demand', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-install-'));
    const path = join(dir, 'next.config.mjs');
    await writeFile(path, 'export default { a: 1 }\n');
    const restore = await installEphemeralFile(path, 'export default { a: 2 }\n');
    expect(await readFile(path, 'utf8')).toContain('a: 2');
    await restore();
    expect(await readFile(path, 'utf8')).toContain('a: 1');
  });

  test('withMergedConfigOverride restores and cleans base copy', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-merge-'));
    const path = join(dir, 'next.config.mjs');
    await writeFile(path, 'export default { a: 1 }\n');
    await withMergedConfigOverride(path, { b: 2 }, async () => {
      const src = await readFile(path, 'utf8');
      expect(src).toContain('untestutils-base');
      expect(src).toContain('"b": 2');
      expect(existsSync(join(dir, 'next.config.untestutils-base.mjs'))).toBe(true);
    });
    expect(await readFile(path, 'utf8')).toContain('a: 1');
    expect(existsSync(join(dir, 'next.config.untestutils-base.mjs'))).toBe(false);
  });

  test('serializeViteMergeConfigModule embeds overrides and appRoot', () => {
    const src = serializeViteMergeConfigModule({
      appRoot: '/app',
      overrides: { define: { X: '1' } },
    });
    expect(src).toContain('mergeConfig');
    expect(src).toContain('/app');
    expect(src).toContain('"X":"1"');
  });

  test('writeEphemeralConfig creates parents', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-w-'));
    const path = join(dir, 'nested', 'vite.untestutils.mjs');
    await writeEphemeralConfig(path, serializeDefaultExport({ define: { X: '1' } }));
    expect(await readFile(path, 'utf8')).toContain('"X": "1"');
  });

  test('serializeMergedDefaultExport embeds overrides', () => {
    const src = serializeMergedDefaultExport({
      baseImportSpecifier: './vite.config.js',
      overrides: { server: { port: 1 } },
    });
    expect(src).toContain('./vite.config.js');
    expect(src).toContain('"port": 1');
  });

  test('findFirstExistingConfig', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ut-eph-find-'));
    await writeFile(join(dir, 'astro.config.mjs'), 'export default {}\n');
    expect(findFirstExistingConfig(dir, ['astro.config.ts', 'astro.config.mjs'])).toBe(
      join(dir, 'astro.config.mjs'),
    );
  });

  test('deepMergePlain and hash input', () => {
    expect(deepMergePlain({ a: { b: 1, c: 2 } }, { a: { c: 3 } })).toEqual({ a: { b: 1, c: 3 } });
    expect(configOverrideHashInput('viteConfig', { x: 1 })).toBe('viteConfig:{"x":1}');
  });
});
