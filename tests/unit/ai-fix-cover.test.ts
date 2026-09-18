import { describe, test, expect } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { fixBrokenTests, coverMissingTests, createAgentToolkit } from '@untestutils/ai';

describe('ai fix/cover workflows', () => {
  test('fixBrokenTests mock writes fixed source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'untestutils-fix-'));
    process.env.UNTESTUTILS_AI_MOCK = '1';
    process.env.UNTESTUTILS_ARTIFACTS_DIR = join(root, '.artifacts');
    try {
      const file = join(root, 'broken.test.ts');
      await writeFile(file, `test('x', () => { expect(1).toBe(2) })\n`, 'utf8');
      const r = await fixBrokenTests({
        path: file,
        root,
        failureLog: 'AssertionError: expected 1 to be 2',
        recipes: ['basic'],
        write: true,
      });
      expect(r.code).toContain('useHarness');
      expect(r.code).toContain('mock fix');
    } finally {
      delete process.env.UNTESTUTILS_AI_MOCK;
      await rm(root, { recursive: true, force: true });
    }
  });

  test('coverMissingTests mock emits a file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'untestutils-cover-'));
    process.env.UNTESTUTILS_AI_MOCK = '1';
    process.env.UNTESTUTILS_ARTIFACTS_DIR = join(root, '.artifacts');
    try {
      await mkdir(join(root, 'tests'), { recursive: true });
      const r = await coverMissingTests({
        root,
        recipes: ['site'],
        write: true,
        outDir: 'tests/e2e',
      });
      expect(r.files.length).toBeGreaterThan(0);
      expect(r.files[0]!.code).toContain('mock cover');
    } finally {
      delete process.env.UNTESTUTILS_AI_MOCK;
      await rm(root, { recursive: true, force: true });
    }
  });

  test('createAgentToolkit exposes fs tools', () => {
    const tk = createAgentToolkit({ root: process.cwd(), browser: false });
    const names = tk.tools.map((t) => t.name);
    expect(names).toContain('list_dir');
    expect(names).toContain('read_file');
    expect(names).toContain('grep');
  });
});
